# Notion Maintenance Entry Cron Job Setup

## Overview

This document describes the automated system that creates Notion maintenance entries for upcoming client visits based on Google Calendar events. The system runs daily at 8PM Pacific Time and prepares maintenance entries for the next day's scheduled client visits.

## 🎯 What It Does

### Daily Automated Process
- **Runs at 8PM Pacific Time** (3AM UTC) every day
- **Fetches tomorrow's calendar events** from Google Calendar
- **Filters for yellow client visits** using Google Calendar colorId property
- **Extracts helper assignments** from orange all-day events
- **Creates or updates Notion maintenance entries** for each client visit
- **Includes carryover tasks** from previous incomplete visits
- **Assigns correct team members** based on orange helper events
- **Handles duplicate prevention** by checking for existing entries

### Smart Entry Management
1. **For New Clients**: Creates fresh maintenance entries with basic template
2. **For Existing Clients**: Carries over uncompleted tasks from previous visits
3. **For Existing Tomorrow Entries**: Updates the entry instead of creating duplicates
4. **Error Handling**: Logs all operations and continues processing even if individual entries fail

## 🔧 Implementation Details

### Files Added/Modified

#### New Files
- `server/src/services/CronService.ts` - Main cron job service
- `NOTION_MAINTENANCE_CRON_SETUP.md` - This documentation

#### Modified Files
- `server/package.json` - Added `node-cron` and `@types/node-cron` dependencies
- `server/src/server.ts` - Integrated CronService initialization and manual trigger endpoint

### Dependencies Added
```json
{
  "node-cron": "^3.0.3",
  "@types/node-cron": "^3.0.11"
}
```

### Environment Variables Required
The system uses existing environment variables:
- `NOTION_TOKEN` - Notion integration token
- `NOTION_DATABASE_ID` - Target Notion database ID
- `NOTION_TEMPLATE_ID` - (Optional) Template page ID for structured entries
- `GOOGLE_CALENDAR_ID` - Google Calendar ID to read events from

## 🚀 Usage

### Automatic Operation
The cron job starts automatically when the server starts and runs daily at 8PM Pacific Time.

### Manual Testing
You can manually trigger the cron job for testing:

```bash
# Using curl (requires authentication)
curl -X POST http://localhost:3001/api/cron/maintenance-entries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Or use the Admin panel in your CRM interface.

### Monitoring
Check the server logs for cron job execution:
- Look for log entries with emojis: 🕐 📅 🏡 ✅ ❌
- Logs include detailed information about what was processed and any errors

## 📊 Expected Behavior

### Calendar Event Processing
The system processes calendar events as follows:

1. **Yellow Client Visits (colorId: "5" or "11")**:
   - ✅ Creates Notion maintenance entries
   - ✅ Extracts client name from event title
   - ✅ Includes carryover tasks from previous visits
   - ✅ Must be timed events (not all-day)

2. **Orange All-Day Events (colorId: "6")**:
   - ✅ Extracted as helper assignments
   - ✅ Assigned to corresponding client visits on same day
   - ✅ Simple names like "Virginia", "Andrea"

3. **Other Colored Events**:
   - ❌ Skipped - these represent other activities, not client visits
   - ❌ Includes purple tasks, meetings, etc.

### Client Name Extraction
The system extracts client names from calendar event titles using these patterns:

1. **"Client Name - Service Type - Helper Name"** → Extracts "Client Name"
2. **"Client Name (Service Type)"** → Extracts "Client Name"  
3. **"Simple Client Name"** → Uses the entire title if reasonable length

### Notion Entry Creation
For each valid client visit, the system:

1. **Checks for existing entry** for tomorrow's date
2. **If exists**: Updates the entry with a timestamp
3. **If doesn't exist**: 
   - Gets carryover tasks from last client visit
   - Creates new entry with tomorrow's date
   - Includes all uncompleted tasks from previous visit
   - Adds basic template structure (Tasks, Notes sections)

## 🛠️ Configuration

### Cron Schedule
The current schedule runs at **3AM UTC** which corresponds to:
- **8PM PDT** (Pacific Daylight Time - March to November)
- **7PM PST** (Pacific Standard Time - November to March)

To modify the schedule, edit the `cronExpression` in `CronService.ts`:
```typescript
const cronExpression = '0 3 * * *'; // minute hour day month weekday
```

### Template Customization
The system creates entries with this basic structure:
- **Tasks section** with carryover tasks
- **Notes section** for visit notes
- **Client Name, Date, Work Type** properties set automatically

To customize, modify the `templateBlocks` array in `createMaintenanceEntryForDate()`.

## 📋 Example Logs

### Successful Execution
```
🕐 Daily Notion maintenance entry cron job started
📅 Processing calendar events for date: 2024-01-16
📋 Found 3 client visits for tomorrow
🏡 Processing client visit: Anne
🆕 Creating new entry for Anne on 2024-01-16
📋 Found 2 carryover tasks from last entry
✅ Successfully created Notion entry for Anne
📊 Daily maintenance entry creation completed:
   🆕 Created: 2
   📝 Updated: 1
   ❌ Errors: 0
```

### Error Handling
```
⚠️ Could not extract client name from event: "Team Meeting"
❌ Failed to create Notion entry for Client: API rate limit exceeded
📊 Daily maintenance entry creation completed:
   🆕 Created: 1
   📝 Updated: 0
   ❌ Errors: 2
```

## 🔍 Troubleshooting

### Common Issues

1. **No entries created**
   - Check if calendar events exist for tomorrow
   - Verify events are timed (not all-day) client visits
   - Check Google Calendar API credentials

2. **Notion API errors**
   - Verify `NOTION_TOKEN` and `NOTION_DATABASE_ID` are correct
   - Check Notion database has required properties: `Client Name`, `Date`, `Work Type`, `Team Members`, `Title`
   - Ensure Notion integration has access to the database

3. **Client name extraction issues**
   - Check calendar event title formats
   - Modify `extractClientNameFromEvent()` method for custom formats

4. **Timezone issues**
   - Cron runs in UTC, so 3AM UTC = 8PM PDT / 7PM PST
   - Modify `cronExpression` if you need different timing

### Debug Commands

```bash
# Check cron service status in logs
tail -f server/logs/debug.log | grep "cron\|🕐\|📅"

# Manual test
curl -X POST http://localhost:3001/api/cron/maintenance-entries

# Check Notion integration health
curl http://localhost:3001/api/notion/health
```

## 🚀 Railway Deployment

The cron job is designed to work seamlessly with Railway deployment:

1. **Automatic startup**: Cron job starts when the server starts
2. **UTC timezone**: Configured for Railway's UTC environment
3. **Environment variables**: Uses Railway's environment variable system
4. **Logging**: All operations logged for Railway's log viewer

### Railway Configuration
No additional Railway configuration is needed. The cron job runs within your existing server process.

## 🔄 Future Enhancements

Potential improvements for the system:

1. **Enhanced updates**: More sophisticated merging of carryover tasks for existing entries
2. **Staff assignment**: Include helper information from orange all-day events
3. **Custom templates**: Different templates based on client type or service
4. **Notification system**: Slack/email notifications for creation summary
5. **Retry logic**: Automatic retry for failed entries
6. **Analytics**: Track entry creation success rates and common errors

## ✅ Verification

To verify the system is working:

1. **Check server startup logs** for cron initialization message
2. **Wait for or trigger** a cron job execution
3. **Review Notion database** for new entries with tomorrow's date
4. **Check server logs** for execution summary

The system is now ready to automatically prepare your daily maintenance entries! 🌱