# PostgreSQL Migration Guide

## Overview
The persistence layer has been successfully converted from SQLite to PostgreSQL. This document outlines the changes made and provides setup instructions.

## Changes Made

### 1. Dependencies Updated
- **Removed**: `better-sqlite3` and `@types/better-sqlite3`
- **Added**: `pg` and `@types/pg`

### 2. Database Configuration
- **Updated `drizzle.config.ts`**:
  - Changed dialect from `sqlite` to `postgresql`
  - Updated database URL format to PostgreSQL connection string
  
### 3. Database Connection (`src/db/index.ts`)
- Replaced SQLite connection with PostgreSQL Pool
- Updated imports from `drizzle-orm/better-sqlite3` to `drizzle-orm/node-postgres`
- Added SSL configuration for production environments

### 4. Schema Changes (`src/db/schema.ts`)
- Converted all tables from `sqliteTable` to `pgTable`
- Updated column types:
  - `integer().primaryKey({ autoIncrement: true })` → `serial().primaryKey()`
  - `integer(..., { mode: 'boolean' })` → `boolean(...)`
  - `text().default(sql\`CURRENT_TIMESTAMP\`)` → `timestamp().defaultNow()`
- Maintained all relationships and constraints

### 5. Service Layer Updates
- **DatabaseService**: Updated `formatTimestamp()` to return Date objects instead of strings
- **All Services**: Updated delete operations to use `rowCount` instead of `changes`

## Environment Configuration

### Required Environment Variable
```bash
# Replace with your actual PostgreSQL connection details
DATABASE_URL=postgresql://username:password@localhost:5432/blossom_and_bough
```

### Example for Different Environments

#### Local Development
```bash
DATABASE_URL=postgresql://localhost:5432/blossom_and_bough
```

#### Production (with SSL)
```bash
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

## Setup Instructions

### 1. Install PostgreSQL
```bash
# macOS (using Homebrew)
brew install postgresql
brew services start postgresql

# Create database
createdb blossom_and_bough
```

### 2. Update Environment Variables
Copy the updated `env.example` and set your database URL:
```bash
cp env.example .env
# Edit .env and set your DATABASE_URL
```

### 3. Run Database Migration
```bash
# Generate and run the migration
npm run db:migrate
```

### 4. Verify Installation
```bash
# Check types compile
npm run type-check

# Build the project
npm run build
```

## Available Database Commands

- `npm run db:generate` - Generate new migrations from schema changes
- `npm run db:migrate` - Apply migrations to database
- `npm run db:push` - Push schema directly to database (development only)
- `npm run db:studio` - Open Drizzle Studio to view/edit data

## Migration from Existing SQLite Data

If you have existing SQLite data that needs to be migrated:

1. **Export SQLite data** (if needed)
2. **Run PostgreSQL migrations** to create tables
3. **Import data** using appropriate scripts or manual SQL

## Production Considerations

1. **Connection Pooling**: The app uses connection pooling via `pg.Pool`
2. **SSL**: Automatically enabled in production environments
3. **Environment Variables**: Ensure `DATABASE_URL` is properly set
4. **Migrations**: Always run migrations before deploying new versions

## Differences from SQLite

### Behavioral Changes
1. **Timestamps**: PostgreSQL handles timestamps natively (no string conversion needed)
2. **Boolean Values**: True boolean type instead of integer (0/1)
3. **Auto-increment**: Uses `SERIAL` type instead of `AUTOINCREMENT`
4. **Query Results**: Uses `rowCount` instead of `changes` property

### Performance Benefits
1. **Concurrent Access**: Better handling of multiple connections
2. **Data Types**: Native support for more data types
3. **Indexing**: More sophisticated indexing options
4. **Scalability**: Better suited for production workloads

## Troubleshooting

### Common Issues
1. **Connection Errors**: Check DATABASE_URL format and PostgreSQL service status
2. **Migration Errors**: Ensure database exists and user has proper permissions
3. **SSL Issues**: In development, SSL is disabled; in production, it's required

### Debugging
```bash
# Check PostgreSQL connection
psql $DATABASE_URL

# View migration status
npm run db:studio
``` 