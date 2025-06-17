import { db } from '../db';

export class DatabaseService {
  protected db = db;

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
   * Utility method to format timestamps for SQLite storage
   */
  protected formatTimestamp(date: Date): string {
    return date.toISOString();
  }

  /**
   * Utility method to parse SQLite date strings
   */
  protected parseDate(dateString: string): Date {
    return new Date(dateString);
  }
} 