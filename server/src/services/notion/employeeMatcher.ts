// Employee name matching for Notion sync. Pure; extracted for testability.

import { debugLog } from '../../utils/logger';
import type { Employee } from '../../db/schema';

// Split a name into lowercase tokens on whitespace and hyphens, dropping blanks.
// Used for whole-token name matching (see findEmployeeMatch).
export function tokenize(name: string): string[] {
  return name.toLowerCase().split(/[\s-]+/).filter(Boolean);
}

/**
 * Find an employee by name. Matches in this order:
 *   1. Exact full name (case-insensitive).
 *   2. Whole-token match: every token of the shorter name appears as a complete
 *      token of the longer name. So "Anne" matches "Anne McGary" (because "anne"
 *      is a token of "Anne McGary"), but "An" does NOT match "Anne McGary"
 *      (because "an" is not a token of "Anne McGary"), and "Andy" does NOT
 *      match "Andrea Wilson" (no shared tokens).
 *
 * If more than one candidate matches at the token level the result is treated
 * as ambiguous: returns null so the caller auto-creates with a visible warning
 * rather than silently picking the wrong person.
 *
 * Does NOT do nickname/variant matching - "Andy" will not match "Andrea".
 */
export function findEmployeeMatch(
  searchName: string,
  employees: Employee[]
): { match: Employee | null; ambiguousCandidates?: Employee[] } {
  const search = searchName.toLowerCase().trim();
  if (!search) return { match: null };

  const exact = employees.find(emp => emp.name.toLowerCase().trim() === search);
  if (exact) {
    debugLog.info(`   📍 Found exact match: "${searchName}" = "${exact.name}"`);
    return { match: exact };
  }

  const searchTokens = tokenize(search);
  if (searchTokens.length === 0) return { match: null };

  const tokenMatches = employees.filter(emp => {
    const empTokens = tokenize(emp.name);
    if (empTokens.length === 0) return false;
    const [shorter, longer] =
      searchTokens.length <= empTokens.length
        ? [searchTokens, empTokens]
        : [empTokens, searchTokens];
    return shorter.every(t => longer.includes(t));
  });

  if (tokenMatches.length === 1) {
    const match = tokenMatches[0];
    debugLog.info(`   📍 Found token match: "${searchName}" ~ "${match.name}"`);
    return { match };
  }

  if (tokenMatches.length > 1) {
    const names = tokenMatches.map(e => e.name).join(', ');
    debugLog.warn(`   ⚠️ Ambiguous match for "${searchName}" - candidates: ${names}. Treating as unmatched.`);
    return { match: null, ambiguousCandidates: tokenMatches };
  }

  debugLog.info(`   ❌ No match found for "${searchName}"`);
  return { match: null };
}
