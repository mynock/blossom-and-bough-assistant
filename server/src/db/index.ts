import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';

// Create database file path
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'blossom-and-bough.db');

// Ensure the data directory exists
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create SQLite database connection
const sqlite = new Database(dbPath);

// Enable foreign key constraints
sqlite.pragma('foreign_keys = ON');

// Create Drizzle database instance
export const db = drizzle(sqlite, { schema });

// Export the raw SQLite instance for direct queries if needed
export const sqliteInstance: Database.Database = sqlite;

// Export schema for use in other files
export * from './schema';

console.log(`📁 Database initialized at: ${dbPath}`); 