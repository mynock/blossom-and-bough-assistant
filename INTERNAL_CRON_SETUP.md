# 🕐 Internal Cron Jobs Setup for Automated Tasks

## Overview

This repository uses **internal Node.js cron scheduling** (via `node-cron`) for automated tasks instead of external cron services. This approach is simpler, more reliable, and doesn't depend on platform-specific features.

## ✅ What's Implemented

### 1. Two Automated Tasks

| Task | Schedule | Time (Pacific) | Purpose |
|------|----------|----------------|---------|
| **Maintenance Entries** | `0 3 * * *` | 8PM PDT / 7PM PST | Create Notion entries for tomorrow's calendar events |
| **Notion Sync** | `0 6,18 * * *` | 11PM/11AM PDT, 10PM/10AM PST | Import updated Notion pages as work activities |

### 2. Internal Scheduling Implementation

The cron jobs run **inside your Railway application** using the `node-cron` package:

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

### 3. Manual Trigger Endpoints

For testing and manual execution, these endpoints are still available:

- **`POST /api/cron/maintenance-entries`** - Manual maintenance entry creation
- **`POST /api/cron/notion-sync`** - Manual Notion sync trigger

### 4. Admin Panel Integration

The Admin panel includes manual trigger buttons:
- **🌱 Create Tomorrow's Maintenance Entries**
- **🔄 Sync Notion Pages**

## 🚀 Deployment Steps

### Step 1: Deploy the Code

```bash
git add .
git commit -m "Switch to internal cron scheduling"
git push origin main
```

### Step 2: Verify Startup Logs

After deployment, check Railway logs for:

```
🚀 Server running on port 3000
✅ Internal cron scheduling enabled:
   📅 Maintenance entries: Daily at 8PM PDT/7PM PST (3AM UTC)
   🔄 Notion sync: Twice daily at 6AM & 6PM UTC
```

### Step 3: Monitor Execution

Look for these log entries when cron jobs run:

```
🕐 Daily Notion maintenance entry cron job started
🔄 Notion sync cron job started
📊 Notion sync completed: Created 2, Updated 3, Errors 0
```

## 🛠️ Environment Variables Required

Ensure these environment variables are set in Railway:

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

## 📊 How It Works

### Architecture

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

### Benefits

✅ **Simple Setup** - No external dependencies or platform features  
✅ **Reliable** - Runs inside your application process  
✅ **Self-Contained** - Everything in one codebase  
✅ **Easy Debugging** - Logs appear with your application logs  
✅ **Platform Independent** - Works on any hosting provider  
✅ **Resource Efficient** - Uses existing app resources  

### Maintenance Entry Creation Process

1. **Triggers**: Daily at 3AM UTC (8PM Pacific)
2. **Fetches**: Tomorrow's Google Calendar events
3. **Filters**: Yellow client visits (timed events only)
4. **Extracts**: Helper assignments from orange all-day events
5. **Creates**: Notion maintenance entries with carryover tasks
6. **Assigns**: Team members (Andrea + helpers)

### Notion Page Ingestion Process

1. **Triggers**: Twice daily at 6AM & 6PM UTC
2. **Fetches**: All Notion pages from configured database
3. **Filters**: Pages modified since last sync
4. **Parses**: Content using AI to extract work activity data
5. **Creates/Updates**: Work activities in the system
6. **Prevents**: Duplicates using Notion page IDs

## 🧪 Testing

### Manual Testing via Admin Panel
1. Navigate to `/admin`
2. Go to "Automated Tasks" section
3. Click the trigger buttons to test manually

### Manual Testing via API
```bash
# Test maintenance entries
curl -X POST https://your-app.railway.app/api/cron/maintenance-entries \
  -H "Authorization: Bearer YOUR_CRON_AUTH_TOKEN"

# Test Notion sync
curl -X POST https://your-app.railway.app/api/cron/notion-sync \
  -H "Authorization: Bearer YOUR_CRON_AUTH_TOKEN"
```

### Check Logs
Monitor Railway logs for:
- Cron job startup messages
- Execution logs with emojis (🕐 📅 🔄 ✅ ❌)
- Success/failure summaries

## 🚨 Troubleshooting

### Jobs Not Running
1. **Check logs** for startup messages
2. **Verify** server restarts properly after deployment
3. **Ensure** no errors in CronService initialization

### Timezone Issues
- All schedules run in **UTC timezone**
- Pacific times are calculated: 3AM UTC = 8PM PDT / 7PM PST
- Adjust schedule strings if needed: `cron.schedule('0 3 * * *', ...)`

### Resource Usage
- Cron jobs run **inside your existing app**
- No additional memory/CPU overhead for scheduling
- Jobs use the same database connections and services

### Calendar Integration Issues
- Verify Google Calendar API credentials
- Check `GOOGLE_CALENDAR_ID` environment variable
- Ensure service account has calendar access

### Notion Integration Issues
- Verify `NOTION_TOKEN` and `NOTION_DATABASE_ID`
- Check `ANTHROPIC_API_KEY` for AI parsing
- Ensure Notion integration has database access

## 🔄 Customization

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
  debugLog.info('🆕 New scheduled task started');
  // Your logic here
}, {
  scheduled: true,
  timezone: 'UTC'
});
```

### Disabling Tasks Temporarily
```typescript
// Comment out or add conditions
if (process.env.ENABLE_MAINTENANCE_CRON !== 'false') {
  cron.schedule('0 3 * * *', async () => {
    await this.createMaintenanceEntriesForTomorrow();
  });
}
```

## ✅ Verification Checklist

After deployment, verify:

- [ ] **Server starts** without errors
- [ ] **Cron scheduling messages** appear in startup logs
- [ ] **Manual triggers** work via Admin panel
- [ ] **API endpoints** respond correctly
- [ ] **Environment variables** are properly set
- [ ] **First automated run** executes on schedule

Your automated tasks are now running reliably inside your Railway application! 🚀