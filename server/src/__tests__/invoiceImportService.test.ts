import { describe, expect, it } from '@jest/globals';
import {
  classifyLine,
  hasTokenOverlap,
  scoreCandidate,
  shiftDate,
  tokenize,
  toMatchCandidate,
  workTypeMatchesQBOItem,
  type ScoringActivity,
  type ScoringLine
} from '../services/InvoiceImportService';

// NOTE: DB-backed integration tests for relinkLineItem / rematchInvoice / sync
// are intentionally skipped here — the local test_user role isn't reliably
// available (see MEMORY.md re: billableHours.*.test.ts integration setup).
// The state machine is exercised via manual verification per the plan.

const baseActivity = (overrides: Partial<ScoringActivity> = {}): ScoringActivity => ({
  id: 1,
  date: '2025-05-01',
  workType: 'maintenance',
  billableHours: 3,
  notes: 'Trimmed hedges and pulled weeds in the front bed.',
  tasks: null,
  ...overrides
});

const baseLine = (overrides: Partial<ScoringLine> = {}): ScoringLine => ({
  description: 'Trimmed hedges and pulled weeds',
  qty: 3,
  qboItemName: 'Garden maintenance',
  ...overrides
});

describe('tokenize', () => {
  it('lowercases, splits on non-word chars, drops stopwords and short tokens', () => {
    const out = tokenize('The QUICK brown/fox jumped, and the lazy dog!');
    // 'the' stopword, 'and' stopword dropped. Tokens of len<3 dropped.
    expect(out).toEqual(['quick', 'brown', 'fox', 'jumped', 'lazy', 'dog']);
  });

  it('returns empty for null/empty', () => {
    expect(tokenize(null)).toEqual([]);
    expect(tokenize('')).toEqual([]);
  });
});

describe('hasTokenOverlap', () => {
  it('returns true when ≥2 significant tokens overlap', () => {
    expect(hasTokenOverlap('trimmed hedges in front', 'hedges trimmed quickly')).toBe(true);
  });

  it('returns false when fewer than 2 overlap', () => {
    expect(hasTokenOverlap('trimmed hedges', 'mowed lawn')).toBe(false);
    expect(hasTokenOverlap('only hedges', 'hedges alone')).toBe(false); // only 1 overlap
  });

  it('ignores stopwords and short tokens', () => {
    // 'the' and 'a' are stopwords; 'in' too short. Only 'thing' overlaps.
    expect(hasTokenOverlap('the a thing', 'a the thing')).toBe(false);
  });
});

describe('workTypeMatchesQBOItem', () => {
  it('matches mapped names case-insensitively', () => {
    expect(workTypeMatchesQBOItem('maintenance', 'Garden maintenance')).toBe(true);
    expect(workTypeMatchesQBOItem('MAINTENANCE', 'garden maintenance')).toBe(true);
  });

  it('returns false for unmapped workType', () => {
    expect(workTypeMatchesQBOItem('weeding', 'Garden maintenance')).toBe(false);
  });

  it('returns false for null/missing item name', () => {
    expect(workTypeMatchesQBOItem('maintenance', null)).toBe(false);
    expect(workTypeMatchesQBOItem('maintenance', undefined)).toBe(false);
  });
});

describe('shiftDate', () => {
  it('subtracts and adds days', () => {
    expect(shiftDate('2025-05-10', -7)).toBe('2025-05-03');
    expect(shiftDate('2025-05-10', 3)).toBe('2025-05-13');
  });
});

describe('scoreCandidate', () => {
  it('returns ~0 with no overlap, no hours match, far away', () => {
    const activity = baseActivity({
      billableHours: 1.5,
      notes: 'mowed and edged',
      tasks: null,
      date: '2025-01-01',
      workType: 'unmapped'
    });
    const line = baseLine({
      qty: 999,
      description: 'completely unrelated repair work',
      qboItemName: 'Some other item'
    });
    const { score } = scoreCandidate(activity, line, '2025-12-31');
    // 0 hours, 0 token, ~0 proximity (>>90 days), 0 workType.
    expect(score).toBeLessThan(0.1);
  });

  it('+3 hours bonus when within ±0.25', () => {
    const activity = baseActivity({
      billableHours: 3,
      notes: 'something',
      tasks: null,
      date: '2025-05-01',
      workType: 'unmapped'
    });
    const line = baseLine({
      qty: 3.2,
      description: 'no overlap zzz',
      qboItemName: 'Unmapped item'
    });
    // Same day → proximity +1.0; hours match within 0.25 → +3. No tokens, no workType.
    const { score } = scoreCandidate(activity, line, '2025-05-01');
    expect(score).toBeCloseTo(4.0, 5);
  });

  it('does NOT give hours bonus when outside ±0.25', () => {
    const activity = baseActivity({
      billableHours: 3,
      notes: '',
      tasks: null,
      date: '2025-05-01',
      workType: 'unmapped'
    });
    const line = baseLine({
      qty: 3.5,
      description: 'no overlap',
      qboItemName: 'Unmapped'
    });
    const { score } = scoreCandidate(activity, line, '2025-05-01');
    // Only proximity +1.0; no hours match (diff 0.5 > 0.25).
    expect(score).toBeCloseTo(1.0, 5);
  });

  it('+2 token overlap when ≥2 significant tokens shared', () => {
    const activity = baseActivity({
      billableHours: null,
      notes: 'pruned roses and weeded',
      tasks: null,
      date: '2025-05-01',
      workType: 'unmapped'
    });
    const line = baseLine({
      qty: null,
      description: 'pruned roses today',
      qboItemName: 'Unmapped'
    });
    // +2 tokens, +1.0 same-day proximity.
    const { score } = scoreCandidate(activity, line, '2025-05-01');
    expect(score).toBeCloseTo(3.0, 5);
  });

  it('+2 workType bonus when workType maps to QBO item', () => {
    const activity = baseActivity({
      billableHours: null,
      notes: '',
      tasks: null,
      date: '2025-05-01',
      workType: 'maintenance'
    });
    const line = baseLine({
      qty: null,
      description: 'completely unrelated zzz',
      qboItemName: 'Garden maintenance'
    });
    // +2 workType, +1.0 same-day proximity.
    const { score } = scoreCandidate(activity, line, '2025-05-01');
    expect(score).toBeCloseTo(3.0, 5);
  });

  it('proximity scales to ~1.0 same-day, ~0.5 at 45 days, ~0 at 90+ days', () => {
    const activityBase = {
      id: 1,
      workType: 'unmapped',
      billableHours: null,
      notes: '',
      tasks: null
    };
    const line = baseLine({ qty: null, description: 'no overlap', qboItemName: 'Unmapped' });

    const sameDay = scoreCandidate({ ...activityBase, date: '2025-05-01' }, line, '2025-05-01');
    expect(sameDay.score).toBeCloseTo(1.0, 5);

    const halfWay = scoreCandidate({ ...activityBase, date: '2025-03-17' }, line, '2025-05-01'); // 45 days
    expect(halfWay.score).toBeCloseTo(0.5, 1);

    const farPast = scoreCandidate({ ...activityBase, date: '2025-02-01' }, line, '2025-05-01'); // ~89 days
    expect(farPast.score).toBeGreaterThan(0);
    expect(farPast.score).toBeLessThan(0.05);

    const exact90 = scoreCandidate({ ...activityBase, date: '2025-01-31' }, line, '2025-05-01'); // 90 days
    expect(exact90.score).toBeCloseTo(0, 5);
  });
});

describe('classifyLine', () => {
  const mk = (id: number, score: number) => ({
    activity: baseActivity({ id }),
    score,
    reason: `score ${score}`
  });

  it('returns unmatched when no candidates', () => {
    const c = classifyLine([]);
    expect(c.status).toBe('unmatched');
    expect(c.workActivityId).toBeNull();
    expect(c.matchScore).toBeNull();
    expect(c.matchCandidates).toBeNull();
  });

  it('returns auto when top score ≥ HIGH (5)', () => {
    const c = classifyLine([mk(1, 5.0), mk(2, 3.0)]);
    expect(c.status).toBe('auto');
    expect(c.workActivityId).toBe(1);
    expect(c.matchScore).toBe(5);
    expect(c.matchCandidates).toBeNull();
  });

  it('returns needs_review when MIN ≤ top < HIGH, with top-3 candidates', () => {
    const c = classifyLine([mk(1, 4.5), mk(2, 3.0), mk(3, 2.5), mk(4, 2.1)]);
    expect(c.status).toBe('needs_review');
    expect(c.workActivityId).toBeNull();
    expect(c.matchScore).toBe(4.5);
    expect(c.matchCandidates).toHaveLength(3);
    expect(c.matchCandidates![0].workActivityId).toBe(1);
    expect(c.matchCandidates![1].workActivityId).toBe(2);
    expect(c.matchCandidates![2].workActivityId).toBe(3);
  });

  it('returns unmatched when top < MIN (2)', () => {
    const c = classifyLine([mk(1, 1.5), mk(2, 0.5)]);
    expect(c.status).toBe('unmatched');
    expect(c.workActivityId).toBeNull();
    expect(c.matchScore).toBeNull();
    expect(c.matchCandidates).toBeNull();
  });

  it('breaks ties by activity id ASC', () => {
    const c = classifyLine([mk(7, 5.0), mk(2, 5.0), mk(4, 5.0)]);
    expect(c.status).toBe('auto');
    expect(c.workActivityId).toBe(2);
  });
});

describe('toMatchCandidate', () => {
  it('truncates notes snippet to 200 chars', () => {
    const longNote = 'x'.repeat(500);
    const activity = baseActivity({ notes: longNote });
    const out = toMatchCandidate(activity, { score: 3, reason: 'r' });
    expect(out.notesSnippet).toHaveLength(200);
  });

  it('falls back to tasks when notes is empty', () => {
    const activity = baseActivity({ notes: null, tasks: 'do the thing' });
    const out = toMatchCandidate(activity, { score: 3, reason: 'r' });
    expect(out.notesSnippet).toBe('do the thing');
  });
});

// -----------------------------------------------------------------------
// Within-invoice dedup test
// -----------------------------------------------------------------------
// Verifies the dedup contract: callers process lines in descending top-score
// order and remove the claimed activity from the pool for subsequent lines.
// This mirrors what InvoiceImportService.matchInvoiceLines does.
describe('within-invoice dedup', () => {
  it('does not assign the same activity to two lines on the same invoice', () => {
    const activityA = baseActivity({ id: 100, billableHours: 3 });
    const activityB = baseActivity({ id: 200, billableHours: 3 });
    const invoiceDate = '2025-05-01';

    const line1: ScoringLine = {
      description: 'Trimmed hedges',
      qty: 3,
      qboItemName: 'Garden maintenance'
    };
    const line2: ScoringLine = {
      description: 'Pulled weeds',
      qty: 3,
      qboItemName: 'Garden maintenance'
    };

    const scoredLine1 = [activityA, activityB].map((a) => ({
      activity: a,
      ...scoreCandidate(a, line1, invoiceDate)
    }));
    const scoredLine2 = [activityA, activityB].map((a) => ({
      activity: a,
      ...scoreCandidate(a, line2, invoiceDate)
    }));

    // Both lines have similar top scores. Process line1 first (caller's order),
    // dedup activityA, then classify line2 on the filtered pool.
    const decision1 = classifyLine(scoredLine1);
    expect(decision1.status).toBe('auto');
    const claimed = new Set<number>([decision1.workActivityId!]);

    const filtered2 = scoredLine2.filter((s) => !claimed.has(s.activity.id));
    const decision2 = classifyLine(filtered2);
    expect(decision2.status).toBe('auto');
    expect(decision2.workActivityId).not.toBe(decision1.workActivityId);
  });
});
