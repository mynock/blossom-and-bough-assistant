import { describe, expect, it } from '@jest/globals';
import type { Employee } from '../db/schema';
import {
  getSelectProperty,
  getMultiSelectProperty,
  getTextProperty,
  extractTextFromRichText,
} from '../services/notion/notionProperties';
import {
  parseHoursProperty,
  parseTime,
  calculateHoursFromTimeRange,
  parseChargeFromText,
} from '../services/notion/notionParsers';
import { tokenize, findEmployeeMatch } from '../services/notion/employeeMatcher';
import { calculateSimilarity, findBestClientMatch } from '../services/notion/clientMatcher';

function makeEmployee(overrides: Partial<Employee> & { id: number; name: string }): Employee {
  return {
    employeeId: `emp-${overrides.id}`,
    regularWorkdays: '',
    homeAddress: '',
    minHoursPerDay: 0,
    maxHoursPerDay: 8,
    capabilityLevel: 1,
    hourlyRate: null,
    notes: null,
    activeStatus: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Employee;
}

describe('notionProperties', () => {
  describe('getSelectProperty', () => {
    it('returns the select name when present', () => {
      const props = { 'Work Type': { select: { name: 'maintenance' } } };
      expect(getSelectProperty(props, 'Work Type')).toBe('maintenance');
    });

    it('returns null when the property is missing', () => {
      expect(getSelectProperty({}, 'Work Type')).toBeNull();
    });

    it('returns null when the select value is missing', () => {
      expect(getSelectProperty({ 'Work Type': { select: null } }, 'Work Type')).toBeNull();
    });
  });

  describe('getMultiSelectProperty', () => {
    it('extracts names from multi_select items', () => {
      const props = {
        'Team Members': { multi_select: [{ name: 'Andrea' }, { name: 'Anne' }] },
      };
      expect(getMultiSelectProperty(props, 'Team Members')).toEqual(['Andrea', 'Anne']);
    });

    it('returns an empty array when the property is missing', () => {
      expect(getMultiSelectProperty({}, 'Team Members')).toEqual([]);
    });
  });

  describe('getTextProperty', () => {
    it('joins rich_text plain_text segments', () => {
      const props = {
        Notes: { rich_text: [{ plain_text: 'hello ' }, { plain_text: 'world' }] },
      };
      expect(getTextProperty(props, 'Notes')).toBe('hello world');
    });

    it('returns null when rich_text is empty', () => {
      expect(getTextProperty({ Notes: { rich_text: [] } }, 'Notes')).toBeNull();
    });
  });

  describe('extractTextFromRichText', () => {
    it('extracts text from heading_2 blocks', () => {
      const block = { type: 'heading_2', heading_2: { rich_text: [{ plain_text: 'Charges' }] } };
      expect(extractTextFromRichText(block)).toBe('Charges');
    });

    it('extracts text from bulleted_list_item blocks', () => {
      const block = {
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [{ plain_text: '1 bag debris' }] },
      };
      expect(extractTextFromRichText(block)).toBe('1 bag debris');
    });

    it('returns empty string for unhandled block types', () => {
      expect(extractTextFromRichText({ type: 'paragraph' })).toBe('');
    });
  });
});

describe('notionParsers', () => {
  describe('parseHoursProperty', () => {
    it('reads numeric properties directly', () => {
      const props = { Hours: { type: 'number', number: 4.5 } };
      expect(parseHoursProperty(props, 'Hours')).toBe(4.5);
    });

    it('parses rich_text hour values', () => {
      const props = {
        Hours: { type: 'rich_text', rich_text: [{ text: { content: ' 3.25 ' } }] },
      };
      expect(parseHoursProperty(props, 'Hours')).toBe(3.25);
    });

    it('returns null for missing property', () => {
      expect(parseHoursProperty({}, 'Hours')).toBeNull();
    });

    it('returns null for non-numeric rich_text', () => {
      const props = {
        Hours: { type: 'rich_text', rich_text: [{ text: { content: 'tba' } }] },
      };
      expect(parseHoursProperty(props, 'Hours')).toBeNull();
    });
  });

  describe('parseTime', () => {
    it('parses 12-hour pm', () => {
      expect(parseTime('2:00 pm')).toBe(14);
    });

    it('parses 12-hour am and treats 12:xx am as 0:xx', () => {
      expect(parseTime('9:30 am')).toBe(9.5);
      expect(parseTime('12:00 am')).toBe(0);
    });

    it('handles 12:xx pm staying at noon', () => {
      expect(parseTime('12:30 pm')).toBe(12.5);
    });

    it('parses military time', () => {
      expect(parseTime('14:45')).toBeCloseTo(14.75, 5);
    });

    it('returns null for unparseable input', () => {
      expect(parseTime('half past two')).toBeNull();
    });
  });

  describe('calculateHoursFromTimeRange', () => {
    it('multiplies duration by employee count', () => {
      expect(calculateHoursFromTimeRange('2:00 pm', '4:00 pm', 3)).toBe(6);
    });

    it('handles overnight wrap-around by adding 24h', () => {
      expect(calculateHoursFromTimeRange('11:00 pm', '1:00 am', 1)).toBe(2);
    });

    it('returns null when either time is unparseable', () => {
      expect(calculateHoursFromTimeRange('garbage', '4:00 pm', 1)).toBeNull();
    });
  });

  describe('parseChargeFromText', () => {
    it('extracts numeric cost from parentheses', () => {
      expect(parseChargeFromText('mulch ($27)')).toEqual({ description: 'mulch', cost: 27 });
    });

    it('defaults debris items to $25 when no explicit cost', () => {
      expect(parseChargeFromText('1 bag debris')).toEqual({ description: '1 bag debris', cost: 25 });
    });

    it('returns null for empty input', () => {
      expect(parseChargeFromText('')).toBeNull();
      expect(parseChargeFromText('   ')).toBeNull();
    });

    it('skips plant-list items when not in charges section', () => {
      expect(parseChargeFromText('2 native mock orange', false)).toBeNull();
    });

    it('keeps plant-named items when in charges section', () => {
      const result = parseChargeFromText('native plant tag ($5)', true);
      expect(result).toEqual({ description: 'native plant tag', cost: 5 });
    });
  });
});

describe('employeeMatcher', () => {
  describe('tokenize', () => {
    it('splits on whitespace and hyphens, lowercases, drops blanks', () => {
      expect(tokenize('Anne-Marie  McGary')).toEqual(['anne', 'marie', 'mcgary']);
    });

    it('returns empty array for blank input', () => {
      expect(tokenize('   ')).toEqual([]);
    });
  });

  describe('findEmployeeMatch', () => {
    const employees = [
      makeEmployee({ id: 1, name: 'Andrea Wilson' }),
      makeEmployee({ id: 2, name: 'Anne McGary' }),
    ];

    it('finds exact full-name match (case-insensitive)', () => {
      const result = findEmployeeMatch('andrea wilson', employees);
      expect(result.match?.name).toBe('Andrea Wilson');
    });

    it('finds whole-token match for first name', () => {
      const result = findEmployeeMatch('Anne', employees);
      expect(result.match?.name).toBe('Anne McGary');
    });

    it('does NOT match partial tokens (e.g. "An" vs "Anne")', () => {
      const result = findEmployeeMatch('An', employees);
      expect(result.match).toBeNull();
    });

    it('does NOT match unrelated names with shared prefix (Andy vs Andrea)', () => {
      const result = findEmployeeMatch('Andy', employees);
      expect(result.match).toBeNull();
    });

    it('treats multiple token matches as ambiguous', () => {
      const ambiguousList = [
        makeEmployee({ id: 1, name: 'Chris Adams' }),
        makeEmployee({ id: 2, name: 'Chris Baker' }),
      ];
      const result = findEmployeeMatch('Chris', ambiguousList);
      expect(result.match).toBeNull();
      expect(result.ambiguousCandidates).toHaveLength(2);
    });

    it('returns null for blank search', () => {
      expect(findEmployeeMatch('   ', employees).match).toBeNull();
    });
  });
});

describe('clientMatcher', () => {
  describe('calculateSimilarity', () => {
    it('returns 1.0 for identical strings (case-insensitive)', () => {
      expect(calculateSimilarity('Smith', 'smith')).toBe(1.0);
    });

    it('returns 0 when either side is empty', () => {
      expect(calculateSimilarity('', 'smith')).toBe(0);
      expect(calculateSimilarity('smith', '')).toBe(0);
    });

    it('returns a value in (0, 1) for similar-but-not-equal strings', () => {
      const sim = calculateSimilarity('Smith', 'Smyth');
      expect(sim).toBeGreaterThan(0.5);
      expect(sim).toBeLessThan(1.0);
    });
  });

  describe('findBestClientMatch', () => {
    const clients = [{ name: 'Smith Residence' }, { name: 'Johnson Garden' }];

    it('returns the matching client when similarity >= 0.85', () => {
      const result = findBestClientMatch('Smith Residance', clients); // 1-letter typo
      expect(result?.client.name).toBe('Smith Residence');
    });

    it('returns null when nothing crosses the 0.85 threshold', () => {
      expect(findBestClientMatch('Totally Different', clients)).toBeNull();
    });
  });
});
