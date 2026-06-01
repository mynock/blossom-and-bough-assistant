// Pure helpers for matching QBO customers to local CRM clients.
//
// Context: CRM clients are stored by surname only (e.g. "Thomas"), while QBO
// customers carry full display names ("Steve and Jackie Thomas", "Erickson
// Realty", "Matt Leid and Kourtney Foley"). Exact-name matching therefore never
// works. These helpers match a client's name as a whole *token* inside the QBO
// display name, and return ALL matches so callers can apply a single-candidate
// guard (a couple with two surnames, or two clients sharing a surname, is
// ambiguous and must not be auto-linked).

export type ClientNameRecord = { id: number; name: string };

// Joiner words that should never count as a surname token.
const JOINERS = new Set(['and', 'or', 'the', 'of']);

/**
 * Split a name into lowercased alphanumeric tokens, dropping joiner words.
 * "Steve and Jackie Thomas" -> ["steve", "jackie", "thomas"]
 * "St. Clair"               -> ["st", "clair"]
 */
export function nameTokens(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 0 && !JOINERS.has(t));
}

/**
 * Return every client whose name appears as a whole token (or, for multi-word
 * names, all of whose tokens appear) inside the QBO display name. Whole-token,
 * not substring — "Smith" does NOT match "Blacksmith".
 *
 * Callers apply the single-candidate guard: exactly one match -> link; zero or
 * more than one -> leave for manual mapping.
 */
export function matchClientsByName<T extends ClientNameRecord>(
  qboName: string,
  clients: T[]
): T[] {
  const tokens = new Set(nameTokens(qboName));
  if (tokens.size === 0) return [];
  return clients.filter((c) => {
    const ct = nameTokens(c.name);
    return ct.length > 0 && ct.every((t) => tokens.has(t));
  });
}
