import { db } from '../db';

export class DatabaseService {
  public readonly db = db;

  /**
   * Get the database instance for direct queries
   */
  protected getDb() {
    return this.db;
  }

  /**
   * Utility method to format dates for SQLite storage
   */
  protected formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  /**
   * Utility method to get timestamp for database storage
   * PostgreSQL accepts Date objects directly
   */
  protected formatTimestamp(date: Date): Date {
    return date;
  }

  /**
   * Utility method to parse SQLite date strings
   */
  protected parseDate(dateString: string): Date {
    return new Date(dateString);
  }
} 