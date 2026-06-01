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
  type OtherCharge,
  type MatchCandidateJSON
} from '../db';
import { and, asc, eq, gte, ilike, inArray, isNotNull, lte, ne, sql } from 'drizzle-orm';
import type { QBOInvoice, QuickBooksService } from './QuickBooksService';
import { workTypeMapping, type InvoiceService } from './InvoiceService';
import type { WorkActivityService } from './WorkActivityService';
import type { NotificationService } from './NotificationService';
import { matchClientsByName } from './clientMatching';

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
  // Set to true when the run was a dry run — NO database changes were made.
  dryRun?: boolean;
  // Per-invoice breakdown of what WOULD happen. Only populated on dry runs so
  // the operator can judge match quality before committing real writes.
  preview?: SyncPreviewInvoice[];
  // Cross-invoice collisions: the same work activity strongly matched more than
  // one invoice in this run. Only populated on dry runs. A real run resolves
  // these by giving the activity to the older invoice (processed first) and
  // leaving the newer one to manual review — so these are quality signals worth
  // eyeballing, not hard failures.
  duplicateMatches?: DuplicateMatch[];
};

export type DuplicateMatch = {
  activityId: number;
  lineDescription: string;
  // The newer invoice that would NOT get the activity in a real run.
  invoiceNumber: string;
  // The older invoice that claims the activity first.
  claimedByInvoiceNumber: string;
};

export type SyncPreviewLine = {
  description: string;
  amount: number;
  kind: 'labor' | 'material';
  status: 'auto' | 'needs_review' | 'unmatched';
  // For auto/needs_review labor: the top candidate's activity id + score.
  matchedActivityId: number | null;
  matchScore: number | null;
  // Set when this line's auto-match collides with an activity already claimed
  // by an earlier (older) invoice in the same run — value is that invoice number.
  duplicateOf?: string;
};

export type SyncPreviewInvoice = {
  qboInvoiceId: string;
  invoiceNumber: string;
  customerName: string;
  // 'import' = new invoice would be created; 'update' = existing invoice's
  // status/total would refresh (line items untouched); 'skip' = no client match.
  action: 'import' | 'update' | 'skip';
  lines: SyncPreviewLine[];
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

// Re-export the persisted JSON shape under the in-service name for callers
// that already import MatchCandidate from here.
export type MatchCandidate = MatchCandidateJSON;

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

// Output of the matcher for a single labor line.
type LaborDecision = {
  status: 'auto' | 'needs_review' | 'unmatched';
  workActivityId: number | null;
  matchScore: number | null;
  matchCandidates: MatchCandidate[] | null;
};

// Output of the matcher for a single material line.
type MaterialDecision = {
  status: 'auto' | 'unmatched';
  otherChargeId: number | null;
};

// Input shape for `runMatcher` — abstracts over whether the line came from
// a live QBO invoice (key = lineIndex) or a persisted DB row (key = lineId).
type NormalizedLine<K> = {
  key: K;
  qboItemId: string | null;
  description: string;
  qty: number | null;
  amount: number;
};

type MatcherOutput<K> = {
  laborDecisions: Map<K, LaborDecision>;
  materialDecisions: Map<K, MaterialDecision>;
};

export class InvoiceImportService extends DatabaseService {
  // Collaborators injected via the container — see services/container.ts.
  // Holding references locally instead of reaching back into the container
  // each call makes the service testable in isolation and avoids the
  // module-level circular import the singleton pattern would introduce.
  constructor(
    private readonly quickBooksService: QuickBooksService,
    private readonly invoiceService: InvoiceService,
    private readonly workActivityService: WorkActivityService,
    private readonly notificationService: NotificationService
  ) {
    super();
  }

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
   *
   * When `dryRun` is true, NO database writes happen: the matcher still runs
   * and the same counts are returned, plus a per-invoice `preview`, so the
   * operator can evaluate match quality before committing.
   *
   * `since` / `until` bound the run to invoices whose QBO TxnDate falls in
   * [since, until] (either end optional). Both are 'YYYY-MM-DD'. NOTE: the
   * window is applied after fetching all invoices from QBO, so it bounds what
   * gets written locally — not the QBO API pull.
   */
  async syncAllInvoices(opts?: { since?: string; until?: string; dryRun?: boolean }): Promise<SyncResult> {
    const dryRun = opts?.dryRun ?? false;
    const result: SyncResult = {
      imported: 0,
      updated: 0,
      autoMatched: 0,
      needsReview: 0,
      unmatched: 0,
      errors: [],
      ...(dryRun ? { dryRun: true, preview: [], duplicateMatches: [] } : {})
    };

    let qboInvoices: QBOInvoice[];
    try {
      qboInvoices = await this.quickBooksService.getAllInvoices();
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
    if (opts?.until) {
      const until = opts.until;
      qboInvoices = qboInvoices.filter((inv) => inv.TxnDate && inv.TxnDate <= until);
    }

    // Sort by TxnDate ASC so older invoices claim older work activities first.
    // Without this, matcher results vary with QBO's response order.
    qboInvoices.sort((a, b) => (a.TxnDate || '').localeCompare(b.TxnDate || ''));

    // In a real run, cross-invoice dedup happens because each auto-match flips
    // the activity to 'invoiced' before the next invoice's candidate query runs,
    // so the older invoice (processed first) wins. A dry run commits nothing, so
    // we track who claimed each activity in memory: activityId → claimer invoice
    // number. Later invoices that also auto-match a claimed activity are flagged
    // as duplicates rather than silently double-counting it.
    const claimedInRun = dryRun ? new Map<number, string>() : undefined;

    for (const qboInvoice of qboInvoices) {
      try {
        await this.processInvoice(qboInvoice, result, dryRun, claimedInRun);
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
   *
   * `dryRun` skips every write; `claimedInRun` (dry-run only) tracks activities
   * already auto-claimed earlier in the run so the preview doesn't double-count.
   */
  private async processInvoice(
    qboInvoice: QBOInvoice,
    result: SyncResult,
    dryRun: boolean,
    claimedInRun?: Map<number, string>
  ): Promise<void> {
    const clientId = await this.resolveClientId(qboInvoice, result, dryRun);
    if (clientId == null) {
      if (dryRun) {
        result.preview!.push({
          qboInvoiceId: qboInvoice.Id,
          invoiceNumber: qboInvoice.DocNumber || qboInvoice.Id,
          customerName: qboInvoice.CustomerRef.name || '',
          action: 'skip',
          lines: []
        });
      }
      return;
    }

    const existing = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.qboInvoiceId, qboInvoice.Id))
      .limit(1);

    if (existing[0]) {
      // UPDATE path: refresh metadata only; do NOT rewrite line items so we
      // don't blow away 'manual' relinks the user has made since import.
      if (!dryRun) {
        await this.db
          .update(invoices)
          .set({
            status: this.invoiceService.mapQBOInvoiceStatus(qboInvoice),
            totalAmount: qboInvoice.TotalAmt,
            dueDate: qboInvoice.DueDate || null,
            qboSyncAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(invoices.id, existing[0].id));
      }
      result.updated++;
      if (dryRun) {
        result.preview!.push({
          qboInvoiceId: qboInvoice.Id,
          invoiceNumber: qboInvoice.DocNumber || qboInvoice.Id,
          customerName: qboInvoice.CustomerRef.name || '',
          action: 'update',
          lines: []
        });
      }
      return;
    }

    // INSERT path: persist invoice + line items + run matcher.
    let matcherResult: MatcherOutput<number>;
    try {
      const lines: NormalizedLine<number>[] = qboInvoice.Line.map((line, lineIndex) => ({
        key: lineIndex,
        qboItemId: line.SalesItemLineDetail?.ItemRef?.value ?? null,
        description: line.Description || '',
        qty: line.SalesItemLineDetail?.Qty ?? null,
        amount: line.Amount
      }));
      matcherResult = await this.runMatcher(lines, clientId, qboInvoice.TxnDate);
    } catch (error) {
      result.errors.push({
        type: 'matcher_failed',
        qboInvoiceId: qboInvoice.Id,
        message: error instanceof Error ? error.message : String(error)
      });
      // Still insert the invoice with unmatched lines so the user has a record.
      matcherResult = { laborDecisions: new Map(), materialDecisions: new Map() };
    }

    // Labor lines that auto-matched an activity already claimed by an earlier
    // (older) invoice in this dry run. Keyed by line index → older claimer.
    const invoiceNumber = qboInvoice.DocNumber || qboInvoice.Id;
    const duplicateLines = new Map<number, string>();
    if (dryRun && claimedInRun) {
      for (const [lineIndex, decision] of matcherResult.laborDecisions) {
        if (decision.status !== 'auto' || decision.workActivityId == null) continue;
        const claimer = claimedInRun.get(decision.workActivityId);
        if (claimer) {
          // Already claimed by an older invoice → flag, don't re-claim.
          duplicateLines.set(lineIndex, claimer);
          result.duplicateMatches!.push({
            activityId: decision.workActivityId,
            lineDescription: qboInvoice.Line[lineIndex]?.Description || '',
            invoiceNumber,
            claimedByInvoiceNumber: claimer
          });
        } else {
          // First (oldest) invoice to claim this activity wins it.
          claimedInRun.set(decision.workActivityId, invoiceNumber);
        }
      }
    }

    // Activities auto-matched on this invoice — flipped to 'invoiced' in a real run.
    const autoActivityIds: number[] = [];
    for (const decision of matcherResult.laborDecisions.values()) {
      if (decision.status === 'auto' && decision.workActivityId != null) {
        autoActivityIds.push(decision.workActivityId);
      }
    }

    if (dryRun) {
      result.preview!.push(buildPreviewInvoice(qboInvoice, matcherResult, duplicateLines));
      tallyLabor(matcherResult.laborDecisions, result, duplicateLines);
      tallyMaterial(matcherResult.materialDecisions, result);
      result.imported++;
      return;
    }

    // Real run: persist invoice + line items, flip activity statuses atomically.
    await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(invoices)
        .values({
          qboInvoiceId: qboInvoice.Id,
          qboCustomerId: qboInvoice.CustomerRef.value,
          clientId,
          invoiceNumber: qboInvoice.DocNumber,
          status: this.invoiceService.mapQBOInvoiceStatus(qboInvoice),
          totalAmount: qboInvoice.TotalAmt,
          invoiceDate: qboInvoice.TxnDate,
          dueDate: qboInvoice.DueDate || null,
          qboSyncAt: new Date()
        })
        .returning();
      const localInvoiceId = inserted[0].id;

      // Build line item rows from the QBO invoice. Decisions are keyed by
      // lineIndex; labor and material maps are mutually exclusive per line.
      const lineRows = qboInvoice.Line.map((line, lineIndex) => {
        const labor = matcherResult.laborDecisions.get(lineIndex);
        const material = matcherResult.materialDecisions.get(lineIndex);
        return {
          invoiceId: localInvoiceId,
          workActivityId: labor?.workActivityId ?? null,
          otherChargeId: material?.otherChargeId ?? null,
          qboItemId: line.SalesItemLineDetail?.ItemRef?.value || null,
          description: line.Description || '',
          quantity: line.SalesItemLineDetail?.Qty ?? 0,
          rate: line.SalesItemLineDetail?.UnitPrice ?? 0,
          amount: line.Amount,
          matchStatus: labor?.status ?? material?.status ?? ('unmatched' as const),
          matchScore: labor?.matchScore ?? null,
          matchCandidates: labor?.matchCandidates ?? null
        };
      });

      if (lineRows.length > 0) {
        await tx.insert(invoiceLineItems).values(lineRows);
      }

      // Flip status for any 'auto'-matched labor activities (materials don't
      // flip activity status — they live on already-completed activities).
      if (autoActivityIds.length > 0) {
        await this.workActivityService.setStatus(autoActivityIds, 'invoiced', tx);
      }
    });

    result.imported++;
    tallyLabor(matcherResult.laborDecisions, result);
    tallyMaterial(matcherResult.materialDecisions, result);
  }

  /**
   * Resolve a local client for a QBO invoice. Tries qboCustomerId, then a
   * case-insensitive name match (with opportunistic backfill). Returns null
   * and writes an `unmatched_client` notification when no match is found.
   */
  private async resolveClientId(
    qboInvoice: QBOInvoice,
    result: SyncResult,
    dryRun: boolean
  ): Promise<number | null> {
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
          // Backfill is a write — skip it on a dry run.
          if (!dryRun) {
            await this.db
              .update(clients)
              .set({ qboCustomerId, updatedAt: new Date() })
              .where(eq(clients.id, byName[0].id));
          }
        } else if (byName[0].qboCustomerId !== qboCustomerId) {
          console.warn(
            `Client "${customerName.trim()}" (id=${byName[0].id}) already has qboCustomerId="${byName[0].qboCustomerId}" but invoice references qboCustomerId="${qboCustomerId}" — leaving existing mapping in place. Possible duplicate client.`
          );
        }
        return byName[0].id;
      }
    }

    // 2.5) Surname fallback: CRM clients are stored by surname while QBO carries
    // full names. Match the client name as a whole token inside the QBO name,
    // considering only UNLINKED clients so explicit mappings are never
    // overridden. Auto-link only on a unique match — a couple with two surnames,
    // or two clients sharing a surname, is left for the client-mapping UI.
    if (customerName.trim()) {
      const candidates = (
        await this.db
          .select({ id: clients.id, name: clients.name, qboCustomerId: clients.qboCustomerId })
          .from(clients)
          .where(sql`lower(${customerName}) like '%' || lower(${clients.name}) || '%'`)
      ).filter((c) => !c.qboCustomerId);
      const matched = matchClientsByName(customerName, candidates);
      if (matched.length === 1) {
        // Backfill the link on a real run so future invoices match by id.
        if (!dryRun) {
          await this.db
            .update(clients)
            .set({ qboCustomerId, updatedAt: new Date() })
            .where(eq(clients.id, matched[0].id));
        }
        return matched[0].id;
      }
    }

    // 3) No match — record an error (and, on a real run, a notification).
    const message = `No local client matches "${customerName}"`;
    result.errors.push({
      type: 'unmatched_client',
      qboInvoiceId: qboInvoice.Id,
      message
    });
    if (!dryRun) {
      await this.notificationService.notifyQBOUnmatchedClient({
        qboInvoiceId: qboInvoice.Id,
        qboInvoiceNumber: qboInvoice.DocNumber || qboInvoice.Id,
        qboCustomerId,
        customerName
      });
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Matching
  // -----------------------------------------------------------------------

  /**
   * Core matcher pipeline used by both initial sync (lines keyed by lineIndex)
   * and rematch (lines keyed by lineId).
   *
   * For each line:
   *   - Inventory / NonInventory items → material matching (description + amount fuzzy).
   *   - Service / unknown items → labor matching (scoring against candidate activities).
   *
   * Within-invoice dedup: labor lines are processed in descending top-score
   * order so the strongest match wins, and claimed activities are removed
   * from the candidate pool of subsequent lines.
   *
   * This matches the full candidate pool every time. Cross-invoice dedup lives
   * at the caller: a real sync flips claimed activities to 'invoiced' so they
   * drop out of the next invoice's candidate query; a dry run reconciles claims
   * in memory (see processInvoice) and flags collisions as duplicate matches.
   */
  private async runMatcher<K>(
    lines: NormalizedLine<K>[],
    clientId: number,
    invoiceDate: string
  ): Promise<MatcherOutput<K>> {
    const windowStart = shiftDate(invoiceDate, -CANDIDATE_WINDOW_DAYS);

    // Candidate activities: same client, completed, within window.
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
    const scoringActivities = candidateActivities.map(toScoringActivity);

    // Resolve qbo_items types/names for the lines.
    const qboItemIds = Array.from(
      new Set(lines.map((l) => l.qboItemId).filter((v): v is string => !!v))
    );
    const itemRows = qboItemIds.length
      ? await this.db.select().from(qboItems).where(inArray(qboItems.qboId, qboItemIds))
      : [];
    const itemTypeById = new Map(itemRows.map((it) => [it.qboId, it.type]));
    const itemNameById = new Map(itemRows.map((it) => [it.qboId, it.name]));

    // Partition lines into labor vs material.
    const laborLines: Array<{
      key: K;
      scored: Array<{ activity: ScoringActivity; score: number; reason: string }>;
    }> = [];
    const materialLines: Array<{ key: K; description: string; amount: number }> = [];

    for (const line of lines) {
      const itemType = line.qboItemId ? itemTypeById.get(line.qboItemId) : undefined;
      const itemName = line.qboItemId ? itemNameById.get(line.qboItemId) : undefined;
      if (itemType === 'Inventory' || itemType === 'NonInventory') {
        materialLines.push({ key: line.key, description: line.description, amount: line.amount });
        continue;
      }
      const scoringLine: ScoringLine = {
        description: line.description,
        qty: line.qty,
        qboItemName: itemName ?? null
      };
      const scored = scoringActivities.map((sa) => ({
        activity: sa,
        ...scoreCandidate(sa, scoringLine, invoiceDate)
      }));
      laborLines.push({ key: line.key, scored });
    }

    // Labor within-invoice dedup, descending top-score order.
    const orderedByTopScore = [...laborLines].sort((a, b) => {
      const ta = a.scored.length ? Math.max(...a.scored.map((s) => s.score)) : 0;
      const tb = b.scored.length ? Math.max(...b.scored.map((s) => s.score)) : 0;
      return tb - ta;
    });

    const claimedActivityIds = new Set<number>();
    const laborDecisions = new Map<K, LaborDecision>();
    for (const { key, scored } of orderedByTopScore) {
      const filtered = scored.filter((s) => !claimedActivityIds.has(s.activity.id));
      const decision = classifyLine(filtered);
      if (decision.status === 'auto' && decision.workActivityId != null) {
        claimedActivityIds.add(decision.workActivityId);
      }
      laborDecisions.set(key, decision);
    }

    // Material matching: candidate charges from the candidate activities.
    // Auto-match only when exactly one charge matches both description and amount.
    const candidateActivityIds = candidateActivities.map((a) => a.id);
    const candidateCharges: OtherCharge[] = candidateActivityIds.length
      ? ((await this.db
          .select()
          .from(otherCharges)
          .where(inArray(otherCharges.workActivityId, candidateActivityIds))) as OtherCharge[])
      : [];

    const materialDecisions = new Map<K, MaterialDecision>();
    for (const ml of materialLines) {
      const desc = ml.description.trim();
      const hits = desc
        ? candidateCharges.filter((c) => matchCharge(c, desc, ml.amount))
        : [];
      materialDecisions.set(
        ml.key,
        hits.length === 1
          ? { status: 'auto', otherChargeId: hits[0].id }
          : { status: 'unmatched', otherChargeId: null }
      );
    }

    return { laborDecisions, materialDecisions };
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

    // Run the matcher keyed by line id (vs the initial sync's lineIndex).
    const normalizedLines: NormalizedLine<number>[] = linesToRematch.map((line) => ({
      key: line.id,
      qboItemId: line.qboItemId,
      description: line.description,
      qty: line.quantity ?? null,
      amount: line.amount
    }));
    const { laborDecisions, materialDecisions } = await this.runMatcher(
      normalizedLines,
      invoice.clientId,
      invoice.invoiceDate
    );

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
            matchCandidates: decision.matchCandidates ?? null,
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
        await this.workActivityService.setStatus(newAutoActivityIds, 'invoiced', tx);
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
          await this.workActivityService.setStatus([workActivityId], 'invoiced', tx);
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

        // Raw insert (not via NotificationService) so this stays atomic with the
        // line-item update inside the transaction. NotificationService.create
        // uses its own connection and can't participate in this tx.
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
          }
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
      candidates: r.candidates ?? null
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
      await this.workActivityService.setStatus(orphaned, 'completed', tx);
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

/**
 * Material-line predicate: description matches fuzzily (exact, contains, or
 * contained-by, case-insensitive) AND totalCost is within $0.01 of the line.
 */
function matchCharge(charge: OtherCharge, desc: string, amount: number): boolean {
  const cd = charge.description?.toLowerCase() || '';
  const ld = desc.toLowerCase();
  if (!(cd === ld || cd.includes(ld) || ld.includes(cd))) return false;
  return typeof charge.totalCost === 'number' && Math.abs(charge.totalCost - amount) <= 0.01;
}

function tallyLabor<K>(
  decisions: Map<K, LaborDecision>,
  result: { autoMatched: number; needsReview: number; unmatched: number },
  // Dry-run only: line keys whose auto-match collides with an older invoice.
  // These are NOT counted as auto-matched (the older invoice keeps the
  // activity); they're surfaced via result.duplicateMatches instead.
  duplicateLines?: Map<K, string>
): void {
  for (const [key, d] of decisions) {
    if (duplicateLines?.has(key)) continue;
    if (d.status === 'auto') result.autoMatched++;
    else if (d.status === 'needs_review') result.needsReview++;
    else result.unmatched++;
  }
}

function tallyMaterial(
  decisions: Map<unknown, MaterialDecision>,
  result: { autoMatched: number; unmatched: number }
): void {
  for (const d of decisions.values()) {
    if (d.status === 'auto') result.autoMatched++;
    else result.unmatched++;
  }
}

/**
 * Build the per-invoice dry-run preview from a QBO invoice and its matcher
 * output. Decisions are keyed by line index; a line is labor or material
 * depending on which map holds it.
 */
function buildPreviewInvoice(
  qboInvoice: QBOInvoice,
  matcherResult: MatcherOutput<number>,
  duplicateLines?: Map<number, string>
): SyncPreviewInvoice {
  const lines: SyncPreviewLine[] = qboInvoice.Line.map((line, lineIndex) => {
    const labor = matcherResult.laborDecisions.get(lineIndex);
    const material = matcherResult.materialDecisions.get(lineIndex);
    return {
      description: line.Description || '',
      amount: line.Amount,
      kind: material ? 'material' : 'labor',
      status: labor?.status ?? material?.status ?? 'unmatched',
      matchedActivityId: labor?.workActivityId ?? null,
      matchScore: labor?.matchScore ?? null,
      ...(duplicateLines?.has(lineIndex) ? { duplicateOf: duplicateLines.get(lineIndex) } : {})
    };
  });
  return {
    qboInvoiceId: qboInvoice.Id,
    invoiceNumber: qboInvoice.DocNumber || qboInvoice.Id,
    customerName: qboInvoice.CustomerRef.name || '',
    action: 'import',
    lines
  };
}
