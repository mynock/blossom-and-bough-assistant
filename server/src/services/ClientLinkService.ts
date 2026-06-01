import { DatabaseService } from './DatabaseService';
import { clients } from '../db';
import { eq } from 'drizzle-orm';
import type { QuickBooksService } from './QuickBooksService';
import { matchClientsByName } from './clientMatching';

// A CRM client as exposed to the mapping UI.
export type MappingClient = {
  id: number;
  name: string;
  qboCustomerId: string | null;
};

// One QBO customer row in the mapping table.
export type CustomerMappingRow = {
  qboCustomerId: string;
  qboName: string;
  // Client currently linked to this QBO customer (qbo_customer_id == this id).
  linkedClientId: number | null;
  // Confident single surname match among currently-unlinked clients, if any.
  suggestedClientId: number | null;
  // All surname matches (>1 means ambiguous — e.g. a two-surname couple).
  candidateClientIds: number[];
};

export type MappingState = {
  clients: MappingClient[];
  customers: CustomerMappingRow[];
};

// One change the operator wants to persist. clientId null clears the link.
export type MappingChange = { qboCustomerId: string; clientId: number | null };

export class ClientLinkService extends DatabaseService {
  constructor(private readonly quickBooksService: QuickBooksService) {
    super();
  }

  /**
   * Build the mapping table: every QBO customer, its current local link, and a
   * suggested client (confident single surname match among unlinked clients).
   *
   * Suggestion guard: a client suggested for two different customers, or a
   * customer matching two clients, yields NO suggestion — those are left for
   * manual resolution so we never auto-pick an ambiguous link.
   */
  async getMappingState(): Promise<MappingState> {
    const [qboCustomers, clientRows] = await Promise.all([
      this.quickBooksService.getAllCustomers(),
      this.db
        .select({ id: clients.id, name: clients.name, qboCustomerId: clients.qboCustomerId })
        .from(clients)
    ]);

    const linkedByQboId = new Map<string, number>();
    for (const c of clientRows) {
      if (c.qboCustomerId) linkedByQboId.set(c.qboCustomerId, c.id);
    }
    const unlinkedClients = clientRows.filter((c) => !c.qboCustomerId);

    // First pass: raw single-match suggestions.
    const rows: CustomerMappingRow[] = qboCustomers.map((cust) => {
      const matches = matchClientsByName(cust.DisplayName || '', unlinkedClients);
      const linkedClientId = linkedByQboId.get(cust.Id) ?? null;
      return {
        qboCustomerId: cust.Id,
        qboName: cust.DisplayName || '',
        linkedClientId,
        suggestedClientId: !linkedClientId && matches.length === 1 ? matches[0].id : null,
        candidateClientIds: matches.map((m) => m.id)
      };
    });

    // Second pass: drop suggestions that collide — the same client suggested to
    // more than one customer can't be auto-applied to all of them.
    const suggestCount = new Map<number, number>();
    for (const r of rows) {
      if (r.suggestedClientId != null) {
        suggestCount.set(r.suggestedClientId, (suggestCount.get(r.suggestedClientId) ?? 0) + 1);
      }
    }
    for (const r of rows) {
      if (r.suggestedClientId != null && (suggestCount.get(r.suggestedClientId) ?? 0) > 1) {
        r.suggestedClientId = null;
      }
    }

    return { clients: clientRows, customers: rows };
  }

  /**
   * Persist mapping changes. Each change sets (or clears) the qbo_customer_id on
   * the chosen client. Runs in two phases inside one transaction — clear every
   * affected QBO id / client first, then set — so the unique qbo_customer_id
   * constraint never trips on a transient state mid-batch.
   *
   * Validates that no QBO customer and no client appears twice, since either
   * would be a contradictory instruction.
   */
  async applyMappings(changes: MappingChange[]): Promise<{ applied: number }> {
    const seenQbo = new Set<string>();
    const seenClient = new Set<number>();
    for (const ch of changes) {
      if (seenQbo.has(ch.qboCustomerId)) {
        throw new Error(`Duplicate QBO customer in request: ${ch.qboCustomerId}`);
      }
      seenQbo.add(ch.qboCustomerId);
      if (ch.clientId != null) {
        if (seenClient.has(ch.clientId)) {
          throw new Error(`Client ${ch.clientId} mapped to more than one QBO customer`);
        }
        seenClient.add(ch.clientId);
      }
    }

    await this.db.transaction(async (tx) => {
      // Phase 1: free every QBO id and target client involved. Clearing both
      // sides first means Phase 2 can never hit the unique qbo_customer_id
      // constraint on a transient mid-batch state.
      for (const ch of changes) {
        await tx
          .update(clients)
          .set({ qboCustomerId: null, updatedAt: new Date() })
          .where(eq(clients.qboCustomerId, ch.qboCustomerId));
        if (ch.clientId != null) {
          await tx
            .update(clients)
            .set({ qboCustomerId: null, updatedAt: new Date() })
            .where(eq(clients.id, ch.clientId));
        }
      }
      // Phase 2: apply the new links.
      for (const ch of changes) {
        if (ch.clientId != null) {
          await tx
            .update(clients)
            .set({ qboCustomerId: ch.qboCustomerId, updatedAt: new Date() })
            .where(eq(clients.id, ch.clientId));
        }
      }
    });

    return { applied: changes.length };
  }
}
