# 🚀 Railway Cron Jobs Setup for Automated Tasks

## Overview

This repository now supports **two automated Railway cron jobs** for managing your Notion and Google Calendar integration:

1. **📅 Maintenance Entry Creation** - Creates Notion entries from upcoming Google Calendar events
2. **🔄 Notion Page Ingestion** - Syncs updated Notion pages into the system as work activities

## ✅ What's Been Implemented

### 1. Railway Cron Configuration (`railway.json`)

```json
{
  "cron": [
    {
      "command": "curl -X POST https://$RAILWAY_PUBLIC_DOMAIN/api/cron/maintenance-entries -H 'Content-Type: application/json' -H 'Authorization: Bearer $CRON_AUTH_TOKEN'",
      "schedule": "0 3 * * *"
    },
    {
      "command": "curl -X POST https://$RAILWAY_PUBLIC_DOMAIN/api/cron/notion-sync -H 'Content-Type: application/json' -H 'Authorization: Bearer $CRON_AUTH_TOKEN'",
      "schedule": "0 6,18 * * *"
    }
  ]
}
```

### 2. Cron Job Schedules

| Job | Schedule | Time (Pacific) | Frequency | Purpose |
|-----|----------|----------------|-----------|---------|
| **Maintenance Entries** | `0 3 * * *` | 8PM PDT / 7PM PST | Daily | Create Notion entries for tomorrow's calendar events |
| **Notion Sync** | `0 6,18 * * *` | 11PM/11AM PDT, 10PM/10AM PST | Twice daily | Import updated Notion pages as work activities |

### 3. API Endpoints Added

Both cron jobs have dedicated endpoints that handle Railway authentication:

- **`POST /api/cron/maintenance-entries`** - Triggers maintenance entry creation
- **`POST /api/cron/notion-sync`** - Triggers Notion page synchronization

### 4. Admin Panel Integration

The Admin panel now includes manual trigger buttons for both cron jobs:

- **🌱 Create Tomorrow's Maintenance Entries** - Manually trigger maintenance entry creation
- **🔄 Sync Notion Pages** - Manually trigger Notion sync

## 🔧 Deployment Steps

### Step 1: Environment Variable Setup

In your Railway dashboard, ensure you have the `CRON_AUTH_TOKEN` environment variable:

1. Go to **Railway Dashboard** → Your Project → **Variables**
2. Add or verify this variable exists:
   ```bash
   CRON_AUTH_TOKEN=your_super_secret_long_random_token_here_make_it_32_characters_min
   ```
3. Generate a secure token if needed: `openssl rand -hex 32`

### Step 2: Deploy the Updated Code

```bash
git add .
git commit -m "Add Railway cron jobs for Notion sync and maintenance entries"
git push origin main
```

### Step 3: Verify Railway Cron Setup

1. **Check Railway Dashboard** → Your Project → **Cron**
2. **Should see both jobs:**
   - Maintenance Entries: `0 3 * * *` (daily at 3AM UTC)
   - Notion Sync: `0 6,18 * * *` (twice daily at 6AM & 6PM UTC)
   - Both should show Status: **Active**

### Step 4: Test the Setup

#### Manual Test - Maintenance Entries
```bash
curl -X POST https://your-app.railway.app/api/cron/maintenance-entries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CRON_AUTH_TOKEN"
```

#### Manual Test - Notion Sync
```bash
curl -X POST https://your-app.railway.app/api/cron/notion-sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CRON_AUTH_TOKEN"
```

#### Expected Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "timestamp": "2024-01-15T20:00:00.000Z",
  "triggeredBy": "Railway cron service",
  "stats": { "created": 2, "updated": 1, "errors": 0 }
}
```

## 📊 How Each Job Works

### Maintenance Entry Creation
- **Trigger**: Daily at 8PM Pacific (3AM UTC)
- **Process**:
  1. Fetches tomorrow's Google Calendar events
  2. Filters for yellow client visits (timed events only)
  3. Extracts helper assignments from orange all-day events
  4. Creates or updates Notion maintenance entries
  5. Includes carryover tasks from previous visits
  6. Assigns team members (Andrea + helpers)

### Notion Page Ingestion
- **Trigger**: Twice daily at 6AM & 6PM UTC
- **Process**:
  1. Fetches all Notion pages from configured database
  2. Filters to pages modified since last sync
  3. Uses AI to parse page content into work activity data
  4. Creates new work activities or updates existing ones
  5. Handles client creation, employee assignments, and charges
  6. Prevents duplicates using Notion page IDs

## 🛠️ Environment Variables Required

Ensure these environment variables are set in Railway:

```bash
# Required for both jobs
CRON_AUTH_TOKEN=your_secure_token_here

# For Maintenance Entry Creation
NOTION_TOKEN=secret_your_notion_token
NOTION_DATABASE_ID=your_database_id
GOOGLE_CALENDAR_ID=your_calendar_id

# For Notion Sync
NOTION_TOKEN=secret_your_notion_token
NOTION_DATABASE_ID=your_database_id
ANTHROPIC_API_KEY=your_anthropic_key
```

## 📈 Monitoring and Logs

### Railway Logs
Check Railway logs for execution details:
- **Maintenance Entries**: Look for `🧪 Maintenance entry creation triggered by: Railway cron service`
- **Notion Sync**: Look for `🔄 Notion sync triggered by: Railway cron service`

### Admin Panel
Use the Admin panel to:
- Manually trigger either job for testing
- View execution results and error messages
- Monitor database status after operations

### Expected Log Output

#### Maintenance Entries
```
🧪 Maintenance entry creation triggered by: Railway cron service
📅 Starting to create maintenance entries for tomorrow
👥 Found helper assignments: ["Virginia"]
📋 Found 2 client visits for target day
✅ Successfully created Notion entry for Anne
📊 Completed: 🆕 Created: 1, 📝 Updated: 1, ❌ Errors: 0
```

#### Notion Sync
```
🔄 Notion sync triggered by: Railway cron service
📅 Found 15 pages in Notion database
🤖 Processing page with AI...
✅ Updated: Client Name (2024-01-15)
📊 Sync completed: 🆕 Created: 2, 📝 Updated: 3, ❌ Errors: 0
```

## 🚨 Troubleshooting

### Railway Cron Not Showing
- Check `railway.json` syntax is valid
- Redeploy if needed: Railway detects cron config on deployment

### Authentication Errors
```
401 Unauthorized - requires CRON_AUTH_TOKEN or user authentication
```
- Verify `CRON_AUTH_TOKEN` environment variable is set
- Check token matches between Railway dashboard and cron command

### Notion Sync Failures
- Verify Notion integration has access to the database
- Check `ANTHROPIC_API_KEY` is valid
- Ensure Notion database has required properties

### Calendar Integration Issues
- Verify Google Calendar API credentials
- Check `GOOGLE_CALENDAR_ID` is correct
- Ensure service account has calendar access

## 🎯 Benefits of This Setup

✅ **Automated Workflow** - No manual intervention required  
✅ **Reliable Scheduling** - Railway's infrastructure handles timing  
✅ **Error Handling** - Continues processing even if individual items fail  
✅ **Manual Override** - Admin panel allows manual triggering  
✅ **Comprehensive Logging** - Detailed logs for monitoring and debugging  
✅ **Scalable Architecture** - Independent services that can be modified separately  

## 🔄 Customization Options

### Adjusting Schedules
Edit the `schedule` field in `railway.json`:
- Use [cron expression format](https://crontab.guru/)
- Example: `0 */4 * * *` for every 4 hours

### Modifying Functionality
- **Maintenance Entries**: Edit `CronService.ts`
- **Notion Sync**: Edit `NotionSyncService.ts`
- **Authentication**: Both use the same `CRON_AUTH_TOKEN`

The system is now ready to automatically manage your Notion and Calendar integration! 🚀