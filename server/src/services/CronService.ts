import * as cron from 'node-cron';
import { GoogleCalendarService } from './GoogleCalendarService';
import { NotionService } from './NotionService';
import { debugLog } from '../utils/logger';

export class CronService {
  private googleCalendarService: GoogleCalendarService;
  private notionService: NotionService;
  private isScheduled = false;

  constructor() {
    this.googleCalendarService = new GoogleCalendarService();
    this.notionService = new NotionService();
  }

  public startScheduledTasks(): void {
    if (this.isScheduled) {
      debugLog.info('🔄 Cron tasks already scheduled');
      return;
    }

    // Schedule daily task at 8PM Pacific Time
    // Note: Railway containers run in UTC, so we need to convert Pacific Time
    // Pacific Standard Time (PST) = UTC-8, Pacific Daylight Time (PDT) = UTC-7
    // For 8PM Pacific, we need 4AM UTC (PST) or 3AM UTC (PDT)
    // Using 3AM UTC to accommodate most of the year (PDT is active longer)
    const cronExpression = '0 3 * * *'; // 3AM UTC = 8PM PDT, 7PM PST
    
    cron.schedule(cronExpression, async () => {
      debugLog.info('🕐 Daily Notion maintenance entry cron job started');
      await this.createMaintenanceEntriesForTomorrow();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.isScheduled = true;
    debugLog.info('✅ Daily Notion maintenance entry job scheduled for 8PM PDT/7PM PST (3AM UTC)');
  }

  public async createMaintenanceEntriesForTomorrow(): Promise<void> {
    try {
      debugLog.info('📅 Starting to create maintenance entries for tomorrow');
      
      // Get tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0); // Start of tomorrow
      
      const tomorrowDateString = tomorrow.toISOString().split('T')[0];
      
      debugLog.info(`📅 Processing calendar events for date: ${tomorrowDateString}`);
      
      // Get calendar events for tomorrow (1 day ahead)
      const events = await this.googleCalendarService.getEvents(1);
      
      // Filter for tomorrow's events that are client visits (non-all-day events)
      const tomorrowClientVisits = events.filter(event => {
        const eventDate = new Date(event.start);
        const eventDateString = eventDate.toISOString().split('T')[0];
        
        // Must be tomorrow's date
        if (eventDateString !== tomorrowDateString) {
          return false;
        }
        
        // Must be a client visit (non-all-day event with dateTime, not just date)
        // All-day events have only 'date' property, timed events have 'dateTime'
        const isTimedEvent = event.start.includes('T'); // ISO datetime format includes 'T'
        
        // Must have a client name/title
        const hasClientInfo = event.title && event.title.trim().length > 0;
        
        return isTimedEvent && hasClientInfo;
      });
      
      debugLog.info(`📋 Found ${tomorrowClientVisits.length} client visits for tomorrow`);
      
      if (tomorrowClientVisits.length === 0) {
        debugLog.info('ℹ️ No client visits scheduled for tomorrow');
        return;
      }
      
      // Process each client visit
      const results = {
        created: 0,
        updated: 0,
        errors: 0
      };
      
      for (const event of tomorrowClientVisits) {
        try {
          // Extract client name from event title
          const clientName = this.extractClientNameFromEvent(event);
          
          if (!clientName) {
            debugLog.warn(`⚠️ Could not extract client name from event: ${event.title}`);
            results.errors++;
            continue;
          }
          
          debugLog.info(`🏡 Processing client visit: ${clientName}`);
          
          // Check if an entry already exists for this client for tomorrow
          const existingEntry = await this.getEntryForClientAndDate(clientName, tomorrowDateString);
          
          if (existingEntry) {
            debugLog.info(`📝 Entry already exists for ${clientName} on ${tomorrowDateString}, updating it`);
            
            // Update the existing entry
            await this.updateExistingEntry(existingEntry.id, clientName);
            results.updated++;
            
          } else {
            debugLog.info(`🆕 Creating new entry for ${clientName} on ${tomorrowDateString}`);
            
            // Create new entry with tomorrow's date and carryover tasks
            const result = await this.createMaintenanceEntryForDate(clientName, tomorrowDateString);
            
            if (result.success) {
              debugLog.info(`✅ Successfully created Notion entry for ${clientName}`);
              debugLog.info(`📝 Entry URL: ${result.page_url}`);
              debugLog.info(`📋 Carryover tasks: ${result.carryover_tasks.length}`);
              results.created++;
            } else {
              debugLog.error(`❌ Failed to create Notion entry for ${clientName}: ${result.error}`);
              results.errors++;
            }
          }
          
        } catch (error) {
          debugLog.error(`❌ Error processing client visit: ${event.title}`, error);
          results.errors++;
        }
      }
      
      debugLog.info(`📊 Daily maintenance entry creation completed:`);
      debugLog.info(`   🆕 Created: ${results.created}`);
      debugLog.info(`   📝 Updated: ${results.updated}`);
      debugLog.info(`   ❌ Errors: ${results.errors}`);
      
    } catch (error) {
      debugLog.error('❌ Error in daily maintenance entry creation:', error);
    }
  }

  private async getEntryForClientAndDate(clientName: string, dateString: string): Promise<any> {
    try {
      debugLog.info(`🔍 Checking for existing entry: ${clientName} on ${dateString}`);
      
      // Use reflection to access the notion client and database ID from NotionService
      const notion = (this.notionService as any).notion || (this.notionService as any).client;
      const DATABASE_ID = process.env.NOTION_DATABASE_ID;
      
      if (!notion || !DATABASE_ID) {
        debugLog.error('❌ Cannot access Notion client or database ID');
        return null;
      }
      
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        filter: {
          and: [
            {
              property: 'Client Name',
              select: { equals: clientName },
            },
            {
              property: 'Date',
              date: { equals: dateString },
            }
          ]
        },
        page_size: 1,
      });

      const entry = response.results[0] || null;
      debugLog.info(`🔍 Found ${response.results.length} existing entries for ${clientName} on ${dateString}`);
      
      return entry;
    } catch (error) {
      debugLog.error(`❌ Error checking for existing entry: ${clientName} on ${dateString}`, error);
      return null;
    }
  }

  private async updateExistingEntry(pageId: string, clientName: string): Promise<void> {
    try {
      debugLog.info(`📝 Updating existing entry ${pageId} for ${clientName}`);
      
      // For now, we'll just update the page title to indicate it was refreshed
      // In the future, you could add logic to merge carryover tasks or update other fields
      const notion = (this.notionService as any).notion || (this.notionService as any).client;
      
      if (!notion) {
        debugLog.error('❌ Cannot access Notion client for update');
        return;
      }
      
      // Get current page to preserve existing data
      const currentPage = await notion.pages.retrieve({ page_id: pageId });
      const currentTitle = (currentPage as any).properties?.Title?.title?.[0]?.text?.content || `${clientName} (Maintenance)`;
      
      // Update the page with a fresh timestamp in the title to indicate it was auto-updated
      const updatedTitle = currentTitle.includes('(Auto-updated') 
        ? currentTitle.replace(/\(Auto-updated.*?\)/, `(Auto-updated ${new Date().toLocaleTimeString()})`)
        : `${currentTitle} (Auto-updated ${new Date().toLocaleTimeString()})`;
      
      await notion.pages.update({
        page_id: pageId,
        properties: {
          Title: {
            title: [{ text: { content: updatedTitle } }],
          }
        }
      });
      
      debugLog.info(`✅ Successfully updated entry for ${clientName}`);
      
    } catch (error) {
      debugLog.error(`❌ Error updating existing entry for ${clientName}:`, error);
      throw error;
    }
  }

  private async createMaintenanceEntryForDate(clientName: string, dateString: string): Promise<any> {
    try {
      debugLog.info(`🆕 Creating maintenance entry for ${clientName} on ${dateString}`);
      
      // Get carryover tasks from the last entry
      const lastEntry = await (this.notionService as any).getLastEntryForClient(clientName);
      let carryoverTasks: string[] = [];
      
      if (lastEntry) {
        carryoverTasks = await (this.notionService as any).extractUncompletedTasks(lastEntry.id);
        debugLog.info(`📋 Found ${carryoverTasks.length} carryover tasks from last entry`);
      }
      
      // Use reflection to access the notion client and create entry with specific date
      const notion = (this.notionService as any).notion || (this.notionService as any).client;
      const DATABASE_ID = process.env.NOTION_DATABASE_ID;
      const TEMPLATE_ID = process.env.NOTION_TEMPLATE_ID;
      
      if (!notion || !DATABASE_ID) {
        throw new Error('Cannot access Notion client or database ID');
      }
      
      // Ensure client exists in database options
      await (this.notionService as any).ensureClientExistsInDatabase(clientName);
      
      // Create new page with the specified date (tomorrow)
      const pageTitle = `${clientName} (Maintenance)`;
      const response = await notion.pages.create({
        parent: { database_id: DATABASE_ID },
        properties: {
          'Client Name': {
            select: { name: clientName },
          },
          Date: {
            date: { start: dateString }, // Use tomorrow's date instead of today
          },
          'Work Type': {
            select: { name: 'Maintenance' },
          },
          'Team Members': {
            multi_select: [{ name: 'Andrea' }],
          },
          Title: {
            title: [{ text: { content: pageTitle } }],
          }
        },
      });
      
      // Add basic template structure with carryover tasks
      const templateBlocks = [
        // Tasks section
        {
          object: 'block' as const,
          type: 'heading_2' as const,
          heading_2: {
            rich_text: [{ text: { content: 'Tasks' } }],
          },
        },
        // Add carryover tasks if any
        ...carryoverTasks.map(task => ({
          object: 'block' as const,
          type: 'to_do' as const,
          to_do: {
            rich_text: [{ text: { content: task } }],
            checked: false,
          },
        })),
        // Add a default to-do item if no carryover tasks
        ...(carryoverTasks.length === 0 ? [{
          object: 'block' as const,
          type: 'to_do' as const,
          to_do: {
            rich_text: [{ text: { content: 'To-do' } }],
            checked: false,
          },
        }] : []),
        // Notes section
        {
          object: 'block' as const,
          type: 'heading_2' as const,
          heading_2: {
            rich_text: [{ text: { content: 'Notes' } }],
          },
        },
        {
          object: 'block' as const,
          type: 'paragraph' as const,
          paragraph: {
            rich_text: [],
          },
        },
      ];
      
      // Add the template blocks to the page
      await notion.blocks.children.append({
        block_id: response.id,
        children: templateBlocks,
      });
      
      debugLog.info(`✅ Successfully created entry for ${clientName} on ${dateString}`);
      
      return {
        success: true,
        page_url: (response as any).url || `https://notion.so/${response.id.replace(/-/g, '')}`,
        carryover_tasks: carryoverTasks,
      };
      
    } catch (error) {
      debugLog.error(`❌ Error creating maintenance entry for ${clientName} on ${dateString}:`, error);
      return {
        success: false,
        page_url: '',
        carryover_tasks: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private extractClientNameFromEvent(event: any): string | null {
    if (!event.title) return null;
    
    // Try different formats to extract client name
    const title = event.title.trim();
    
    // Format 1: "Client Name - Service Type - Helper Name"
    const dashFormat = title.split(' - ');
    if (dashFormat.length >= 1) {
      const clientName = dashFormat[0].trim();
      if (clientName.length > 0) {
        return clientName;
      }
    }
    
    // Format 2: "Client Name (Service Type)"
    const parenMatch = title.match(/^([^(]+)\s*\(/);
    if (parenMatch) {
      const clientName = parenMatch[1].trim();
      if (clientName.length > 0) {
        return clientName;
      }
    }
    
    // Format 3: Use the whole title as client name if it's reasonable
    if (title.length > 0 && title.length <= 100) {
      return title;
    }
    
    return null;
  }

  public async runManualTest(): Promise<void> {
    debugLog.info('🧪 Running manual test of maintenance entry creation');
    await this.createMaintenanceEntriesForTomorrow();
  }

  public stop(): void {
    // node-cron doesn't have a direct stop method, but we can track scheduling
    this.isScheduled = false;
    debugLog.info('🛑 Cron service stopped');
  }
}