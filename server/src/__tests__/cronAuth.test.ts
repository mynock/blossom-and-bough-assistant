import { isCronTokenValid } from '../utils/cronAuth';

describe('isCronTokenValid', () => {
  it('accepts a matching bearer token', () => {
    expect(isCronTokenValid('Bearer s3cret', 's3cret')).toBe(true);
  });

  it('rejects a wrong token', () => {
    expect(isCronTokenValid('Bearer nope', 's3cret')).toBe(false);
  });

  it('rejects a request with no Authorization header', () => {
    expect(isCronTokenValid(undefined, 's3cret')).toBe(false);
  });

  it('rejects everything when CRON_AUTH_TOKEN is not configured', () => {
    expect(isCronTokenValid(undefined, undefined)).toBe(false);
    expect(isCronTokenValid('Bearer ', '')).toBe(false);
  });
});
