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
    // NOTE: This method is deprecated in favor of Railway's cron service
    // Keeping for backwards compatibility, but Railway cron handles scheduling now
    debugLog.info('⚠️ Internal scheduling disabled - using Railway cron service instead');
    debugLog.info('✅ CronService ready for Railway cron calls at 3AM UTC (8PM PDT/7PM PST)');
    
    // Uncomment below to re-enable internal scheduling if needed:
    /*
    if (this.isScheduled) {
      debugLog.info('🔄 Cron tasks already scheduled');
      return;
    }

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
    */
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
      
      // Use the new method with the calculated date
      await this.createMaintenanceEntriesForDate(targetDateString);
      
    } catch (error) {
      debugLog.error('❌ Error in daily maintenance entry creation:', error);
    }
  }

  public async createMaintenanceEntriesForDate(targetDateString: string): Promise<void> {
    try {
      debugLog.info(`📅 Starting to create maintenance entries for date: ${targetDateString}`);
      
      debugLog.info(`📅 Processing calendar events for date: ${targetDateString}`);
      
      // Calculate how many days ahead the target date is
      const now = new Date();
      const targetDate = new Date(targetDateString);
      const daysAhead = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      debugLog.info(`📅 Target date: ${targetDateString}, Current date: ${now.toISOString().split('T')[0]}, Days ahead: ${daysAhead}`);
      
      // Get ALL calendar events (including all-day events for helper assignments)
      const rawEvents = await this.googleCalendarService.getAllEvents(daysAhead);
      
      // Process timed events for client visits
      const events = rawEvents.map((event: any) => this.parseGoogleEventForCron(event)).filter(Boolean);
      
      debugLog.info(`📅 Raw events from calendar: ${rawEvents.length}, Processed events: ${events.length}`);
      
      // Log all events found
      debugLog.info(`🔍 Total events retrieved from calendar: ${events.length}`);
      
      // Log events for the target date
      const targetDateEvents = events.filter(event => {
        const eventDate = new Date(event.start);
        const eventDateString = eventDate.toISOString().split('T')[0];
        return eventDateString === targetDateString;
      });
      
      debugLog.info(`📅 Events found for target date ${targetDateString}: ${targetDateEvents.length}`);
      
      // Log details of each event on target date
      targetDateEvents.forEach((event, index) => {
        debugLog.info(`📋 Event ${index + 1}:`);
        debugLog.info(`   Title: "${event.title}"`);
        debugLog.info(`   Start: ${event.start}`);
        debugLog.info(`   Event Type: ${event.eventType}`);
        debugLog.info(`   Is Timed Event: ${event.start.includes('T')}`);
        debugLog.info(`   Event Object: ${JSON.stringify(event, null, 2)}`);
      });
      
      // First, extract helper information from all-day events (orange staff assignments)
      const helperAssignments = this.extractHelperAssignments(rawEvents, targetDateString);
      debugLog.info(`👥 Found helper assignments: ${JSON.stringify(helperAssignments)}`);
      
      // Filter for target day's events that are client visits (timed events, not all-day)
      debugLog.info(`🔍 Now filtering events for client visits...`);
      
      const targetDayClientVisits = events.filter(event => {
        const eventDate = new Date(event.start);
        const eventDateString = eventDate.toISOString().split('T')[0];
        
        // Must be target date
        if (eventDateString !== targetDateString) {
          debugLog.debug(`❌ Event "${event.title}" excluded: wrong date (${eventDateString} vs ${targetDateString})`);
          return false;
        }
        
        // Must be a client visit (non-all-day event with dateTime, not just date)
        // All-day events have only 'date' property, timed events have 'dateTime'
        const isTimedEvent = event.start.includes('T'); // ISO datetime format includes 'T'
        if (!isTimedEvent) {
          debugLog.info(`❌ Event "${event.title}" excluded: all-day event (not timed)`);
          return false;
        }
        
        // Must have a client name/title
        const hasClientInfo = event.title && event.title.trim().length > 0;
        if (!hasClientInfo) {
          debugLog.info(`❌ Event excluded: no title/client info`);
          return false;
        }
        
        // Use color information to identify yellow client visits
        const isYellowClientVisit = this.isYellowClientVisit(event);
        if (!isYellowClientVisit) {
          debugLog.info(`❌ Event "${event.title}" excluded: not yellow client visit (eventType: ${event.eventType})`);
          return false;
        }
        
        debugLog.info(`✅ Event "${event.title}" ACCEPTED as client visit`);
        return true;
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
      
      // Use the proper getters to access the notion client and database ID
      const notion = this.notionService.client;
      const DATABASE_ID = this.notionService.databaseId;
      
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
      const notion = this.notionService.client;
      
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
      
      // Use the proper getters to access the notion client and database ID
      const notion = this.notionService.client;
      const DATABASE_ID = this.notionService.databaseId;
      const TEMPLATE_ID = process.env.NOTION_TEMPLATE_ID;
      
      if (!notion || !DATABASE_ID) {
        throw new Error('Cannot access Notion client or database ID');
      }
      
      // Ensure client exists in database options
      await this.notionService.ensureClientExistsInDatabase(clientName);
      
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

  private parseGoogleEventForCron(googleEvent: any): any | null {
    if (!googleEvent.id || !googleEvent.summary) {
      return null;
    }

    const start = googleEvent.start?.dateTime || googleEvent.start?.date;
    const end = googleEvent.end?.dateTime || googleEvent.end?.date;

    if (!start || !end) {
      return null;
    }

    // Don't filter out all-day events here - we need them for helper assignments
    return {
      id: googleEvent.id,
      title: googleEvent.summary,
      start: start,
      end: end,
      eventType: this.inferEventType(googleEvent.summary),
      rawEvent: googleEvent, // Keep the raw event for detailed analysis
    };
  }

  private inferEventType(title: string): string {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('maintenance')) return 'maintenance';
    if (titleLower.includes('client') || titleLower.includes('visit')) return 'ad_hoc';
    return 'maintenance';
  }

  private extractHelperAssignments(events: any[], targetDateString: string): string[] {
    const helpers: string[] = [];
    
    for (const event of events) {
      const start = event.start?.dateTime || event.start?.date;
      const eventDate = new Date(start);
      const eventDateString = eventDate.toISOString().split('T')[0];
      
      // Must be target date and all-day event (orange staff assignments)
      const isAllDay = !event.start?.dateTime && event.start?.date;
      if (eventDateString === targetDateString && isAllDay) {
        // Extract helper names from orange all-day events
        // Expected formats: "Virginia", "Andrea", "Helper Name", etc.
        const title = event.summary?.trim();
        if (title && this.isOrangeHelperEvent(event)) {
          helpers.push(title);
          debugLog.info(`👥 Found helper assignment: ${title}`);
        }
      }
    }
    
    return helpers;
  }

  private isYellowClientVisit(event: any): boolean {
    // Since we're working with processed CalendarEvent objects, use eventType and heuristics
    const title = event.title?.toLowerCase() || '';
    
    // Exclude obvious non-client events
    const excludePatterns = [
      'meeting', 'office', 'admin', 'break', 'lunch', 'call', 'travel',
      'team', 'training', 'review', 'planning', 'errand'
    ];
    
    const isExcluded = excludePatterns.some(pattern => title.includes(pattern));
    
    if (isExcluded) {
      debugLog.info(`⚪ Event "${event.title}" excluded by pattern matching`);
      return false;
    }
    
    // Check if it's a maintenance or client-related event type
    if (event.eventType === 'maintenance' || event.eventType === 'ad_hoc') {
      debugLog.info(`🟡 Event "${event.title}" identified as client visit (eventType: ${event.eventType})`);
      return true;
    }
    
    // Check for typical client names/patterns in title
    const hasClientPattern = /^[A-Z][a-z]+/.test(event.title); // Starts with capitalized word
    const hasTimePattern = /\d{1,2}:\d{2}/.test(event.title); // Contains time
    
    if (hasClientPattern && !isExcluded) {
      debugLog.info(`🟡 Event "${event.title}" assumed to be client visit (client name pattern)`);
      return true;
    }
    
    debugLog.info(`⚪ Event "${event.title}" not identified as client visit`);
    return false;
  }

  private isOrangeHelperEvent(event: any): boolean {
    // Check if it's a simple name (likely a helper assignment)
    const title = (event.summary || event.title || '').trim();
    
    // Simple heuristics: short names without special characters, likely helper names
    const isSimpleName = title.length <= 20 && 
                        !title.includes('-') && 
                        !title.includes('(') && 
                        !title.includes('@') &&
                        title.split(' ').length <= 2;
    
    // Also check for known helper names
    const helperNames = ['anne', 'virginia', 'sarah', 'mike', 'andrea'];
    const isKnownHelper = helperNames.some(name => title.toLowerCase().includes(name));
    
    if (isSimpleName || isKnownHelper) {
      debugLog.info(`🟠 Event "${title}" assumed to be helper assignment (appears to be name)`);
      return true;
    }
    
    debugLog.info(`⚪ Event "${title}" not identified as helper assignment`);
    return false;
  }

  public async runManualTest(targetDate?: string): Promise<void> {
    if (targetDate) {
      debugLog.info(`🧪 Running manual test of maintenance entry creation for date: ${targetDate}`);
      await this.createMaintenanceEntriesForDate(targetDate);
    } else {
      debugLog.info('🧪 Running manual test of maintenance entry creation');
      await this.createMaintenanceEntriesForTomorrow();
    }
  }

  public stop(): void {
    // node-cron doesn't have a direct stop method, but we can track scheduling
    this.isScheduled = false;
    debugLog.info('🛑 Cron service stopped');
  }
}