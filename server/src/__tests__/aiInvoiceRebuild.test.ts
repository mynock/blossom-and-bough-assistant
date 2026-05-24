import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';

// AnthropicService is auto-mocked in setup.ts. We need the real exports for
// the pure-helper tests below, so unmock just this module.
jest.unmock('../services/AnthropicService');

import {
  rebuildLineItemsFromAIResponse,
  normalizeSuggestedAdditions
} from '../services/AnthropicService';

describe('rebuildLineItemsFromAIResponse', () => {
  const basic = [
    {
      workActivityId: 1,
      qboItemId: 'qbo-labor',
      description: 'original labor desc',
      quantity: 4,
      rate: 55,
      amount: 220
    },
    {
      otherChargeId: 99,
      qboItemId: 'qbo-materials',
      description: 'original materials desc',
      quantity: 1,
      rate: 30,
      amount: 30
    }
  ];

  it('replaces only the description; preserves identity fields and money', () => {
    const result = rebuildLineItemsFromAIResponse(
      [
        { description: 'Rewritten labor.' },
        { description: 'Rewritten materials.' }
      ],
      basic
    );

    expect(result).toEqual([
      { ...basic[0], description: 'Rewritten labor.' },
      { ...basic[1], description: 'Rewritten materials.' }
    ]);
  });

  it('preserves otherChargeId — the bug fix for FK linkage being dropped', () => {
    const result = rebuildLineItemsFromAIResponse(
      [{ description: 'A.' }, { description: 'B.' }],
      basic
    );
    expect(result[0].workActivityId).toBe(1);
    expect(result[1].otherChargeId).toBe(99);
  });

  it('backfills original descriptions when AI returns fewer lines than provided', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = rebuildLineItemsFromAIResponse(
      [{ description: 'Rewritten labor.' }], // only 1 of 2 returned
      basic
    );

    expect(result).toHaveLength(2);
    expect(result[0].description).toBe('Rewritten labor.');
    expect(result[1].description).toBe('original materials desc');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('ignores extra AI lines that have no corresponding original (no extras leak in)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = rebuildLineItemsFromAIResponse(
      [
        { description: 'A.' },
        { description: 'B.' },
        { description: 'C (extra).' }
      ],
      basic
    );

    expect(result).toHaveLength(2);
    expect(result.map(r => r.description)).toEqual(['A.', 'B.']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('keeps original description when the AI description is empty or whitespace', () => {
    const result = rebuildLineItemsFromAIResponse(
      [{ description: '   ' }, { description: '' }],
      basic
    );
    expect(result[0].description).toBe('original labor desc');
    expect(result[1].description).toBe('original materials desc');
  });

  it('keeps original description when the AI description is missing or non-string', () => {
    const result = rebuildLineItemsFromAIResponse(
      [{}, { description: 42 as unknown as string }],
      basic
    );
    expect(result[0].description).toBe('original labor desc');
    expect(result[1].description).toBe('original materials desc');
  });

  it('does not let the AI alter quantity, rate, amount, or qboItemId', () => {
    const result = rebuildLineItemsFromAIResponse(
      [
        {
          description: 'A.',
          quantity: 9999,
          rate: 9999,
          amount: 9999,
          qboItemId: 'attacker-controlled',
          workActivityId: 6666
        },
        { description: 'B.' }
      ],
      basic
    );

    expect(result[0].quantity).toBe(4);
    expect(result[0].rate).toBe(55);
    expect(result[0].amount).toBe(220);
    expect(result[0].qboItemId).toBe('qbo-labor');
    expect(result[0].workActivityId).toBe(1);
  });

  it('returns an empty array when there are no basic line items', () => {
    expect(rebuildLineItemsFromAIResponse([{ description: 'noise' }], [])).toEqual([]);
  });
});

describe('normalizeSuggestedAdditions', () => {
  it('keeps plants and materials suggestions with descriptions', () => {
    const result = normalizeSuggestedAdditions([
      { description: 'Sluggo', category: 'materials', quantity: 1 },
      { description: "Lonicera 'Lemon Beauty'", category: 'plants', quantity: 2 }
    ]);
    expect(result).toHaveLength(2);
  });

  it('lowercases the category before checking', () => {
    const result = normalizeSuggestedAdditions([
      { description: 'Sluggo', category: 'Materials' }
    ]);
    expect(result[0].category).toBe('materials');
  });

  it('drops entries with unrecognized categories', () => {
    const result = normalizeSuggestedAdditions([
      { description: 'Hammer', category: 'tools' },
      { description: 'Sluggo', category: 'materials' }
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Sluggo');
  });

  it('drops entries with empty or whitespace descriptions', () => {
    const result = normalizeSuggestedAdditions([
      { description: '   ', category: 'materials' },
      { description: '', category: 'plants' },
      { description: 'Mulch', category: 'materials' }
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Mulch');
  });

  it('defaults missing or non-positive quantity to 1', () => {
    const result = normalizeSuggestedAdditions([
      { description: 'A', category: 'materials' },
      { description: 'B', category: 'materials', quantity: 0 },
      { description: 'C', category: 'materials', quantity: -5 },
      { description: 'D', category: 'materials', quantity: 'three' }
    ]);
    expect(result.map(r => r.quantity)).toEqual([1, 1, 1, 1]);
  });

  it('preserves a positive quantity exactly', () => {
    const result = normalizeSuggestedAdditions([
      { description: 'A', category: 'materials', quantity: 3.5 }
    ]);
    expect(result[0].quantity).toBe(3.5);
  });

  it('preserves sourceWorkActivityId only when it is a number', () => {
    const result = normalizeSuggestedAdditions([
      { description: 'A', category: 'materials', sourceWorkActivityId: 42 },
      { description: 'B', category: 'materials', sourceWorkActivityId: '42' }
    ]);
    expect(result[0].sourceWorkActivityId).toBe(42);
    expect(result[1].sourceWorkActivityId).toBeUndefined();
  });

  it('survives nulls and missing fields without throwing', () => {
    const result = normalizeSuggestedAdditions([
      null as unknown as object,
      undefined as unknown as object,
      {},
      { description: 'Good', category: 'materials' }
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Good');
  });
});
