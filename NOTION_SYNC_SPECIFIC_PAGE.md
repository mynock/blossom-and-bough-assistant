# Notion Specific Page Sync Feature

## Overview
I've implemented the ability to sync a specific Notion page by ID instead of syncing all pages. This provides more granular control over the sync process.

## Implementation Details

### New Methods Added

#### NotionSyncService
- `syncSpecificNotionPage(pageId: string, onProgress?: (message: string) => void)` - Syncs a single page by ID
- `processSingleNotionPage(page: any, onProgress?: (message: string) => void)` - Private method that extracts the individual page processing logic

### New API Endpoints

1. **POST** `/api/notion-sync/sync-page/:pageId`
   - Syncs a specific Notion page by ID
   - Returns same format as the full sync endpoint but for a single page

2. **POST** `/api/notion-sync/sync-page-stream/:pageId`
   - Syncs a specific page with real-time progress updates via Server-Sent Events
   - Useful for monitoring the sync process in real-time

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

### Getting Notion Page ID

To get a Notion page ID:
1. Open the page in Notion
2. Copy the URL from your browser
3. Extract the page ID from the URL (the part after the last `/` without hyphens)
4. Example: `https://notion.so/workspace/Page-Name-123abc456def` → page ID is `123abc456def`

### Features

- ✅ Syncs individual pages without affecting others
- ✅ Includes all the same conflict resolution logic as full sync
- ✅ Supports progress callbacks for monitoring
- ✅ Handles errors gracefully
- ✅ Works with both new and existing activities
- ✅ Preserves user changes when appropriate
- ✅ Uses the same AI parsing logic as full sync

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

### Error Handling

- Invalid page IDs return appropriate error messages
- Missing pages are handled gracefully
- AI parsing errors are captured and reported
- Database errors are logged and returned to the client

This feature provides the flexibility you requested to sync specific pages rather than having to sync everything at once. 