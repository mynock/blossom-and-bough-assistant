# Cron Jobs Setup

## Overview

This repository uses **internal Node.js cron scheduling** (via `node-cron`) for automated tasks. The cron jobs run inside the Railway application process.

> **Note:** A Railway cron service migration was previously explored but the application currently uses the internal scheduler. The manual trigger endpoints below can also be called by an external scheduler if needed.

## Automated Tasks

| Task | Schedule | Time (Pacific) | Purpose |
|------|----------|----------------|---------|
| **Maintenance Entries** | `0 3 * * *` | 8PM PDT / 7PM PST | Create Notion entries for tomorrow's calendar events |
| **Notion Sync** | `0 6,18 * * *` | 11PM/11AM PDT, 10PM/10AM PST | Import updated Notion pages as work activities |

## Implementation

The cron jobs run inside the application using the `node-cron` package:

```typescript
// In CronService.ts
cron.schedule('0 3 * * *', async () => {
  await this.createMaintenanceEntriesForTomorrow();
});

cron.schedule('0 6,18 * * *', async () => {
  const notionSyncService = new NotionSyncService(anthropicService);
  await notionSyncService.syncNotionPages();
});
```

## Architecture

```
┌─────────────────────┐    ┌─────────────────────┐
│   Railway App       │    │   node-cron         │
│   (Always Running)  │◄───│   (Internal Timer)  │
│                     │    │                     │
│ • Maintenance Logic │    │ • Schedule: 0 3 * * *│
│ • Notion Sync Logic │    │ • Schedule: 0 6,18 *│
│ • Database Access   │    │ • Timezone: UTC     │
│ • API Endpoints     │    │                     │
└─────────────────────┘    └─────────────────────┘
```

## Manual Trigger Endpoints

For testing and manual execution:

- **`POST /api/cron/maintenance-entries`** - Manual maintenance entry creation
- **`POST /api/cron/notion-sync`** - Manual Notion sync trigger

These require either user authentication or a `CRON_AUTH_TOKEN` bearer token.

```bash
# Test maintenance entries
curl -X POST https://your-app.railway.app/api/cron/maintenance-entries \
  -H "Authorization: Bearer YOUR_CRON_AUTH_TOKEN"

# Test Notion sync
curl -X POST https://your-app.railway.app/api/cron/notion-sync \
  -H "Authorization: Bearer YOUR_CRON_AUTH_TOKEN"
```

## Admin Panel Integration

The Admin panel includes manual trigger buttons and job management:
- **Create Tomorrow's Maintenance Entries** button
- **Sync Notion Pages** button
- **Scheduled Jobs Status** section with enable/disable toggles
- Real-time status monitoring (scheduled/running/error)

## Maintenance Entry Creation Process

1. **Triggers**: Daily at 3AM UTC (8PM Pacific)
2. **Fetches**: Tomorrow's Google Calendar events
3. **Filters**: Yellow client visits (timed events only)
4. **Extracts**: Helper assignments from orange all-day events
5. **Creates**: Notion maintenance entries with carryover tasks
6. **Assigns**: Team members (Andrea + helpers)

## Notion Page Ingestion Process

1. **Triggers**: Twice daily at 6AM & 6PM UTC
2. **Fetches**: All Notion pages from configured database
3. **Filters**: Pages modified since last sync
4. **Parses**: Content using AI to extract work activity data
5. **Creates/Updates**: Work activities in the system
6. **Prevents**: Duplicates using Notion page IDs

## Environment Variables Required

```bash
# For Maintenance Entry Creation
NOTION_TOKEN=secret_your_notion_token
NOTION_DATABASE_ID=your_database_id
GOOGLE_CALENDAR_ID=your_calendar_id
GOOGLE_SERVICE_ACCOUNT_KEY=your_service_account_credentials

# For Notion Sync
ANTHROPIC_API_KEY=your_anthropic_key

# Optional for manual testing
CRON_AUTH_TOKEN=your_token_for_manual_triggers
```

## Customization

### Adjusting Schedules

Edit the cron expressions in `CronService.ts`:

```typescript
// Current: Daily at 3AM UTC (8PM Pacific)
cron.schedule('0 3 * * *', ...)

// Example: Every 6 hours
cron.schedule('0 */6 * * *', ...)

// Example: Weekdays only at 9AM UTC
cron.schedule('0 9 * * 1-5', ...)
```

Use [crontab.guru](https://crontab.guru/) to validate expressions.

### Adding New Scheduled Tasks

```typescript
// In CronService.startScheduledTasks()
cron.schedule('0 12 * * *', async () => {
  debugLog.info('New scheduled task started');
  // Your logic here
}, {
  scheduled: true,
  timezone: 'UTC'
});
```

### Disabling Tasks Temporarily

```typescript
if (process.env.ENABLE_MAINTENANCE_CRON !== 'false') {
  cron.schedule('0 3 * * *', async () => {
    await this.createMaintenanceEntriesForTomorrow();
  });
}
```

## Using Railway Cron Service (Alternative)

If you prefer to use Railway's built-in cron service instead of internal scheduling:

1. Add `CRON_AUTH_TOKEN` environment variable in Railway
2. Configure `railway.json` with cron schedule pointing to the manual trigger endpoints
3. Disable internal scheduler by setting an environment flag

This approach separates scheduling from the web process but requires Railway-specific configuration.

## Troubleshooting

### Jobs Not Running
1. Check logs for startup messages confirming cron scheduling is enabled
2. Verify server restarts properly after deployment
3. Ensure no errors in CronService initialization

### Timezone Issues
- All schedules run in **UTC timezone**
- Pacific times: 3AM UTC = 8PM PDT / 7PM PST
- Adjust schedule strings in `CronService.ts` if needed

### Calendar Integration Issues
- Verify Google Calendar API credentials
- Check `GOOGLE_CALENDAR_ID` environment variable
- Ensure service account has calendar access

### Notion Integration Issues
- Verify `NOTION_TOKEN` and `NOTION_DATABASE_ID`
- Check `ANTHROPIC_API_KEY` for AI parsing
- Ensure Notion integration has database access

## Verification Checklist

After deployment, verify:

- [ ] Server starts without errors
- [ ] Cron scheduling messages appear in startup logs
- [ ] Manual triggers work via Admin panel
- [ ] API endpoints respond correctly
- [ ] Environment variables are properly set
- [ ] First automated run executes on schedule
