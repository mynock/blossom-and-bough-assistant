# Work Activities Schema and Notion Parsing Updates

## Overview
Updated the work activities schema and Notion notes parsing to better handle the latest format from Notion, with particular attention to non-billable time and travel time.

## Changes Made

### 1. Database Schema Updates

#### New Field Added
- **`nonBillableTimeMinutes`**: Integer field to store non-billable time separately from travel and break time
- Added to `work_activities` table in `server/src/db/schema.ts`
- Migration generated: `0005_shallow_captain_marvel.sql`

#### Migration Details
```sql
ALTER TABLE "work_activities" ADD COLUMN "non_billable_time_minutes" integer;
```

### 2. Notion Parsing Enhancements

#### New Time Format Parsing Methods
Added to `NotionSyncService.ts`:

**`parseTravelTime()`**: Handles travel time in "25x3" format
- Parses "minutes × people" format (e.g., "25x3" = 75 minutes total)
- Falls back to legacy number format
- Returns total travel time in minutes

**`parseNonBillableTime()`**: Handles non-billable time in "0:15" format  
- Parses "HH:MM" format (e.g., "0:15" = 15 minutes)
- Falls back to plain number format
- Returns time in minutes

#### Updated Property Extraction
- `convertNotionPageToNaturalText()` now extracts both travel time and non-billable time
- Uses new parsing methods instead of simple `getNumberProperty()`

### 3. Billable Hours Calculation Updates

#### Enhanced Calculation Logic
Updated `calculateBillableHours()` method to accept and process:
- Drive time (existing)
- Lunch time (existing) 
- **Non-billable time (new)**

All three time types are subtracted from total hours to calculate billable hours.

### 4. Service Layer Updates

#### WorkActivityService Changes
Added `nonBillableTimeMinutes` field to all query methods:
- `getAllWorkActivities()`
- `getWorkActivityById()`
- `getWorkActivitiesByDateRange()`
- `findExistingWorkActivities()`
- `getWorkActivitiesByClientId()`
- `getWorkActivitiesByEmployeeId()`
- `getWorkActivityByNotionPageId()`

#### WorkNotesParserService Changes
- Added default value of 0 for `nonBillableTimeMinutes` in work notes import
- Maintains backward compatibility with existing work notes format

#### NotionSyncService Integration
- Work activity creation now includes `nonBillableTimeMinutes` field
- Work activity updates now include `nonBillableTimeMinutes` field
- Billable hours calculation uses all three time deduction types

### 5. Test Updates

#### Fixed Test Objects
Updated `mockExistingActivity` in `NotionSyncService.test.ts`:
- Added `nonBillableTimeMinutes: 0` to prevent TypeScript errors
- Maintains test compatibility with new schema

## Format Examples

### New Notion Format Support

#### Non-Billable Time
- **Format**: "0:15" (HH:MM)
- **Parsing**: Converts to 15 minutes
- **Usage**: Subtracted from total hours for billable calculation

#### Travel Time  
- **Format**: "25x3" (minutes × people)
- **Parsing**: Converts to 75 minutes total (25 min × 3 people)
- **Usage**: Stored as total travel time, subtracted for billable calculation

#### Backward Compatibility
- Still supports legacy number formats
- Falls back gracefully if new formats cannot be parsed

## Implementation Benefits

1. **Accurate Time Tracking**: Separate fields for different types of non-billable time
2. **Flexible Travel Time**: Supports per-person travel time calculations  
3. **Better Billing**: More precise billable hours calculation
4. **Notion Integration**: Seamless sync with latest Notion template format
5. **Backward Compatibility**: Existing data and imports continue to work

## Deployment Requirements

1. **Database Migration**: Run `npm run db:migrate` to add the new column
2. **No Data Loss**: Existing records will have `null` for the new field (handled gracefully)
3. **Immediate Benefits**: New Notion syncs will use enhanced parsing automatically

## Testing

- All existing tests pass with updated mock objects
- Build succeeds with TypeScript validation
- Ready for deployment once database migration is applied

## Future Enhancements

- Could add UI fields for manual entry of non-billable time
- Could extend to support more granular time tracking categories
- Could add reporting features for non-billable time analysis