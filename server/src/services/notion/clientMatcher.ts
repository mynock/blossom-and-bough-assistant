// Client name matching for Notion sync (Levenshtein-based fuzzy match).
// Pure; extracted for testability.

import { debugLog } from '../../utils/logger';

export function calculateSimilarity(str1: string, str2: string): number {
  const a = str1.toLowerCase().trim();
  const b = str2.toLowerCase().trim();

  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const maxLength = Math.max(a.length, b.length);
  const distance = matrix[b.length][a.length];
  return (maxLength - distance) / maxLength;
}

/**
 * Find the best matching client using Levenshtein-based fuzzy matching.
 * Returns the match only when similarity >= 0.85; otherwise null.
 */
export function findBestClientMatch(
  clientName: string,
  existingClients: any[]
): { client: any; similarity: number } | null {
  debugLog.info(`🔍 Finding best match for client: "${clientName}"`);
  debugLog.info(`📋 Available clients: ${existingClients.map(c => c.name).join(', ')}`);

  let bestMatch: any = null;
  let bestSimilarity = 0;

  for (const client of existingClients) {
    const similarity = calculateSimilarity(clientName, client.name);
    debugLog.info(`📊 Similarity "${clientName}" vs "${client.name}": ${(similarity * 100).toFixed(1)}%`);

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = client;
    }
  }

  if (bestSimilarity >= 0.85) {
    debugLog.info(`✅ Found good match: "${clientName}" → "${bestMatch.name}" (${(bestSimilarity * 100).toFixed(1)}%)`);
    return { client: bestMatch, similarity: bestSimilarity };
  }

  debugLog.info(`❌ No good match found for "${clientName}" (best: ${(bestSimilarity * 100).toFixed(1)}%)`);
  return null;
}
