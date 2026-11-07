/**
 * Check a Railway cron request's bearer token. An unset CRON_AUTH_TOKEN must not match
 * a missing header, so an unconfigured token rejects everything.
 */
export function isCronTokenValid(
  authorizationHeader: string | undefined,
  expectedToken: string | undefined = process.env.CRON_AUTH_TOKEN
): boolean {
  if (!expectedToken) return false;
  return authorizationHeader?.replace('Bearer ', '') === expectedToken;
}
