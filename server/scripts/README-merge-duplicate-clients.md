# Client Duplicate Merger Script

This script identifies and merges duplicate client records in the database by combining clients that have the same name but different IDs.

## What it does

The script performs the following operations:

1. **Analyzes all clients** in the database and counts their related data (work activities, projects, notes)
2. **Identifies duplicates** by grouping clients with the same name (case-insensitive)
3. **Selects primary clients** based on:
   - Most complete information (highest priority)
   - Most work activities (secondary priority)
   - Oldest creation date (tiebreaker)
4. **Updates references** in:
   - Work activities (`client_id` field)
   - Projects (`client_id` field) 
   - Client notes (`client_id` field)
5. **Removes duplicate clients** after all references are updated

## Information Scoring System

The script uses a scoring system to determine which client record has the most valuable information:

### Base Information (0-50 points)
- **Address**: 10 points
- **Geo Zone**: 5 points
- **Special Notes**: 15 points (highest weight for detailed information)
- **Priority Level**: 5 points
- **Schedule Flexibility**: 5 points
- **Preferred Days**: 5 points
- **Preferred Time**: 5 points

### Maintenance Information (0-60 points)
- **Recurring Maintenance Flag**: 10 points
- **Maintenance Interval**: 10 points
- **Hours Per Visit**: 10 points
- **Maintenance Rate**: 10 points
- **Last Maintenance Date**: 5 points
- **Next Maintenance Target**: 5 points

### Activity Data (variable points)
- **Work Activities**: 2 points each
- **Projects**: 5 points each
- **Client Notes**: 3 points each

The client with the highest total score becomes the primary client for that duplicate group.

## Usage

### Prerequisites

1. **Database setup**: Ensure PostgreSQL is running and accessible
2. **Environment configuration**: Copy `env.example` to `.env` and set `DATABASE_URL`
3. **Database URL format**: `postgresql://username:password@localhost:5432/blossom_and_bough`

### Running the script

```bash
# Show help
npx tsx scripts/merge-duplicate-clients.ts --help

# Dry run (see what would be changed without making changes)
npx tsx scripts/merge-duplicate-clients.ts --dry-run

# Actually perform the merge
npx tsx scripts/merge-duplicate-clients.ts
```

### Command line options

- `--dry-run`, `-d`: Run in dry-run mode to preview changes without making them
- `--help`, `-h`: Show help message

## Safety features

The script includes several safety measures:

1. **Dry run mode**: Preview all changes before making them
2. **Double confirmation**: Requires two "yes" confirmations before proceeding
3. **Detailed reporting**: Shows exactly what will be changed
4. **Data integrity**: Updates all related records before removing duplicates
5. **Verification**: Confirms data integrity after the merge

## Example output

```
🔄 Client Duplicate Merger

📊 Analyzing client data...
Found 150 total clients

🔍 Found 3 groups of duplicate clients:

📋 "john smith" (2 duplicates):
   Primary: CLT001 (score: 85, 15 activities, 3 projects)
   Duplicate: CLT045 (score: 25, 2 activities, 0 projects)

📋 "acme landscaping" (3 duplicates):
   Primary: CLT012 (score: 92, 8 activities, 2 projects)
   Duplicate: CLT023 (score: 15, 1 activities, 0 projects)
   Duplicate: CLT067 (score: 10, 0 activities, 0 projects)

📊 Summary of changes:
   Work activities to update: 3
   Projects to update: 0
   Client notes to update: 1
   Duplicate clients to remove: 4

Do you want to proceed with merging these duplicate clients? (y/n): y
This will permanently update work activities and remove duplicate clients. Please confirm again (y/n): y

🔄 Starting merge process...

📋 Processing "john smith"...
   ✅ Updated 2 work activities
   ✅ Updated 0 projects
   ✅ Updated 0 client notes
   ✅ Removed 1 duplicate clients

✅ Merge completed successfully!

📊 Final summary:
   Work activities updated: 3
   Projects updated: 0
   Client notes updated: 1
   Duplicate clients removed: 4

🔍 Verifying results...
   Remaining clients: 146
   Remaining work activities: 150

✅ Verification complete - all data integrity maintained!
```

## Database schema affected

The script updates these tables:

- `work_activities.client_id` - References to duplicate clients are updated to primary client
- `projects.client_id` - Project references are updated
- `client_notes.client_id` - Note references are updated
- `clients` - Duplicate client records are removed

## Backup recommendation

Before running this script on production data, it's recommended to:

1. **Create a database backup**:
   ```bash
   pg_dump -h localhost -U username -d blossom_and_bough > backup_before_merge.sql
   ```

2. **Test on a copy** of your production database first

3. **Run in dry-run mode** to verify the changes look correct

## Troubleshooting

### Database connection issues

If you see authentication errors:

1. Check that `DATABASE_URL` is set correctly in your `.env` file
2. Verify PostgreSQL is running: `brew services list | grep postgresql`
3. Test connection: `psql $DATABASE_URL`

### Permission issues

Ensure your database user has:
- `SELECT` permission on all tables
- `UPDATE` permission on `work_activities`, `projects`, `client_notes`
- `DELETE` permission on `clients`

### Foreign key constraint errors

If you encounter foreign key errors, the script should handle them gracefully, but you may need to:

1. Check for any additional tables that reference `clients.id`
2. Update the script to include those tables in the merge process

## Related files

- `scripts/merge-duplicate-clients.ts` - The main script
- `src/db/schema.ts` - Database schema definitions
- `src/services/DatabaseService.ts` - Database connection and utilities 