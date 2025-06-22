# Notion Sync Service Setup

## Overview

This document describes the Notion sync service that pulls new or updated Notion pages from a specified database and imports them into the CRM system as work activities.

## What's Been Implemented

### 1. Database Schema Updates
- Added `notionPageId` field to the `work_activities` table
- Generated database migration: `drizzle/0001_solid_catseye.sql`

### 2. NotionSyncService (`server/src/services/NotionSyncService.ts`)
- **Main sync method**: `syncNotionPages()` - Syncs all pages from Notion database
- **Page extraction**: Extracts work activity data from Notion page properties and content
- **Client handling**: Automatically creates client records if they don't exist
- **Duplicate prevention**: Uses Notion page ID to avoid duplicates
- **Update detection**: Updates existing work activities if Notion page was modified
- **Content parsing**: Extracts tasks (with checkboxes), notes, and materials from page content
- **Time calculation**: Calculates total hours from start/end times

### 3. API Routes (`server/src/routes/notionSync.ts`)
- `POST /api/notion-sync/sync` - Manual sync trigger
- `GET /api/notion-sync/status` - Check configuration and sync status

### 4. Frontend Component (`src/components/NotionSync.tsx`)
- Configuration status display
- Manual sync trigger button
- Sync results display (created/updated/errors)
- Instructions and help text

### 5. Navigation Integration
- Added "Notion Sync" to management navigation section
- Route configured at `/notion-sync`

## Sample Data Structure

Based on the attached Notion page example:

```
# Stoller (Maintenance)
Date: June 3, 2025
Client Name: Stoller
Team Members: Virginia Currin
Work Type: Maintenance
Start Time: 8:45
End Time: 3:10
Travel Time: 22

### Tasks
- [x] Misc clean up/weeds
- [x] Deadhead brunnera
- [ ] Prune fothergilla
- [ ] Deadhead roses as needed

### Notes
Stayed solo extra 15 min (design)
My lunch = 12:35-2

### Materials/Charges:
| Charge | Cost |
| --- | --- |
| Mulch | 27 |
| 2 gray buckets debris | 35 |
```

## Configuration Required

Set these environment variables:

```bash
NOTION_TOKEN=your_notion_integration_token
NOTION_DATABASE_ID=your_notion_database_id
```

## What Still Needs to be Completed

### 1. ✅ Fix TypeScript Compilation Errors - COMPLETED
All existing `WorkActivityService` methods have been updated to include `notionPageId` in their select queries:

- `getAllWorkActivities()` ✅
- `getWorkActivityById()` ✅
- `getWorkActivitiesByDateRange()` ✅
- `findExistingWorkActivities()` ✅
- `getWorkActivitiesByClientId()` ✅

### 2. Run Database Migration
```bash
cd server
npm run db:migrate
```
*Note: May require database credentials to be configured properly*

### 3. ✅ Additional Service Methods - COMPLETED
All required service methods have been implemented:

- `ClientService.getClientByName()` ✅ (completed)
- `EmployeeService.getEmployeeByName()` ✅ (completed)
- `WorkActivityService.getWorkActivityByNotionPageId()` ✅ (completed)

### 4. Enhanced Update Logic
The `updateWorkActivityFromNotion()` method currently only updates basic fields. It should also:
- Update/sync employees assignments
- Update/sync material charges
- Handle removal of deleted items

### 5. Error Handling & Logging
- Add more detailed error logging for debugging
- Handle edge cases in Notion content parsing
- Add validation for required Notion page properties

### 6. Scheduled Sync
Consider adding automated sync capability:
- Cron job or scheduled task
- Webhook from Notion (if available)
- Background sync service

## Usage

1. Configure environment variables
2. Run database migration
3. Fix TypeScript compilation errors
4. Navigate to `/notion-sync` in the CRM
5. Click "Sync Notion Pages" to import/update work activities

## Expected Notion Database Structure

The service expects Notion pages with these properties:
- `Client Name` (select)
- `Date` (date)
- `Work Type` (select)
- `Start Time` (text)
- `End Time` (text)
- `Team Members` (multi-select)
- `Travel Time` (number)

And content sections:
- Tasks (as checkboxes/to-do items)
- Notes (as paragraphs under "Notes" heading)
- Materials/Charges (as table under "Materials/Charges" heading)

## Benefits

- **Centralized Data**: All work activities from Notion automatically imported to CRM
- **No Duplicates**: Notion page ID prevents duplicate imports
- **Automatic Updates**: Modified Notion pages update corresponding work activities
- **Rich Content**: Preserves tasks, notes, and material charges from Notion
- **Client Management**: Automatically creates client records as needed 