import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { describeDatabaseUrl } from '../utils/databaseUrl';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/blossom_and_bough';

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Create Drizzle database instance with explicit typing
export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });

// Export schema for use in other files
export * from './schema';

console.log(`🐘 PostgreSQL database connected: ${describeDatabaseUrl(databaseUrl)}`);