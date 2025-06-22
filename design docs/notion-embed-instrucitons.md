Here are the instructions for implementing the Notion integration in your existing CRM:

---

## **Task: Add Notion Integration for Smart Work Entry Creation**

### **Overview**
Add API endpoints and React components to enable creating Notion work log entries with automatic carryover of uncompleted tasks from previous visits. This will be embedded in Notion for field use.

### **Backend Implementation**

#### **1. Install Dependencies**
```bash
npm install @notionhq/client
```

#### **2. Environment Variables**
Add to your `.env` file:
```
NOTION_TOKEN=secret_your_notion_token_here
NOTION_DATABASE_ID=your_database_id_here
```

#### **3. Create Notion Service**
Create a new service file `src/services/notionService.ts`:

```typescript
import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID!;

export interface NotionWorkEntry {
  id: string;
  url: string;
  client_name: string;
  date: string;
  carryover_tasks: string[];
}

export class NotionService {
  async getLastEntryForClient(clientName: string) {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: 'Client Name',
        rich_text: { equals: clientName },
      },
      sorts: [{ property: 'Date', direction: 'descending' }],
      page_size: 1,
    });

    return response.results[0] || null;
  }

  async extractUncompletedTasks(pageId: string): Promise<string[]> {
    const response = await notion.blocks.children.list({
      block_id: pageId,
    });

    const uncompletedTasks: string[] = [];
    
    for (const block of response.results) {
      if (block.type === 'to_do' && 'to_do' in block) {
        if (!block.to_do.checked && block.to_do.rich_text.length > 0) {
          const taskText = block.to_do.rich_text
            .map(text => text.plain_text)
            .join('');
          uncompletedTasks.push(taskText);
        }
      }
    }

    return uncompletedTasks;
  }

  async createEntryWithCarryover(clientName: string, carryoverTasks: string[]) {
    const children: any[] = [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ text: { content: "Today's Tasks" } }],
        },
      },
    ];

    if (carryoverTasks.length > 0) {
      children.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ text: { content: 'From last visit:' } }],
        },
      });

      carryoverTasks.forEach(task => {
        children.push({
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [{ text: { content: task } }],
            checked: false,
          },
        });
      });
    }

    children.push(
      {
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ text: { content: 'New today:' } }],
        },
      },
      {
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: [{ text: { content: 'Add new tasks here' } }],
          checked: false,
        },
      }
    );

    const response = await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties: {
        'Client Name': {
          rich_text: [{ text: { content: clientName } }],
        },
        Date: {
          date: { start: new Date().toISOString().split('T')[0] },
        },
        'Work Type': {
          select: { name: 'Maintenance' },
        },
      },
      children,
    });

    return response;
  }
}
```

#### **4. Create API Route**
Create `src/routes/notion.ts`:

```typescript
import { Request, Response } from 'express';
import { NotionService } from '../services/notionService';

const notionService = new NotionService();

interface CreateSmartEntryRequest {
  client_name: string;
}

export const createSmartEntry = async (req: Request, res: Response) => {
  try {
    const { client_name } = req.body as CreateSmartEntryRequest;
    
    if (!client_name) {
      return res.status(400).json({ error: 'client_name required' });
    }

    // Get last entry for client
    const lastEntry = await notionService.getLastEntryForClient(client_name);
    let carryoverTasks: string[] = [];
    
    if (lastEntry) {
      carryoverTasks = await notionService.extractUncompletedTasks(lastEntry.id);
    }

    // Create new Notion entry
    const newPage = await notionService.createEntryWithCarryover(client_name, carryoverTasks);
    
    res.json({
      success: true,
      page_url: newPage.url,
      carryover_tasks: carryoverTasks,
    });
  } catch (error) {
    console.error('Error creating smart entry:', error);
    res.status(500).json({ error: 'Failed to create entry' });
  }
};
```

#### **5. Add Route to Express App**
In your main router/app file, add:

```typescript
import { createSmartEntry } from './routes/notion';

// Add this route
app.post('/api/notion/create-smart-entry', createSmartEntry);
```

### **Frontend Implementation**

#### **6. Create Notion Quick Entry Component**
Create `src/components/NotionQuickEntry.tsx`:

```tsx
import React, { useState } from 'react';

interface CreateEntryResponse {
  success: boolean;
  page_url: string;
  carryover_tasks: string[];
  error?: string;
}

const NotionQuickEntry: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<CreateEntryResponse | null>(null);

  const clients = ['Stoller', 'Nadler', 'Thomas', 'Kurzweil', 'Feigum', 'Campbell'];

  const createEntry = async (clientName: string) => {
    setLoading(clientName);
    setResult(null);

    try {
      const response = await fetch('/api/notion/create-smart-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ client_name: clientName }),
      });

      const data: CreateEntryResponse = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        page_url: '',
        carryover_tasks: [],
        error: 'Failed to create entry',
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ 
      fontFamily: 'system-ui', 
      padding: '20px', 
      maxWidth: '400px',
      margin: '0 auto',
      backgroundColor: 'white'
    }}>
      <h2 style={{ marginBottom: '20px', color: '#333' }}>🌱 Quick Work Entry</h2>
      
      {clients.map(client => (
        <button
          key={client}
          onClick={() => createEntry(client)}
          disabled={loading === client}
          style={{
            width: '100%',
            padding: '15px',
            margin: '8px 0',
            fontSize: '16px',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: loading === client ? '#ccc' : '#2ea44f',
            color: 'white',
            cursor: loading === client ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          {loading === client ? 'Creating...' : `Start ${client} Visit`}
        </button>
      ))}

      {result && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: result.success ? '#d4edda' : '#f8d7da',
          borderRadius: '6px',
          border: `1px solid ${result.success ? '#c3e6cb' : '#f5c6cb'}`,
        }}>
          {result.success ? (
            <>
              <div style={{ marginBottom: '8px' }}>✅ Created entry successfully</div>
              <div style={{ marginBottom: '12px' }}>📋 Carried over {result.carryover_tasks.length} tasks</div>
              <a 
                href={result.page_url} 
                target="_parent"
                style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  backgroundColor: '#0969da',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                → Open Work Entry
              </a>
            </>
          ) : (
            <div style={{ color: '#721c24' }}>❌ Error: {result.error}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotionQuickEntry;
```

#### **7. Create Embeddable Page**
Create `src/pages/NotionEmbedPage.tsx`:

```tsx
import React from 'react';
import NotionQuickEntry from '../components/NotionQuickEntry';

const NotionEmbedPage: React.FC = () => {
  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: 'white',
      padding: '0',
      margin: '0',
      boxSizing: 'border-box'
    }}>
      <NotionQuickEntry />
    </div>
  );
};

export default NotionEmbedPage;
```

#### **8. Add Route to React Router**
In your main routing file (App.tsx or routes file), add:

```tsx
import NotionEmbedPage from './pages/NotionEmbedPage';

// Add this route to your existing Routes
<Route path="/notion-embed" element={<NotionEmbedPage />} />
```

### **Setup Instructions**

1. **Get Notion API credentials:**
   - Go to https://notion.so/my-integrations
   - Create new integration
   - Copy the API token
   - Share your Work Log Entries database with the integration

2. **Get Database ID:**
   - Open your Notion database
   - Copy the long string from the URL between last `/` and `?`

3. **Add environment variables** to your `.env` file

4. **Test the endpoint:**
   ```bash
   curl -X POST http://localhost:3000/api/notion/create-smart-entry \
     -H "Content-Type: application/json" \
     -d '{"client_name": "Stoller"}'
   ```

5. **Embed in Notion:**
   - Create a Notion page
   - Type `/embed`
   - Enter: `https://crm.blossomandbough.com/notion-embed`

### **Usage Flow**
1. User opens Notion dashboard page with embed
2. Clicks client button (e.g., "Start Stoller Visit")
3. API finds last Stoller entry and extracts unchecked tasks
4. Creates new Notion entry with carryover tasks pre-filled
5. User clicks "Open Work Entry" to edit the new entry

This provides seamless task carryover while maintaining the structured database approach for your CRM parsing.