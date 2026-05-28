import { DatabaseService, type DbOrTx } from './DatabaseService';
import {
  clients,
  invoices,
  invoiceLineItems,
  otherCharges,
  qboItems,
  workActivities,
  notifications,
  type WorkActivity,
  type OtherCharge
} from '../db';
import { and, asc, eq, gte, ilike, inArray, isNotNull, lte, ne, or, sql } from 'drizzle-orm';
import { services } from './container';
import type { QBOInvoice } from './QuickBooksService';
import { workTypeMapping } from './InvoiceService';

// ---------------------------------------------------------------------------
// Scoring thresholds — top of file so they're easy to tune.
// ---------------------------------------------------------------------------

const HIGH_THRESHOLD = 5;
const MIN_THRESHOLD = 2;

// 90-day candidate window around the invoice date.
const CANDIDATE_WINDOW_DAYS = 90;

// Stopwords used by the token-overlap scorer. Tiny on purpose — the matcher
// needs to ignore noise words, not be a full NLP stack.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'for', 'with', 'in', 'on', 'at', 'by', 'from', 'is', 'was'
]);

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SyncResult = {
  imported: number;
  updated: number;
  autoMatched: number;
  needsReview: number;
  unmatched: number;
  errors: Array<{
    type: 'unmatched_client' | 'qbo_fetch_failed' | 'invoice_persist_failed' | 'matcher_failed';
    qboInvoiceId?: string;
    message: string;
  }>;
};

export type ReviewQueueEntry = {
  lineItemId: number;
  invoiceId: number;
  invoiceNumber: string;
  invoiceDate: string;
  clientName: string | null;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  candidates: MatchCandidate[] | null;
};

export type MatchCandidate = {
  workActivityId: number;
  score: number;
  reason: string;
  date: string;
  workType: string;
  billableHours: number | null;
  notesSnippet: string;
};

export type RelinkSuccess = { ok: true };
export type RelinkWarning = {
  warning: 'already_linked';
  existingInvoices: Array<{ invoiceId: number; invoiceNumber: string }>;
};
export type RelinkResult = RelinkSuccess | RelinkWarning;

// Minimal shape the matcher needs from a QBO line item. Lets us unit-test
// the scorer with plain objects instead of full QBO responses.
export type ScoringLine = {
  description: string;
  qty: number | null;
  qboItemName?: string | null;
};

// Minimal work-activity shape required by the matcher. Subset of the DB row
// plus a couple of fields used in scoring/candidate display.
export type ScoringActivity = {
  id: number;
  date: string;
  workType: string;
  billableHours: number | null;
  notes: string | null;
  tasks: string | null;
};

// ---------------------------------------------------------------------------
// Pure helpers — kept as standalone exported functions so they're unit-testable
// without spinning up the DB.
// ---------------------------------------------------------------------------

/**
 * Tokenize a free-text blob into significant lowercase tokens for overlap
 * scoring. Drops short words and stopwords; splits on any non-word character
 * (handles punctuation, slashes, newlines, etc.).
 */
export function tokenize(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((tok) => tok.length >= 3 && !STOPWORDS.has(tok));
}

/**
 * True when the two strings share at least 2 significant tokens.
 */
export function hasTokenOverlap(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = new Set(tokenize(a));
  const tb = tokenize(b);
  let overlap = 0;
  for (const tok of tb) {
    if (ta.has(tok)) {
      overlap++;
      if (overlap >= 2) return true;
    }
  }
  return false;
}

/**
 * Absolute calendar-day distance between two YYYY-MM-DD strings.
 */
export function daysBetween(a: string, b: string): number {
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.abs(da - db) / (1000 * 60 * 60 * 24);
}

/**
 * True if any of the QBO item names mapped to `activity.workType` matches
 * (case-insensitive equal) the QBO item name on the line.
 */
export function workTypeMatchesQBOItem(workType: string, qboItemName: string | null | undefined): boolean {
  if (!qboItemName) return false;
  const mapped = workTypeMapping[workType.toLowerCase()];
  if (!mapped) return false;
  const target = qboItemName.toLowerCase();
  return mapped.some((name) => name.toLowerCase() === target);
}

/**
 * Score a single candidate work activity against a QBO labor line. Returns the
 * total score (float) and a short reason string for display in the review UI.
 *
 * Scoring rubric:
 *   +3   hours within ±0.25
 *   +2   description / notes share ≥2 significant tokens
 *   +(0..1)  proximity bonus, scaled by date closeness
 *   +2   workType maps to the QBO item name
 */
export function scoreCandidate(
  activity: ScoringActivity,
  line: ScoringLine,
  invoiceDate: string
): { score: number; reason: string } {
  const reasons: string[] = [];
  let score = 0;

  // Hours bonus
  if (
    typeof line.qty === 'number' &&
    activity.billableHours != null &&
    Math.abs(line.qty - activity.billableHours) <= 0.25
  ) {
    score += 3;
    reasons.push(`hours match (${activity.billableHours}h ≈ ${line.qty}h)`);
  }

  // Token-overlap bonus
  const activityText = `${activity.notes || ''} ${activity.tasks || ''}`.trim();
  if (line.description && hasTokenOverlap(line.description, activityText)) {
    score += 2;
    reasons.push('description tokens overlap');
  }

  // Proximity bonus (float, max +1)
  const daysAway = daysBetween(invoiceDate, activity.date);
  const proximity = Math.max(0, 1 - daysAway / CANDIDATE_WINDOW_DAYS);
  if (proximity > 0) {
    score += proximity;
    if (daysAway === 0) {
      reasons.push('same day');
    } else {
      reasons.push(`${Math.round(daysAway)}d away`);
    }
  }

  // WorkType-to-QBO-Item bonus
  if (workTypeMatchesQBOItem(activity.workType, line.qboItemName)) {
    score += 2;
    reasons.push(`workType "${activity.workType}" matches item`);
  }

  return { score, reason: reasons.join(', ') || 'no signals' };
}

/**
 * Build a MatchCandidate JSON entry from a scored activity. Includes a
 * 200-char snippet of notes/tasks so the review UI can render context
 * without joining back to work_activities.
 */
export function toMatchCandidate(
  activity: ScoringActivity,
  scored: { score: number; reason: string }
): MatchCandidate {
  const rawNotes = (activity.notes || activity.tasks || '').trim();
  return {
    workActivityId: activity.id,
    score: Number(scored.score.toFixed(3)),
    reason: scored.reason,
    date: activity.date,
    workType: activity.workType,
    billableHours: activity.billableHours,
    notesSnippet: rawNotes.length > 200 ? rawNotes.slice(0, 200) : rawNotes
  };
}

/**
 * Classify a set of scored candidates for a single labor line.
 *
 * Caller is responsible for upstream filtering (e.g., removing already-claimed
 * activities for within-invoice dedup). This function just applies the
 * threshold rules on whatever it's given.
 */
export function classifyLine(
  scored: Array<{ activity: ScoringActivity; score: number; reason: string }>
): {
  status: 'auto' | 'needs_review' | 'unmatched';
  workActivityId: number | null;
  matchScore: number | null;
  matchCandidates: MatchCandidate[] | null;
} {
  if (scored.length === 0) {
    return { status: 'unmatched', workActivityId: null, matchScore: null, matchCandidates: null };
  }
  // Sort descending by score; ties are broken by activity id ASC (deterministic).
  const sorted = [...scored].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.activity.id - b.activity.id;
  });
  const top = sorted[0];

  if (top.score >= HIGH_THRESHOLD) {
    return {
      status: 'auto',
      workActivityId: top.activity.id,
      matchScore: Number(top.score.toFixed(3)),
      matchCandidates: null
    };
  }

  if (top.score >= MIN_THRESHOLD) {
    const candidates = sorted.slice(0, 3).map((s) => toMatchCandidate(s.activity, s));
    return {
      status: 'needs_review',
      workActivityId: null,
      matchScore: Number(top.score.toFixed(3)),
      matchCandidates: candidates
    };
  }

  return { status: 'unmatched', workActivityId: null, matchScore: null, matchCandidates: null };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

type LabororMatch = {
  lineIndex: number;
  qboLine: QBOInvoice['Line'][number];
  status: 'auto' | 'needs_review' | 'unmatched';
  workActivityId: number | null;
  matchScore: number | null;
  matchCandidates: MatchCandidate[] | null;
};

type MaterialMatch = {
  lineIndex: number;
  qboLine: QBOInvoice['Line'][number];
  status: 'auto' | 'unmatched';
  otherChargeId: number | null;
};

export class InvoiceImportService extends DatabaseService {
  // -----------------------------------------------------------------------
  // Public: syncAllInvoices
  // -----------------------------------------------------------------------

  /**
   * Pull all QBO invoices, persist them locally, and run the matcher against
   * line items on freshly-inserted invoices. Existing invoices have their
   * status/totals refreshed but their line items are NOT rewritten (preserves
   * 'manual' relinks).
   *
   * Errors on a single invoice never abort the whole sync — they get pushed
   * into `result.errors` and processing continues.
   */
  async syncAllInvoices(opts?: { since?: string }): Promise<SyncResult> {
    const result: SyncResult = {
      imported: 0,
      updated: 0,
      autoMatched: 0,
      needsReview: 0,
      unmatched: 0,
      errors: []
    };

    let qboInvoices: QBOInvoice[];
    try {
      qboInvoices = await services.quickBooksService.getAllInvoices();
    } catch (error) {
      result.errors.push({
        type: 'qbo_fetch_failed',
        message: error instanceof Error ? error.message : String(error)
      });
      return result;
    }

    if (opts?.since) {
      const since = opts.since;
      qboInvoices = qboInvoices.filter((inv) => inv.TxnDate && inv.TxnDate >= since);
    }

    // Sort by TxnDate ASC so older invoices claim older work activities first.
    // Without this, matcher results vary with QBO's response order.
    qboInvoices.sort((a, b) => (a.TxnDate || '').localeCompare(b.TxnDate || ''));

    for (const qboInvoice of qboInvoices) {
      try {
        await this.processInvoice(qboInvoice, result);
      } catch (error) {
        result.errors.push({
          type: 'invoice_persist_failed',
          qboInvoiceId: qboInvoice.Id,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return result;
  }

  /**
   * Process one QBO invoice: resolve client, upsert invoice, run matcher for
   * inserts, flip activity statuses inside the same transaction.
   */
  private async processInvoice(qboInvoice: QBOInvoice, result: SyncResult): Promise<void> {
    const clientId = await this.resolveClientId(qboInvoice, result);
    if (clientId == null) return;

    const existing = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.qboInvoiceId, qboInvoice.Id))
      .limit(1);

    if (existing[0]) {
      // UPDATE path: refresh metadata only; do NOT rewrite line items so we
      // don't blow away 'manual' relinks the user has made since import.
      await this.db
        .update(invoices)
        .set({
          status: services.invoiceService.mapQBOInvoiceStatus(qboInvoice),
          totalAmount: qboInvoice.TotalAmt,
          dueDate: qboInvoice.DueDate || null,
          qboSyncAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(invoices.id, existing[0].id));
      result.updated++;
      return;
    }

    // INSERT path: persist invoice + line items + run matcher.
    let matcherResult: {
      laborMatches: LabororMatch[];
      materialMatches: MaterialMatch[];
    };
    try {
      matcherResult = await this.matchInvoiceLines(qboInvoice, clientId);
    } catch (error) {
      result.errors.push({
        type: 'matcher_failed',
        qboInvoiceId: qboInvoice.Id,
        message: error instanceof Error ? error.message : String(error)
      });
      // Still insert the invoice with unmatched lines so the user has a record.
      matcherResult = {
        laborMatches: qboInvoice.Line.map((line, lineIndex) => ({
          lineIndex,
          qboLine: line,
          status: 'unmatched' as const,
          workActivityId: null,
          matchScore: null,
          matchCandidates: null
        })),
        materialMatches: []
      };
    }

    await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(invoices)
        .values({
          qboInvoiceId: qboInvoice.Id,
          qboCustomerId: qboInvoice.CustomerRef.value,
          clientId,
          invoiceNumber: qboInvoice.DocNumber,
          status: services.invoiceService.mapQBOInvoiceStatus(qboInvoice),
          totalAmount: qboInvoice.TotalAmt,
          invoiceDate: qboInvoice.TxnDate,
          dueDate: qboInvoice.DueDate || null,
          qboSyncAt: new Date()
        })
        .returning();
      const localInvoiceId = inserted[0].id;

      // Build line item rows from the QBO invoice. We index by lineIndex so
      // we can layer matcher results on top regardless of whether each line
      // was treated as labor or material.
      const laborByIndex = new Map(matcherResult.laborMatches.map((m) => [m.lineIndex, m]));
      const materialByIndex = new Map(matcherResult.materialMatches.map((m) => [m.lineIndex, m]));

      const lineRows = qboInvoice.Line.map((line, lineIndex) => {
        const labor = laborByIndex.get(lineIndex);
        const material = materialByIndex.get(lineIndex);
        const qboItemId = line.SalesItemLineDetail?.ItemRef?.value || null;
        const qty = line.SalesItemLineDetail?.Qty ?? 0;
        const rate = line.SalesItemLineDetail?.UnitPrice ?? 0;

        let matchStatus: string = 'unmatched';
        let workActivityId: number | null = null;
        let otherChargeId: number | null = null;
        let matchScore: number | null = null;
        let matchCandidates: MatchCandidate[] | null = null;

        if (labor) {
          matchStatus = labor.status;
          workActivityId = labor.workActivityId;
          matchScore = labor.matchScore;
          matchCandidates = labor.matchCandidates;
        } else if (material) {
          matchStatus = material.status;
          otherChargeId = material.otherChargeId;
        }

        return {
          invoiceId: localInvoiceId,
          workActivityId,
          otherChargeId,
          qboItemId,
          description: line.Description || '',
          quantity: qty,
          rate,
          amount: line.Amount,
          matchStatus,
          matchScore,
          matchCandidates: matchCandidates as any
        };
      });

      if (lineRows.length > 0) {
        await tx.insert(invoiceLineItems).values(lineRows);
      }

      // Flip status for any 'auto'-matched labor activities (materials don't
      // flip activity status — they live on already-completed activities).
      const autoActivityIds = matcherResult.laborMatches
        .filter((m) => m.status === 'auto' && m.workActivityId != null)
        .map((m) => m.workActivityId as number);
      if (autoActivityIds.length > 0) {
        await services.workActivityService.setStatus(autoActivityIds, 'invoiced', tx);
      }
    });

    result.imported++;

    for (const m of matcherResult.laborMatches) {
      if (m.status === 'auto') result.autoMatched++;
      else if (m.status === 'needs_review') result.needsReview++;
      else result.unmatched++;
    }
    for (const m of matcherResult.materialMatches) {
      if (m.status === 'auto') result.autoMatched++;
      else result.unmatched++;
    }
  }

  /**
   * Resolve a local client for a QBO invoice. Tries qboCustomerId, then a
   * case-insensitive name match (with opportunistic backfill). Returns null
   * and writes an `unmatched_client` notification when no match is found.
   */
  private async resolveClientId(qboInvoice: QBOInvoice, result: SyncResult): Promise<number | null> {
    const qboCustomerId = qboInvoice.CustomerRef.value;
    const customerName = qboInvoice.CustomerRef.name || '';

    // 1) Primary lookup by qboCustomerId.
    const byQboId = await this.db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.qboCustomerId, qboCustomerId))
      .limit(1);
    if (byQboId[0]) return byQboId[0].id;

    // 2) Fallback by name (case-insensitive). If found, backfill qboCustomerId.
    if (customerName.trim()) {
      const byName = await this.db
        .select({ id: clients.id, qboCustomerId: clients.qboCustomerId })
        .from(clients)
        .where(ilike(clients.name, customerName.trim()))
        .limit(1);
      if (byName[0]) {
        if (!byName[0].qboCustomerId) {
          await this.db
            .update(clients)
            .set({ qboCustomerId, updatedAt: new Date() })
            .where(eq(clients.id, byName[0].id));
        }
        return byName[0].id;
      }
    }

    // 3) No match — record an error + notification.
    const message = `No local client matches "${customerName}"`;
    result.errors.push({
      type: 'unmatched_client',
      qboInvoiceId: qboInvoice.Id,
      message
    });
    try {
      await this.db.insert(notifications).values({
        type: 'qbo_invoice_unmatched_client',
        severity: 'warn',
        title: `Unmatched QBO customer: ${customerName || qboCustomerId}`,
        body:
          `QBO invoice #${qboInvoice.DocNumber || qboInvoice.Id} for customer "${customerName}" ` +
          `could not be linked to a local client. Add a matching client or set qboCustomerId, then re-run sync.`,
        entityType: null,
        metadata: { qboInvoiceId: qboInvoice.Id, qboCustomerId, customerName } as any
      });
    } catch (notifError) {
      // Notification failure shouldn't crash the sync.
      console.warn('Failed to insert unmatched_client notification:', notifError);
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Matching
  // -----------------------------------------------------------------------

  /**
   * Load candidate work activities + their charges and run the matcher for
   * every line on the invoice. Implements within-invoice dedup for labor.
   */
  private async matchInvoiceLines(
    qboInvoice: QBOInvoice,
    clientId: number
  ): Promise<{ laborMatches: LabororMatch[]; materialMatches: MaterialMatch[] }> {
    const invoiceDate = qboInvoice.TxnDate;
    const windowStart = shiftDate(invoiceDate, -CANDIDATE_WINDOW_DAYS);

    // Candidate activities: same client, completed, within 90d window.
    const candidateActivities = (await this.db
      .select()
      .from(workActivities)
      .where(
        and(
          eq(workActivities.clientId, clientId),
          eq(workActivities.status, 'completed'),
          gte(workActivities.date, windowStart),
          lte(workActivities.date, invoiceDate)
        )
      )) as WorkActivity[];

    // Classify lines into labor vs material using qbo_items.type.
    const qboItemIds = Array.from(
      new Set(
        qboInvoice.Line
          .map((l) => l.SalesItemLineDetail?.ItemRef?.value)
          .filter((v): v is string => !!v)
      )
    );
    const itemRows = qboItemIds.length
      ? await this.db.select().from(qboItems).where(inArray(qboItems.qboId, qboItemIds))
      : [];
    const itemTypeById = new Map(itemRows.map((it) => [it.qboId, it.type]));
    const itemNameById = new Map(itemRows.map((it) => [it.qboId, it.name]));

    // Score every line ↔ candidate pair for labor lines.
    const laborLines: Array<{
      lineIndex: number;
      qboLine: QBOInvoice['Line'][number];
      scored: Array<{ activity: ScoringActivity; score: number; reason: string }>;
    }> = [];
    const materialLines: Array<{
      lineIndex: number;
      qboLine: QBOInvoice['Line'][number];
    }> = [];

    qboInvoice.Line.forEach((line, lineIndex) => {
      const qboItemId = line.SalesItemLineDetail?.ItemRef?.value;
      const itemType = qboItemId ? itemTypeById.get(qboItemId) : undefined;
      const itemName = qboItemId ? itemNameById.get(qboItemId) : undefined;

      if (itemType === 'Inventory' || itemType === 'NonInventory') {
        materialLines.push({ lineIndex, qboLine: line });
        return;
      }
      // Default to labor (Service or unknown).
      const scoringLine: ScoringLine = {
        description: line.Description || '',
        qty: line.SalesItemLineDetail?.Qty ?? null,
        qboItemName: itemName ?? null
      };
      const scored = candidateActivities.map((activity) => ({
        activity: toScoringActivity(activity),
        ...scoreCandidate(toScoringActivity(activity), scoringLine, invoiceDate)
      }));
      laborLines.push({ lineIndex, qboLine: line, scored });
    });

    // Within-invoice dedup: process labor lines in descending top-score order
    // so the strongest match wins ties, and remove claimed activities from the
    // candidate pool of subsequent lines.
    const claimedActivityIds = new Set<number>();
    const laborMatches: LabororMatch[] = [];

    // First, compute each line's current top score (before dedup) for ordering.
    const orderedByTopScore = [...laborLines].sort((a, b) => {
      const ta = a.scored.length ? Math.max(...a.scored.map((s) => s.score)) : 0;
      const tb = b.scored.length ? Math.max(...b.scored.map((s) => s.score)) : 0;
      return tb - ta;
    });

    for (const { lineIndex, qboLine, scored } of orderedByTopScore) {
      const filtered = scored.filter((s) => !claimedActivityIds.has(s.activity.id));
      const classification = classifyLine(filtered);
      if (classification.status === 'auto' && classification.workActivityId != null) {
        claimedActivityIds.add(classification.workActivityId);
      }
      laborMatches.push({
        lineIndex,
        qboLine,
        status: classification.status,
        workActivityId: classification.workActivityId,
        matchScore: classification.matchScore,
        matchCandidates: classification.matchCandidates
      });
    }

    // Material matching: for each material line, look for an other_charges row
    // among candidate activities' charges whose description matches and whose
    // totalCost is within $0.01. Auto-match only when exactly one such row exists.
    const candidateActivityIds = candidateActivities.map((a) => a.id);
    const candidateCharges: OtherCharge[] = candidateActivityIds.length
      ? ((await this.db
          .select()
          .from(otherCharges)
          .where(inArray(otherCharges.workActivityId, candidateActivityIds))) as OtherCharge[])
      : [];

    const materialMatches: MaterialMatch[] = [];
    for (const { lineIndex, qboLine } of materialLines) {
      const desc = (qboLine.Description || '').trim();
      const amount = qboLine.Amount;
      const matchesDesc = (charge: OtherCharge) => {
        if (!desc) return false;
        const cd = charge.description?.toLowerCase() || '';
        const ld = desc.toLowerCase();
        // ILIKE-ish: exact, contains, or contained-by.
        return cd === ld || cd.includes(ld) || ld.includes(cd);
      };
      const amountMatches = (charge: OtherCharge) =>
        typeof charge.totalCost === 'number' && Math.abs(charge.totalCost - amount) < 0.01;
      const hits = candidateCharges.filter((c) => matchesDesc(c) && amountMatches(c));
      if (hits.length === 1) {
        materialMatches.push({
          lineIndex,
          qboLine,
          status: 'auto',
          otherChargeId: hits[0].id
        });
      } else {
        materialMatches.push({
          lineIndex,
          qboLine,
          status: 'unmatched',
          otherChargeId: null
        });
      }
    }

    return { laborMatches, materialMatches };
  }

  // -----------------------------------------------------------------------
  // Public: rematchInvoice
  // -----------------------------------------------------------------------

  /**
   * Re-run the matcher for a single invoice's line items, preserving any
   * 'manual' user decisions. Cleared activities are reverted from 'invoiced'
   * back to 'completed' iff they're no longer referenced by any invoice line.
   */
  async rematchInvoice(invoiceId: number): Promise<{
    autoMatched: number;
    needsReview: number;
    unmatched: number;
  }> {
    const invoiceRow = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);
    if (!invoiceRow[0]) throw new Error(`Invoice ${invoiceId} not found`);
    const invoice = invoiceRow[0];

    // Build a minimal QBOInvoice shape from the local invoice + lines so we
    // can reuse the matcher. We don't fetch from QBO here — rematch is a
    // local-only operation that re-applies scoring to today's candidates.
    const allLines = await this.db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId))
      .orderBy(asc(invoiceLineItems.id));

    const linesToRematch = allLines.filter((l) => l.matchStatus !== 'manual');
    if (linesToRematch.length === 0) {
      return { autoMatched: 0, needsReview: 0, unmatched: 0 };
    }

    // Collect activity ids that are about to be cleared so we can revert
    // any that end up orphaned.
    const clearedActivityIds = Array.from(
      new Set(
        linesToRematch
          .map((l) => l.workActivityId)
          .filter((id): id is number => id != null)
      )
    );

    // Build a synthetic QBOInvoice purely to feed the matcher.
    const itemQboIds = Array.from(
      new Set(
        linesToRematch
          .map((l) => l.qboItemId)
          .filter((v): v is string => !!v)
      )
    );
    const itemRows = itemQboIds.length
      ? await this.db.select().from(qboItems).where(inArray(qboItems.qboId, itemQboIds))
      : [];
    const itemTypeById = new Map(itemRows.map((it) => [it.qboId, it.type]));
    const itemNameById = new Map(itemRows.map((it) => [it.qboId, it.name]));

    // Re-score: candidate window from invoice date.
    const invoiceDate = invoice.invoiceDate;
    const windowStart = shiftDate(invoiceDate, -CANDIDATE_WINDOW_DAYS);
    const candidateActivities = (await this.db
      .select()
      .from(workActivities)
      .where(
        and(
          eq(workActivities.clientId, invoice.clientId),
          eq(workActivities.status, 'completed'),
          gte(workActivities.date, windowStart),
          lte(workActivities.date, invoiceDate)
        )
      )) as WorkActivity[];

    // Partition lines into labor vs material based on item type.
    const laborLines: Array<{
      lineId: number;
      qboItemId: string | null;
      description: string;
      qty: number | null;
      scored: Array<{ activity: ScoringActivity; score: number; reason: string }>;
    }> = [];
    const materialLines: Array<{
      lineId: number;
      description: string;
      amount: number;
    }> = [];

    for (const line of linesToRematch) {
      const itemType = line.qboItemId ? itemTypeById.get(line.qboItemId) : undefined;
      const itemName = line.qboItemId ? itemNameById.get(line.qboItemId) : undefined;
      if (itemType === 'Inventory' || itemType === 'NonInventory') {
        materialLines.push({
          lineId: line.id,
          description: line.description,
          amount: line.amount
        });
        continue;
      }
      const sLine: ScoringLine = {
        description: line.description,
        qty: line.quantity ?? null,
        qboItemName: itemName ?? null
      };
      const scored = candidateActivities.map((activity) => {
        const sa = toScoringActivity(activity);
        return { activity: sa, ...scoreCandidate(sa, sLine, invoiceDate) };
      });
      laborLines.push({
        lineId: line.id,
        qboItemId: line.qboItemId,
        description: line.description,
        qty: line.quantity ?? null,
        scored
      });
    }

    // Within-invoice dedup for the rematch — same algorithm as the initial sync.
    const claimed = new Set<number>();
    const ordered = [...laborLines].sort((a, b) => {
      const ta = a.scored.length ? Math.max(...a.scored.map((s) => s.score)) : 0;
      const tb = b.scored.length ? Math.max(...b.scored.map((s) => s.score)) : 0;
      return tb - ta;
    });
    const laborDecisions = new Map<
      number,
      ReturnType<typeof classifyLine>
    >();
    for (const ll of ordered) {
      const filtered = ll.scored.filter((s) => !claimed.has(s.activity.id));
      const decision = classifyLine(filtered);
      if (decision.status === 'auto' && decision.workActivityId != null) {
        claimed.add(decision.workActivityId);
      }
      laborDecisions.set(ll.lineId, decision);
    }

    // Material rematch.
    const candidateActivityIds = candidateActivities.map((a) => a.id);
    const candidateCharges: OtherCharge[] = candidateActivityIds.length
      ? ((await this.db
          .select()
          .from(otherCharges)
          .where(inArray(otherCharges.workActivityId, candidateActivityIds))) as OtherCharge[])
      : [];

    const materialDecisions = new Map<
      number,
      { status: 'auto' | 'unmatched'; otherChargeId: number | null }
    >();
    for (const ml of materialLines) {
      const desc = ml.description.trim();
      const matchesDesc = (charge: OtherCharge) => {
        if (!desc) return false;
        const cd = charge.description?.toLowerCase() || '';
        const ld = desc.toLowerCase();
        return cd === ld || cd.includes(ld) || ld.includes(cd);
      };
      const amountMatches = (charge: OtherCharge) =>
        typeof charge.totalCost === 'number' && Math.abs(charge.totalCost - ml.amount) < 0.01;
      const hits = candidateCharges.filter((c) => matchesDesc(c) && amountMatches(c));
      if (hits.length === 1) {
        materialDecisions.set(ml.lineId, { status: 'auto', otherChargeId: hits[0].id });
      } else {
        materialDecisions.set(ml.lineId, { status: 'unmatched', otherChargeId: null });
      }
    }

    // Apply decisions in a single transaction: clear the old lines, write
    // new state, flip activity statuses.
    let autoMatched = 0;
    let needsReview = 0;
    let unmatched = 0;

    await this.db.transaction(async (tx) => {
      // 1) Clear the lines we're rematching.
      for (const line of linesToRematch) {
        await tx
          .update(invoiceLineItems)
          .set({
            workActivityId: null,
            otherChargeId: null,
            matchStatus: 'unmatched',
            matchScore: null,
            matchCandidates: null,
            updatedAt: new Date()
          })
          .where(eq(invoiceLineItems.id, line.id));
      }

      // 2) Revert orphaned activities to 'completed'.
      await this.revertOrphanedActivities(clearedActivityIds, tx);

      // 3) Apply labor decisions.
      const newAutoActivityIds: number[] = [];
      for (const [lineId, decision] of laborDecisions) {
        await tx
          .update(invoiceLineItems)
          .set({
            workActivityId: decision.workActivityId,
            matchStatus: decision.status,
            matchScore: decision.matchScore,
            matchCandidates: (decision.matchCandidates ?? null) as any,
            updatedAt: new Date()
          })
          .where(eq(invoiceLineItems.id, lineId));
        if (decision.status === 'auto' && decision.workActivityId != null) {
          newAutoActivityIds.push(decision.workActivityId);
          autoMatched++;
        } else if (decision.status === 'needs_review') {
          needsReview++;
        } else {
          unmatched++;
        }
      }

      // 4) Apply material decisions.
      for (const [lineId, decision] of materialDecisions) {
        await tx
          .update(invoiceLineItems)
          .set({
            otherChargeId: decision.otherChargeId,
            matchStatus: decision.status,
            updatedAt: new Date()
          })
          .where(eq(invoiceLineItems.id, lineId));
        if (decision.status === 'auto') {
          autoMatched++;
        } else {
          unmatched++;
        }
      }

      // 5) Flip newly auto-matched activities to 'invoiced'.
      if (newAutoActivityIds.length > 0) {
        await services.workActivityService.setStatus(newAutoActivityIds, 'invoiced', tx);
      }
    });

    return { autoMatched, needsReview, unmatched };
  }

  // -----------------------------------------------------------------------
  // Public: relinkLineItem
  // -----------------------------------------------------------------------

  /**
   * The user-correction primitive. Sets `workActivityId` on a line (or clears
   * it). Detects cross-invoice double-links unless `force: true` is passed.
   * Manages activity status flips on both sides of the move.
   */
  async relinkLineItem(
    lineItemId: number,
    workActivityId: number | null,
    opts?: { source?: 'review' | 'detail'; force?: boolean }
  ): Promise<RelinkResult> {
    const rows = await this.db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.id, lineItemId))
      .limit(1);
    if (!rows[0]) throw new Error(`Line item ${lineItemId} not found`);
    const line = rows[0];

    // No-op short-circuit: same activity AND already 'manual'.
    if (line.workActivityId === workActivityId && line.matchStatus === 'manual') {
      return { ok: true };
    }

    // Double-link check: look for OTHER lines on OTHER invoices that reference
    // the same activity. We exclude this line's own invoice and own id so
    // moving within an invoice doesn't false-positive.
    let crossInvoiceRefs: Array<{ invoiceId: number; invoiceNumber: string }> = [];
    if (workActivityId != null) {
      const refs = await this.db
        .select({
          invoiceId: invoices.id,
          invoiceNumber: invoices.invoiceNumber
        })
        .from(invoiceLineItems)
        .innerJoin(invoices, eq(invoiceLineItems.invoiceId, invoices.id))
        .where(
          and(
            eq(invoiceLineItems.workActivityId, workActivityId),
            ne(invoiceLineItems.invoiceId, line.invoiceId),
            ne(invoiceLineItems.id, lineItemId)
          )
        );
      crossInvoiceRefs = refs;
      if (crossInvoiceRefs.length > 0 && !opts?.force) {
        return {
          warning: 'already_linked',
          existingInvoices: crossInvoiceRefs
        };
      }
    }

    const oldActivityId = line.workActivityId;
    const wasForcedDoubleLink = workActivityId != null && crossInvoiceRefs.length > 0 && !!opts?.force;

    await this.db.transaction(async (tx) => {
      // 1) Write the line.
      await tx
        .update(invoiceLineItems)
        .set({
          workActivityId,
          matchStatus: 'manual',
          matchScore: null,
          matchCandidates: null,
          updatedAt: new Date()
        })
        .where(eq(invoiceLineItems.id, lineItemId));

      // 2) Revert old activity if orphaned.
      if (oldActivityId != null) {
        await this.revertOrphanedActivities([oldActivityId], tx);
      }

      // 3) Flip new activity to 'invoiced' if it isn't already.
      if (workActivityId != null) {
        const current = await tx
          .select({ status: workActivities.status })
          .from(workActivities)
          .where(eq(workActivities.id, workActivityId))
          .limit(1);
        if (current[0] && current[0].status !== 'invoiced') {
          await services.workActivityService.setStatus([workActivityId], 'invoiced', tx);
        }
      }

      // 4) For forced double-links, log a notification. Best-effort inside tx;
      // if it fails the tx will roll back which is acceptable.
      if (wasForcedDoubleLink && workActivityId != null) {
        const allInvoiceIds = [line.invoiceId, ...crossInvoiceRefs.map((r) => r.invoiceId)];
        const allInvoiceNumbers = crossInvoiceRefs.map((r) => r.invoiceNumber);
        // Include this invoice's number too for the body.
        const thisInvoice = await tx
          .select({ invoiceNumber: invoices.invoiceNumber })
          .from(invoices)
          .where(eq(invoices.id, line.invoiceId))
          .limit(1);
        if (thisInvoice[0]) allInvoiceNumbers.unshift(thisInvoice[0].invoiceNumber);

        await tx.insert(notifications).values({
          type: 'work_activity_double_linked',
          severity: 'warn',
          title: 'Work activity linked to multiple invoices',
          body:
            `Work activity ${workActivityId} is now linked to multiple invoices: ` +
            `${allInvoiceNumbers.join(', ')}. This was a forced override.`,
          entityType: 'work_activity',
          entityId: workActivityId,
          metadata: {
            workActivityId,
            lineItemId,
            invoiceIds: allInvoiceIds
          } as any
        });
      }
    });

    return { ok: true };
  }

  // -----------------------------------------------------------------------
  // Public: getReviewQueue
  // -----------------------------------------------------------------------

  /**
   * Return all line items needing user review, enriched with invoice +
   * client info and the persisted candidate list. Self-contained so the
   * frontend doesn't need extra joins.
   */
  async getReviewQueue(): Promise<ReviewQueueEntry[]> {
    const rows = await this.db
      .select({
        lineItemId: invoiceLineItems.id,
        invoiceId: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
        clientName: clients.name,
        description: invoiceLineItems.description,
        quantity: invoiceLineItems.quantity,
        rate: invoiceLineItems.rate,
        amount: invoiceLineItems.amount,
        candidates: invoiceLineItems.matchCandidates
      })
      .from(invoiceLineItems)
      .innerJoin(invoices, eq(invoiceLineItems.invoiceId, invoices.id))
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(eq(invoiceLineItems.matchStatus, 'needs_review'))
      .orderBy(asc(invoices.invoiceDate), asc(invoiceLineItems.id));

    return rows.map((r) => ({
      lineItemId: r.lineItemId,
      invoiceId: r.invoiceId,
      invoiceNumber: r.invoiceNumber,
      invoiceDate: r.invoiceDate,
      clientName: r.clientName,
      description: r.description,
      quantity: r.quantity,
      rate: r.rate,
      amount: r.amount,
      candidates: (r.candidates as MatchCandidate[] | null) ?? null
    }));
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * For each activity id, if no invoice_line_items row references it anymore,
   * flip it back to 'completed'. Used by rematch and relink to keep activity
   * status consistent with line-item ownership.
   */
  private async revertOrphanedActivities(activityIds: number[], tx: DbOrTx): Promise<void> {
    if (activityIds.length === 0) return;
    const unique = Array.from(new Set(activityIds));
    const stillReferenced = await tx
      .select({ workActivityId: invoiceLineItems.workActivityId })
      .from(invoiceLineItems)
      .where(
        and(
          inArray(invoiceLineItems.workActivityId, unique),
          isNotNull(invoiceLineItems.workActivityId)
        )
      );
    const referenced = new Set(
      stillReferenced
        .map((r) => r.workActivityId)
        .filter((id): id is number => id != null)
    );
    const orphaned = unique.filter((id) => !referenced.has(id));
    if (orphaned.length > 0) {
      await services.workActivityService.setStatus(orphaned, 'completed', tx);
    }
  }
}

// ---------------------------------------------------------------------------
// Small pure helpers used internally and in tests.
// ---------------------------------------------------------------------------

/**
 * Add `days` to a YYYY-MM-DD string (UTC, no DST shenanigans) and return
 * the same format. Used for building the candidate-date window.
 */
export function shiftDate(isoDate: string, days: number): string {
  const t = Date.parse(isoDate);
  if (Number.isNaN(t)) return isoDate;
  const d = new Date(t + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/**
 * Narrow a full WorkActivity row to the subset the matcher needs.
 */
function toScoringActivity(activity: WorkActivity): ScoringActivity {
  return {
    id: activity.id,
    date: activity.date,
    workType: activity.workType,
    billableHours: activity.billableHours ?? null,
    notes: activity.notes ?? null,
    tasks: activity.tasks ?? null
  };
}
