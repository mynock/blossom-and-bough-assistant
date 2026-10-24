import { describeDatabaseUrl } from '../utils/databaseUrl';

describe('describeDatabaseUrl', () => {
  it('drops the credentials and keeps host, port and database', () => {
    expect(describeDatabaseUrl('postgresql://app_user:hunter2@db.internal:5432/blossom'))
      .toBe('db.internal:5432/blossom');
  });

  it('handles a URL without credentials or port', () => {
    expect(describeDatabaseUrl('postgresql://localhost/blossom_and_bough'))
      .toBe('localhost/blossom_and_bough');
  });

  it('never echoes back a value it cannot parse', () => {
    expect(describeDatabaseUrl('not a url with password hunter2')).toBe('(unparseable DATABASE_URL)');
  });
});
