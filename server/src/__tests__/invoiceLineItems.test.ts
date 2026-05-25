import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import {
  normalizeInvoiceLineItems,
  resolveInvoicedWorkActivityIds,
  pickSuggestionRate,
  computeChargeLineMath,
  InvoiceLineItemData
} from '../services/InvoiceService';

const baseLine = (overrides: Partial<InvoiceLineItemData> = {}): InvoiceLineItemData => ({
  qboItemId: 'qbo-1',
  description: 'Garden maintenance.',
  quantity: 2,
  rate: 55,
  amount: 0,
  ...overrides
});

describe('normalizeInvoiceLineItems', () => {
  it('recomputes amount from quantity × rate, ignoring the submitted amount', () => {
    const result = normalizeInvoiceLineItems([
      baseLine({ quantity: 2, rate: 55, amount: 999_999 })
    ]);
    expect(result[0].amount).toBe(110);
  });

  it('preserves workActivityId and otherChargeId', () => {
    const result = normalizeInvoiceLineItems([
      baseLine({ workActivityId: 42, otherChargeId: 7 })
    ]);
    expect(result[0].workActivityId).toBe(42);
    expect(result[0].otherChargeId).toBe(7);
  });

  it('throws when qboItemId is missing', () => {
    expect(() =>
      normalizeInvoiceLineItems([baseLine({ qboItemId: '' })])
    ).toThrow(/missing qboItemId/);
  });

  it('throws when quantity is zero or negative', () => {
    expect(() =>
      normalizeInvoiceLineItems([baseLine({ quantity: 0 })])
    ).toThrow(/quantity > 0/);
    expect(() =>
      normalizeInvoiceLineItems([baseLine({ quantity: -1 })])
    ).toThrow(/quantity > 0/);
  });

  it('throws when rate is negative', () => {
    expect(() =>
      normalizeInvoiceLineItems([baseLine({ rate: -0.01 })])
    ).toThrow(/rate >= 0/);
  });

  it('accepts a zero rate (free line)', () => {
    const result = normalizeInvoiceLineItems([baseLine({ rate: 0 })]);
    expect(result[0].amount).toBe(0);
  });

  it('defaults missing description to empty string', () => {
    const result = normalizeInvoiceLineItems([
      baseLine({ description: undefined as unknown as string })
    ]);
    expect(result[0].description).toBe('');
  });

  it('reports the offending line number in the error message', () => {
    expect(() =>
      normalizeInvoiceLineItems([
        baseLine(),
        baseLine({ qboItemId: '' })
      ])
    ).toThrow(/Line 2/);
  });
});

describe('resolveInvoicedWorkActivityIds', () => {
  it('prefers the explicit selection over what survived on the line items', () => {
    const ids = resolveInvoicedWorkActivityIds(
      [1, 2, 3],
      [baseLine({ workActivityId: 1 })] // user removed labor lines for 2 and 3
    );
    expect(ids.sort()).toEqual([1, 2, 3]);
  });

  it('deduplicates the selection', () => {
    expect(resolveInvoicedWorkActivityIds([1, 1, 2], [])).toEqual([1, 2]);
  });

  it('falls back to line-item workActivityIds when no selection provided', () => {
    const ids = resolveInvoicedWorkActivityIds(
      undefined,
      [
        baseLine({ workActivityId: 5 }),
        baseLine({ workActivityId: 6 }),
        baseLine({ otherChargeId: 9 }) // no workActivityId — should be filtered
      ]
    );
    expect(ids.sort()).toEqual([5, 6]);
  });

  it('returns empty when neither source has IDs', () => {
    expect(resolveInvoicedWorkActivityIds(undefined, [baseLine()])).toEqual([]);
    expect(resolveInvoicedWorkActivityIds([], [baseLine()])).toEqual([]);
  });
});

describe('pickSuggestionRate', () => {
  it('uses the QBO item unitPrice for a specific match', () => {
    expect(pickSuggestionRate('specific', { unitPrice: 12.5 })).toBe(12.5);
  });

  it('returns 0 for category/fuzzy/fallback/none matches', () => {
    expect(pickSuggestionRate('category', { unitPrice: 12.5 })).toBe(0);
    expect(pickSuggestionRate('fuzzy', { unitPrice: 12.5 })).toBe(0);
    expect(pickSuggestionRate('fallback', { unitPrice: 12.5 })).toBe(0);
    expect(pickSuggestionRate('none', null)).toBe(0);
  });

  it('returns 0 when a specific match has no unitPrice', () => {
    expect(pickSuggestionRate('specific', null)).toBe(0);
    expect(pickSuggestionRate('specific', { unitPrice: 0 })).toBe(0);
    expect(pickSuggestionRate('specific', { unitPrice: null })).toBe(0);
  });
});

describe('computeChargeLineMath', () => {
  it('handles a charge with only totalCost (the "Lonicera (Tony\'s): $25" case)', () => {
    expect(computeChargeLineMath({ quantity: null, unitRate: null, totalCost: 25 }))
      .toEqual({ quantity: 1, rate: 25, amount: 25 });
  });

  it('handles a charge with only unitRate and a specified quantity', () => {
    expect(computeChargeLineMath({ quantity: 0.75, unitRate: 8, totalCost: null }))
      .toEqual({ quantity: 0.75, rate: 8, amount: 6 });
  });

  it('defaults quantity to 1 when missing', () => {
    expect(computeChargeLineMath({ quantity: null, unitRate: 5, totalCost: null }))
      .toEqual({ quantity: 1, rate: 5, amount: 5 });
  });

  it('returns all zeros for a charge with no pricing data (the "Rose fert N/A" case)', () => {
    expect(computeChargeLineMath({ quantity: null, unitRate: null, totalCost: null }))
      .toEqual({ quantity: 1, rate: 0, amount: 0 });
  });

  it('prefers unitRate when both unitRate and totalCost are set, keeping the line internally consistent', () => {
    // DB has inconsistent state: qty=2, unitRate=5, totalCost=20.
    // We trust unitRate and recompute amount, so the invoice shows 2 × $5 = $10
    // rather than displaying "2 × $5 = $20" which QBO would reject as inconsistent.
    expect(computeChargeLineMath({ quantity: 2, unitRate: 5, totalCost: 20 }))
      .toEqual({ quantity: 2, rate: 5, amount: 10 });
  });

  it('treats zero or negative quantity as 1', () => {
    expect(computeChargeLineMath({ quantity: 0, unitRate: 10, totalCost: null }))
      .toEqual({ quantity: 1, rate: 10, amount: 10 });
    expect(computeChargeLineMath({ quantity: -2, unitRate: 10, totalCost: null }))
      .toEqual({ quantity: 1, rate: 10, amount: 10 });
  });

  it('accepts a zero unitRate as an explicit free line', () => {
    expect(computeChargeLineMath({ quantity: 3, unitRate: 0, totalCost: null }))
      .toEqual({ quantity: 3, rate: 0, amount: 0 });
  });
});
