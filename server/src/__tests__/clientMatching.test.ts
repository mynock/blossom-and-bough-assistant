import { describe, expect, it } from '@jest/globals';
import { nameTokens, matchClientsByName } from '../services/clientMatching';

const clients = (names: string[]) => names.map((name, i) => ({ id: i + 1, name }));

describe('nameTokens', () => {
  it('lowercases, splits on non-alphanumerics, drops joiners', () => {
    expect(nameTokens('Steve and Jackie Thomas')).toEqual(['steve', 'jackie', 'thomas']);
    expect(nameTokens('St. Clair')).toEqual(['st', 'clair']);
    expect(nameTokens('Erickson Realty')).toEqual(['erickson', 'realty']);
  });

  it('returns empty for null/empty', () => {
    expect(nameTokens(null)).toEqual([]);
    expect(nameTokens('')).toEqual([]);
  });
});

describe('matchClientsByName', () => {
  it('matches a single surname inside a couple name', () => {
    const out = matchClientsByName('Steve and Jackie Thomas', clients(['Thomas', 'Foley', 'Erickson']));
    expect(out.map((c) => c.name)).toEqual(['Thomas']);
  });

  it('returns BOTH surnames for a two-surname couple (ambiguous)', () => {
    const out = matchClientsByName('Matt Leid and Kourtney Foley', clients(['Leid', 'Foley', 'Thomas']));
    expect(out.map((c) => c.name).sort()).toEqual(['Foley', 'Leid']);
  });

  it('matches a business name by its distinctive token', () => {
    const out = matchClientsByName('Erickson Realty', clients(['Erickson', 'Thomas']));
    expect(out.map((c) => c.name)).toEqual(['Erickson']);
  });

  it('is whole-token, not substring', () => {
    // "Smith" must NOT match "Blacksmith".
    const out = matchClientsByName('Blacksmith Landscaping', clients(['Smith']));
    expect(out).toEqual([]);
  });

  it('flags two CRM clients sharing a surname as ambiguous', () => {
    const out = matchClientsByName('John Thomas', clients(['Thomas', 'Thomas']));
    expect(out).toHaveLength(2);
  });

  it('returns nothing when no surname appears', () => {
    expect(matchClientsByName('Erickson Realty', clients(['Thomas', 'Foley']))).toEqual([]);
  });

  it('matches multi-word client names only when all tokens are present', () => {
    expect(matchClientsByName('Jane St Clair', clients(['St Clair'])).map((c) => c.name)).toEqual(['St Clair']);
    expect(matchClientsByName('Jane Clair', clients(['St Clair']))).toEqual([]);
  });

  it('is case-insensitive', () => {
    expect(matchClientsByName('STEVE AND JACKIE THOMAS', clients(['thomas'])).map((c) => c.name)).toEqual(['thomas']);
  });

  it('ignores empty client names', () => {
    expect(matchClientsByName('Steve Thomas', clients(['', 'Thomas'])).map((c) => c.name)).toEqual(['Thomas']);
  });
});
