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
      
      // TIMEZONE FIX: When this runs at 3AM UTC, it's 8PM Pacific the previous day
      // So "tomorrow" from Pacific perspective is actually "today" in UTC
      // We want to create entries for the next day from Pacific time perspective
      const now = new Date();
      const targetDate = new Date(now);
      targetDate.setHours(0, 0, 0, 0); // Start of the target day
      
      const targetDateString = targetDate.toISOString().split('T')[0];
      
      debugLog.info(`🕐 Current UTC time: ${now.toISOString()}`);
      debugLog.info(`📅 Target date (tomorrow from Pacific perspective): ${targetDateString}`);
      
      debugLog.info(`📅 Processing calendar events for date: ${targetDateString}`);
      
      // Get calendar events for the target day
      const events = await this.googleCalendarService.getEvents(1);
      
      // First, extract helper information from all-day events (orange staff assignments)
      const helperAssignments = this.extractHelperAssignments(events, targetDateString);
      debugLog.info(`👥 Found helper assignments: ${JSON.stringify(helperAssignments)}`);
      
      // Filter for target day's events that are client visits (timed events, not all-day)
      const targetDayClientVisits = events.filter(event => {
        const eventDate = new Date(event.start);
        const eventDateString = eventDate.toISOString().split('T')[0];
        
        // Must be target date
        if (eventDateString !== targetDateString) {
          return false;
        }
        
        // Must be a client visit (non-all-day event with dateTime, not just date)
        // All-day events have only 'date' property, timed events have 'dateTime'
        const isTimedEvent = event.start.includes('T'); // ISO datetime format includes 'T'
        
        // Must have a client name/title
        const hasClientInfo = event.title && event.title.trim().length > 0;
        
        // Use color information to identify yellow client visits
        const isYellowClientVisit = this.isYellowClientVisit(event);
        
        return isTimedEvent && hasClientInfo && isYellowClientVisit;
      });
      
      debugLog.info(`📋 Found ${targetDayClientVisits.length} client visits for target day`);
      
      if (targetDayClientVisits.length === 0) {
        debugLog.info('ℹ️ No client visits scheduled for target day');
        return;
      }
      
      // Process each client visit
      const results = {
        created: 0,
        updated: 0,
        errors: 0
      };
      
      for (const event of targetDayClientVisits) {
        try {
          // Extract client name from event title
          const clientName = this.extractClientNameFromEvent(event);
          
          if (!clientName) {
            debugLog.warn(`⚠️ Could not extract client name from event: ${event.title}`);
            results.errors++;
            continue;
          }
          
          debugLog.info(`🏡 Processing client visit: ${clientName}`);
          
          // Check if an entry already exists for this client for target date
          const existingEntry = await this.getEntryForClientAndDate(clientName, targetDateString);
          
          if (existingEntry) {
            debugLog.info(`📝 Entry already exists for ${clientName} on ${targetDateString}, updating it`);
            
            // Update the existing entry with helper assignments
            await this.updateExistingEntry(existingEntry.id, clientName, helperAssignments);
            results.updated++;
            
          } else {
            debugLog.info(`🆕 Creating new entry for ${clientName} on ${targetDateString}`);
            
            // Create new entry with target date, carryover tasks, and helper assignments
            const result = await this.createMaintenanceEntryForDate(clientName, targetDateString, helperAssignments);
            
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

  private async updateExistingEntry(pageId: string, clientName: string, helperAssignments: string[] = []): Promise<void> {
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
      
      // Always include Andrea, plus any additional helpers from orange events
      const teamMembers = [
        { name: 'Andrea' }, // Always include Andrea
        ...helperAssignments.map(helper => ({ name: helper }))
      ];
      
      // Remove duplicates in case Andrea is also in helperAssignments
      const uniqueTeamMembers = teamMembers.filter((member, index, self) => 
        index === self.findIndex(m => m.name === member.name)
      );
      
      const memberNames = uniqueTeamMembers.map(m => m.name).join(', ');
      debugLog.info(`👥 Updating team members: ${memberNames}`);
      
      await notion.pages.update({
        page_id: pageId,
        properties: {
          Title: {
            title: [{ text: { content: updatedTitle } }],
          },
          'Team Members': {
            multi_select: uniqueTeamMembers,
          }
        }
      });
      
      debugLog.info(`✅ Successfully updated entry for ${clientName}`);
      
    } catch (error) {
      debugLog.error(`❌ Error updating existing entry for ${clientName}:`, error);
      throw error;
    }
  }

  private async createMaintenanceEntryForDate(clientName: string, dateString: string, helperAssignments: string[] = []): Promise<any> {
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
      
      // Always include Andrea, plus any additional helpers from orange events
      const teamMembers = [
        { name: 'Andrea' }, // Always include Andrea
        ...helperAssignments.map(helper => ({ name: helper }))
      ];
      
      // Remove duplicates in case Andrea is also in helperAssignments
      const uniqueTeamMembers = teamMembers.filter((member, index, self) => 
        index === self.findIndex(m => m.name === member.name)
      );
      
      const memberNames = uniqueTeamMembers.map(m => m.name).join(', ');
      debugLog.info(`👥 Assigning team members: ${memberNames}`);
      
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
            multi_select: uniqueTeamMembers,
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

  private extractHelperAssignments(events: any[], targetDateString: string): string[] {
    const helpers: string[] = [];
    
    for (const event of events) {
      const eventDate = new Date(event.start);
      const eventDateString = eventDate.toISOString().split('T')[0];
      
      // Must be target date and all-day event (orange staff assignments)
      if (eventDateString === targetDateString && !event.start.includes('T')) {
        // Extract helper names from orange all-day events
        // Expected formats: "Virginia", "Andrea", "Helper Name", etc.
        const title = event.title?.trim();
        if (title && this.isOrangeHelperEvent(event)) {
          helpers.push(title);
          debugLog.info(`👥 Found helper assignment: ${title}`);
        }
      }
    }
    
    return helpers;
  }

  private isYellowClientVisit(event: any): boolean {
    // Google Calendar color IDs for yellow are typically "5" or "11"
    // We'll check both the event colorId and some basic heuristics
    const colorId = event.colorId;
    
    // Yellow is typically colorId "5" in Google Calendar
    if (colorId === '5' || colorId === '11') {
      debugLog.info(`🟡 Event "${event.title}" identified as yellow (colorId: ${colorId})`);
      return true;
    }
    
    // Fallback: Use title-based heuristics if no color info
    if (!colorId) {
      const title = event.title?.toLowerCase() || '';
      
      // Exclude obvious non-client events
      const excludePatterns = [
        'meeting', 'office', 'admin', 'break', 'lunch', 'call', 'travel',
        'team', 'training', 'review', 'planning', 'errand'
      ];
      
      const isExcluded = excludePatterns.some(pattern => title.includes(pattern));
      
      if (!isExcluded) {
        debugLog.info(`🟡 Event "${event.title}" assumed to be client visit (no color info, passes heuristics)`);
        return true;
      }
    }
    
    debugLog.debug(`⚪ Event "${event.title}" not identified as yellow client visit (colorId: ${colorId})`);
    return false;
  }

  private isOrangeHelperEvent(event: any): boolean {
    // Orange is typically colorId "6" in Google Calendar
    const colorId = event.colorId;
    
    if (colorId === '6') {
      debugLog.info(`🟠 Event "${event.title}" identified as orange helper assignment (colorId: ${colorId})`);
      return true;
    }
    
    // Fallback: Check if it's a simple name (likely a helper assignment)
    if (!colorId) {
      const title = event.title?.trim() || '';
      
      // Simple heuristics: short names without special characters, likely helper names
      const isSimpleName = title.length <= 20 && 
                          !title.includes('-') && 
                          !title.includes('(') && 
                          !title.includes('@') &&
                          title.split(' ').length <= 2;
      
      if (isSimpleName) {
        debugLog.info(`🟠 Event "${event.title}" assumed to be helper assignment (no color info, appears to be name)`);
        return true;
      }
    }
    
    debugLog.debug(`⚪ Event "${event.title}" not identified as orange helper assignment (colorId: ${colorId})`);
    return false;
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