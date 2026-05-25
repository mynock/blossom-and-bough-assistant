import { db } from '../db';

/**
 * Transaction handle from `db.transaction(async (tx) => ...)`.
 * Has the same query API as `db`.
 */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Either the base db connection or a transaction handle. Services that accept
 * this can be composed into larger transactions.
 */
export type DbOrTx = typeof db | Tx;

export class DatabaseService {
  public readonly db = db;

  /**
   * Get the database instance for direct queries
   */
  protected getDb() {
    return this.db;
  }

  /**
   * Run `fn` inside a database transaction. If `fn` throws, all writes are
   * rolled back. Use for multi-statement writes that must be atomic, or to
   * compose transactions across services.
   */
  async withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  /**
   * Utility method to format dates for PostgreSQL storage as ISO date string
   */
  protected formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  /**
   * Utility method to get timestamp for PostgreSQL storage.
   * PostgreSQL accepts Date objects directly via Drizzle ORM.
   */
  protected formatTimestamp(date: Date): Date {
    return date;
  }

  /**
   * Utility method to parse ISO date strings from PostgreSQL
   */
  protected parseDate(dateString: string): Date {
    return new Date(dateString);
  }
}
