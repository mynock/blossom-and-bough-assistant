# Notion Integration

## Overview

The Notion integration provides three core capabilities:

- **Smart entry creation** -- quickly create new Notion work entries via an embeddable interface, with automatic carryover of incomplete tasks from the previous client visit.
- **Bi-directional sync** -- pull new or updated Notion pages into the CRM as work activities, with duplicate prevention, update detection, and content parsing.
- **Task carryover** -- when creating a new entry for a client, the system finds the last entry, extracts unchecked tasks, and pre-fills them in the new page.

## Setup

### Prerequisites

1. A Notion workspace with admin access
2. A Notion database for work log entries
3. Your CRM system running (both frontend and backend)

### 1. Create Notion Integration

1. Go to [https://notion.so/my-integrations](https://notion.so/my-integrations)
2. Click "Create new integration"
3. Fill in the details:
   - **Name**: "Blossom & Bough CRM"
   - **Logo**: Upload your company logo (optional)
   - **Associated workspace**: Select your workspace
4. Click "Submit"
5. **Important**: Copy the "Internal Integration Token" -- you will need this for `NOTION_TOKEN`

### 2. Create/Configure Notion Database

You need a Notion database with these **exact property names**:

| Property Name | Type | Description |
|---------------|------|-------------|
| `Client Name` | **Select** | Name of the client (auto-creates new options) |
| `Date` | Date | Date of the work entry |
| `Work Type` | Select | Type of work (will default to "Maintenance") |

For the full sync service, the database also needs:

| Property Name | Type | Description |
|---------------|------|-------------|
| `Start Time` | Text | Start time of work |
| `End Time` | Text | End time of work |
| `Team Members` | Multi-select | Employees assigned to the work |
| `Travel Time` | Number | Travel time in minutes |

And content sections within each page:

- Tasks (as checkboxes/to-do items)
- Notes (as paragraphs under a "Notes" heading)
- Materials/Charges (as a table under a "Materials/Charges" heading)

#### Creating a new database

1. In Notion, create a new page
2. Type `/database` and select "Table - Full page"
3. Name it "Work Log Entries"
4. Add the properties listed above

#### Using an existing database

Make sure your database has the required properties with exact names.

### 3. Share Database with Integration

1. Open your Work Log Entries database in Notion
2. Click the "..." (more options) button in the top right
3. Click "Add connections"
4. Find and select your "Blossom & Bough CRM" integration
5. Click "Confirm"

### 4. Get Database ID

1. Open your Work Log Entries database in Notion
2. Look at the URL -- it will look like:
   ```
   https://notion.so/workspace/DatabaseName-1234567890abcdef1234567890abcdef?v=...
   ```
3. Copy the long string between the last `/` and `?` (or at the end if no `?`)
   - In the example above: `1234567890abcdef1234567890abcdef`
4. This is your `NOTION_DATABASE_ID`

### 5. Update Environment Variables

Add these to your `server/.env` file:

```env
# Notion Integration
NOTION_TOKEN=secret_your_notion_token_here
NOTION_DATABASE_ID=your_database_id_here
```

Replace the placeholder values with:
- `NOTION_TOKEN`: The token from step 1
- `NOTION_DATABASE_ID`: The database ID from step 4

### 6. Run Database Migration

The sync service requires a `notionPageId` field on the `work_activities` table. Run the migration:

```bash
cd server
npm run db:migrate
```

### 7. Restart Your Server

After updating the environment variables and running migrations, restart your server:

```bash
# If running in development
npm run dev

# Or if running in production
npm run start
```

### 8. Health Check

Verify your configuration:

```bash
curl http://localhost:3001/api/notion/health
```

Expected response:

```json
{
  "status": "OK",
  "notion_token_configured": true,
  "notion_database_configured": true,
  "ready": true
}
```

## Quick Entry Creation

### Workflow

1. **Open Notion dashboard** with your embedded interface
2. **Select or type client name**:
   - Choose from existing clients in the dropdown
   - OR type a new client name (will be automatically added to Notion)
3. **Click "Create Work Entry"**
4. **System automatically**:
   - Finds the last entry for that client (if one exists)
   - Extracts any unchecked tasks
   - Creates a new entry with those tasks pre-filled
   - Adds new client names to the Notion select field options
5. **Click "Open Work Entry"** to edit the new Notion page
6. **Add new tasks** and mark completed tasks as done

### Testing the API

```bash
curl -X POST http://localhost:3001/api/notion/create-smart-entry \
  -H "Content-Type: application/json" \
  -d '{"client_name": "Test Client"}'
```

Expected response:

```json
{
  "success": true,
  "page_url": "https://notion.so/...",
  "carryover_tasks": []
}
```

### Testing the Frontend

1. Navigate to `http://localhost:3000/notion-embed`
2. You should see the "Quick Work Entry" interface
3. Click on any client button to test creating an entry

### Embedding in Notion

#### Method 1: Direct Embed (Recommended)

1. In Notion, create a new page (or use an existing one)
2. Type `/embed` and press Enter
3. Enter your embed URL:
   ```
   http://localhost:3000/notion-embed
   ```
   (Replace with your production URL when deployed)
4. Press Enter and adjust the embed size as needed

#### Method 2: Using an iframe (Alternative)

You can also embed using HTML if you have a Notion page that supports HTML:

```html
<iframe
  src="http://localhost:3000/notion-embed"
  width="400"
  height="600"
  frameborder="0">
</iframe>
```

### Client Management

- **Auto-complete with existing clients** from your CRM database
- **Free text input** for new clients not yet in your system
- **Automatic Notion integration** -- new clients are added to the select field options
- **Existing clients**: Type to search through all clients in your database
- **New clients**: Simply type any new client name and create entries immediately
- **Seamless integration**: All client names become available in future Notion entries

## Sync Service

### What It Does

The sync service pulls new or updated Notion pages from the configured database and imports them into the CRM as work activities.

- **Page extraction**: Extracts work activity data from Notion page properties and content
- **Client handling**: Automatically creates client records if they don't exist
- **Duplicate prevention**: Uses Notion page ID to avoid duplicates
- **Update detection**: Updates existing work activities if the Notion page was modified
- **Content parsing**: Extracts tasks (with checkboxes), notes, and materials from page content
- **Time calculation**: Calculates total hours from start/end times

### Sample Data Structure

Based on a typical Notion page:

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

### API Routes

- `POST /api/notion-sync/sync` -- Manual sync trigger (syncs all pages)
- `GET /api/notion-sync/status` -- Check configuration and sync status

### Frontend Component

A frontend component is available at the `/notion-sync` route in the CRM, providing:

- Configuration status display
- Manual sync trigger button
- Sync results display (created/updated/errors)
- Instructions and help text

### Usage

1. Configure environment variables
2. Run database migration
3. Navigate to `/notion-sync` in the CRM
4. Click "Sync Notion Pages" to import/update work activities

## Syncing a Specific Page

In addition to syncing all pages, you can sync a single Notion page by its ID.

### Endpoints

1. **POST** `/api/notion-sync/sync-page/:pageId`
   - Syncs a specific Notion page by ID
   - Returns same format as the full sync endpoint but for a single page

2. **POST** `/api/notion-sync/sync-page-stream/:pageId`
   - Syncs a specific page with real-time progress updates via Server-Sent Events
   - Useful for monitoring the sync process in real-time

### Getting a Notion Page ID

1. Open the page in Notion
2. Copy the URL from your browser
3. Extract the page ID from the URL (the part after the last `/` without hyphens)
4. Example: `https://notion.so/workspace/Page-Name-123abc456def` -- page ID is `123abc456def`

### Usage Examples

#### Via API

```bash
# Sync a specific page
curl -X POST http://localhost:3001/api/notion-sync/sync-page/YOUR_PAGE_ID

# Sync with streaming progress
curl -X POST http://localhost:3001/api/notion-sync/sync-page-stream/YOUR_PAGE_ID
```

#### Programmatically

```typescript
const notionSyncService = new NotionSyncService(anthropicService);

// Sync a specific page
const result = await notionSyncService.syncSpecificNotionPage(
  'your-page-id-here',
  (message) => console.log(`Progress: ${message}`)
);

console.log(`Created: ${result.created}, Updated: ${result.updated}, Errors: ${result.errors}`);
```

### Response Format

The response follows the same structure as the full sync:

```json
{
  "success": true,
  "message": "Notion page sync completed",
  "stats": {
    "created": 0,
    "updated": 1,
    "errors": 0,
    "warnings": []
  }
}
```

Features of specific-page sync:

- Syncs individual pages without affecting others
- Includes all the same conflict resolution logic as full sync
- Supports progress callbacks for monitoring
- Handles errors gracefully
- Works with both new and existing activities
- Preserves user changes when appropriate
- Uses the same AI parsing logic as full sync

## Smart Sync Optimization

The sync system uses timestamp-based logic to avoid unnecessary processing. Instead of re-syncing every page on every run, it tracks the Notion page's `last_edited_time` and only processes pages that have changed since the last sync.

### Timestamp-Based Logic

- The `lastNotionSyncAt` field on a work activity stores the Notion page's `last_edited_time` from the most recent sync (not the wall-clock time when the sync ran).
- On subsequent syncs, the system compares the Notion page's current `last_edited_time` against the stored `lastNotionSyncAt` to decide whether to process the page.

### `shouldSyncFromNotion` Logic

```typescript
private shouldSyncFromNotion(
  notionLastEdited: string,
  lastNotionSyncAt: string | null | undefined,
  lastUpdatedBy: string | null | undefined
): boolean {
  // Always sync if never synced before
  if (!lastNotionSyncAt) {
    return true;
  }

  // Only sync if Notion page is newer than last sync
  const notionEditedDate = new Date(notionLastEdited);
  const lastSyncDate = new Date(lastNotionSyncAt);

  return notionEditedDate > lastSyncDate;
}
```

### Sync Decisions

- **Skipped**: Pages that have not been modified in Notion since the last sync are skipped.
- **Synced**: Pages with newer Notion edits are synced as before.
- **Always synced**: First-time syncs always proceed (when `lastNotionSyncAt` is null).

### Collaborative Editing Warnings

- **Silent protection**: When the user has local changes but Notion has not been updated, local changes are protected without warning.
- **Collaborative warning**: When both the user and Notion have changes (Notion is newer), the system warns:
  > "Client Name" on Date: Your local changes have been overwritten by newer Notion updates (collaborative editing)
- **Debug logs**: Provide detailed information about all sync decisions.

### Performance Benefits

- **Reduced AI processing**: Only processes pages that have actually changed.
- **Reduced database operations**: Skips unnecessary updates.
- **Better conflict handling**: Still respects collaborative editing scenarios.
- All sync decisions are logged for debugging.

## Customization

### Client Names

Update the client list in `src/components/NotionQuickEntry.tsx`:

```typescript
const clients = ['Your', 'Client', 'Names', 'Here'];
```

### Database Properties

If you need different database properties, update the `createEntryWithCarryover` method in `server/src/services/NotionService.ts`.

### Styling

The embedded interface uses Material-UI components and can be customized in `src/components/NotionQuickEntry.tsx`.

## Troubleshooting

### "NOTION_TOKEN not found"

- Make sure you have added the token to your `server/.env` file.
- Restart your server after adding environment variables.

### "NOTION_DATABASE_ID not found"

- Verify the database ID is correct.
- Make sure there are no extra characters or spaces.

### "Unauthorized" errors

- Ensure your integration has access to the database.
- Check that you have shared the database with your integration (see Setup step 3).

### "Property does not exist" errors

- Verify your database has properties named exactly: `Client Name`, `Date`, `Work Type`.
- Property names are case-sensitive.

### Embed not loading in Notion

- Make sure your server is running and accessible.
- Check your firewall settings.
- Try the direct URL first: `http://localhost:3000/notion-embed`

### Health check endpoint

Always check the health endpoint to verify your configuration:

```bash
curl http://localhost:3001/api/notion/health
```

### Sync status endpoint

Check configuration and sync readiness:

```bash
curl http://localhost:3001/api/notion-sync/status
```

### Specific-page sync errors

- Invalid page IDs return appropriate error messages.
- Missing pages are handled gracefully.
- AI parsing errors are captured and reported.
- Database errors are logged and returned to the client.

### Integration tests

Some integration tests may have pre-existing mock setup issues unrelated to the sync optimization changes. Core logic tests for `shouldSyncFromNotion` pass, the project builds successfully, and there are no compilation errors.

## Production Deployment

When deploying to production:

1. Update your environment variables on your hosting platform.
2. Run database migrations (`npm run db:migrate:prod`).
3. Update the embed URL in Notion to use your production domain.
4. Make sure your production server is accessible from Notion's servers.
