/**
 * Describe a connection string for logs without leaking credentials.
 */
export function describeDatabaseUrl(url: string): string {
  try {
    const { host, pathname } = new URL(url);
    if (!host) return '(unparseable DATABASE_URL)';
    return `${host}${pathname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}
