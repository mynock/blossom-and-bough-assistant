# Notion Integration Setup Guide

This guide will help you set up the Notion integration for creating smart work entries with automatic task carryover.

## 🎯 Overview

The integration allows you to:
- Create new Notion work entries quickly via an embeddable interface
- Automatically carry over incomplete tasks from the previous client visit
- Access the interface directly from Notion using an embed

## 📋 Prerequisites

1. A Notion workspace with admin access
2. A Notion database for work log entries
3. Your CRM system running (both frontend and backend)

## 🔧 Setup Steps

### 1. Create Notion Integration

1. Go to [https://notion.so/my-integrations](https://notion.so/my-integrations)
2. Click "Create new integration"
3. Fill in the details:
   - **Name**: "Blossom & Bough CRM"
   - **Logo**: Upload your company logo (optional)
   - **Associated workspace**: Select your workspace
4. Click "Submit"
5. **Important**: Copy the "Internal Integration Token" - you'll need this for `NOTION_TOKEN`

### 2. Create/Configure Notion Database

You need a Notion database with these **exact property names**:

| Property Name | Type | Description |
|---------------|------|-------------|
| `Client Name` | **Select** | Name of the client (auto-creates new options) |
| `Date` | Date | Date of the work entry |
| `Work Type` | Select | Type of work (will default to "Maintenance") |

#### Creating a new database:
1. In Notion, create a new page
2. Type `/database` and select "Table - Full page"
3. Name it "Work Log Entries"
4. Add the properties listed above

#### Using an existing database:
Make sure your database has the required properties with exact names.

### 3. Share Database with Integration

1. Open your Work Log Entries database in Notion
2. Click the "•••" (more options) button in the top right
3. Click "Add connections"
4. Find and select your "Blossom & Bough CRM" integration
5. Click "Confirm"

### 4. Get Database ID

1. Open your Work Log Entries database in Notion
2. Look at the URL - it will look like:
   ```
   https://notion.so/workspace/DatabaseName-1234567890abcdef1234567890abcdef?v=...
   ```
3. Copy the long string between the last `/` and `?` (or at the end if no `?`)
   - In the example above: `1234567890abcdef1234567890abcdef`
4. This is your `NOTION_DATABASE_ID`

### 5. Update Environment Variables

Add these to your `.env` file:

```env
# Notion Integration
NOTION_TOKEN=secret_your_notion_token_here
NOTION_DATABASE_ID=your_database_id_here
```

Replace the placeholder values with:
- `NOTION_TOKEN`: The token from step 1
- `NOTION_DATABASE_ID`: The database ID from step 4

### 6. Restart Your Server

After updating the environment variables, restart your server:

```bash
# If running in development
npm run dev

# Or if running in production
npm run start
```

## 🧪 Testing

### Test the API Endpoint

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

### Test the Health Check

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

### Test the Frontend

1. Navigate to `http://localhost:3000/notion-embed`
2. You should see the "🌱 Quick Work Entry" interface
3. Click on any client button to test creating an entry

## 🌐 Embedding in Notion

### Method 1: Direct Embed (Recommended)

1. In Notion, create a new page (or use an existing one)
2. Type `/embed` and press Enter
3. Enter your embed URL:
   ```
   http://localhost:3000/notion-embed
   ```
   (Replace with your production URL when deployed)
4. Press Enter and adjust the embed size as needed

### Method 2: Using an iframe (Alternative)

You can also embed using HTML if you have a Notion page that supports HTML:

```html
<iframe 
  src="http://localhost:3000/notion-embed" 
  width="400" 
  height="600"
  frameborder="0">
</iframe>
```

## 📝 Customization

### Client Names

Update the client list in `src/components/NotionQuickEntry.tsx`:

```typescript
const clients = ['Your', 'Client', 'Names', 'Here'];
```

### Database Properties

If you need different database properties, update the `createEntryWithCarryover` method in `server/src/services/NotionService.ts`.

### Styling

The embedded interface uses Material-UI components and can be customized in `src/components/NotionQuickEntry.tsx`.

## 🔧 Troubleshooting

### Common Issues

1. **"NOTION_TOKEN not found"**
   - Make sure you've added the token to your `.env` file
   - Restart your server after adding environment variables

2. **"NOTION_DATABASE_ID not found"**
   - Verify the database ID is correct
   - Make sure there are no extra characters or spaces

3. **"Unauthorized" errors**
   - Ensure your integration has access to the database
   - Check that you've shared the database with your integration

4. **"Property does not exist" errors**
   - Verify your database has properties named exactly: `Client Name`, `Date`, `Work Type`
   - Property names are case-sensitive

5. **Embed not loading in Notion**
   - Make sure your server is running and accessible
   - Check your firewall settings
   - Try the direct URL first: `http://localhost:3000/notion-embed`

### Health Check

Always check the health endpoint to verify your configuration:
```bash
curl http://localhost:3001/api/notion/health
```

## 🚀 Production Deployment

When deploying to production:

1. Update your environment variables on your hosting platform
2. Update the embed URL in Notion to use your production domain
3. Make sure your production server is accessible from Notion's servers

## 🔄 Usage Workflow

1. **Open Notion dashboard** with your embedded interface
2. **Select or type client name**:
   - Choose from existing clients in the dropdown
   - OR type a new client name (will be automatically added to Notion)
3. **Click "Create Work Entry"**
4. **System automatically**:
   - Finds the last entry for that client (if exists)
   - Extracts any unchecked tasks
   - Creates a new entry with those tasks pre-filled
   - Adds new client names to the Notion select field options
5. **Click "Open Work Entry"** to edit the new Notion page
6. **Add new tasks** and mark completed tasks as done

## ✨ New Features

### **Smart Client Management**
- **Auto-complete with existing clients** from your CRM database
- **Free text input** for new clients not yet in your system
- **Automatic Notion integration** - new clients are added to the select field options

### **Flexible Client Selection**
- **Existing clients**: Type to search through all clients in your database
- **New clients**: Simply type any new client name and create entries immediately
- **Seamless integration**: All client names become available in future Notion entries

This provides seamless task carryover while maintaining your structured database approach! 🌱 