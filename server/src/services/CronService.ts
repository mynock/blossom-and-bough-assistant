import { GoogleCalendarService } from './GoogleCalendarService';
import { NotionService } from './NotionService';
import { debugLog } from '../utils/logger';

export class CronService {
  private googleCalendarService: GoogleCalendarService;
  private notionService: NotionService;
  private isScheduled = false;
  private processingLocks = new Map<string, Promise<void>>(); // Race condition prevention

  constructor() {
    this.googleCalendarService = new GoogleCalendarService();
    this.notionService = new NotionService();
  }

  public startScheduledTasks(): void {
    if (this.isScheduled) {
      debugLog.info('🔄 Cron tasks already scheduled');
      return;
    }

    // Import cron here to avoid import issues
    const cron = require('node-cron');

    // Schedule maintenance entries - Daily at 8PM Pacific (3AM UTC)
    cron.schedule('0 3 * * *', async () => {
      console.log('🕐 Daily Notion maintenance entry cron job started');
      debugLog.info('🕐 Daily Notion maintenance entry cron job started');
      await this.createMaintenanceEntriesForTomorrow();
      console.log('✅ Daily Notion maintenance entry cron job completed');
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    // Schedule Notion sync - Twice daily at 6AM & 6PM UTC
    cron.schedule('0 6,18 * * *', async () => {
      console.log('🔄 Notion sync cron job started');
      debugLog.info('🔄 Notion sync cron job started');
      try {
        const { NotionSyncService } = await import('./NotionSyncService');
        const { AnthropicService } = await import('./AnthropicService');
        const anthropicService = new AnthropicService();
        const notionSyncService = new NotionSyncService(anthropicService);
        
        const stats = await notionSyncService.syncNotionPages();
        console.log(`📊 Notion sync completed: Created ${stats.created}, Updated ${stats.updated}, Errors ${stats.errors}`);
        debugLog.info(`📊 Notion sync completed: Created ${stats.created}, Updated ${stats.updated}, Errors ${stats.errors}`);
      } catch (error) {
        console.error('❌ Error in Notion sync cron job:', error);
        debugLog.error('❌ Error in Notion sync cron job:', error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.isScheduled = true;
    debugLog.info('✅ Internal cron scheduling enabled:');
    debugLog.info('   📅 Maintenance entries: Daily at 8PM PDT/7PM PST (3AM UTC)');
    debugLog.info('   🔄 Notion sync: Twice daily at 6AM & 6PM UTC');
    
    // Also log to console for Railway visibility
    console.log('✅ Internal cron scheduling enabled:');
    console.log('   📅 Maintenance entries: Daily at 8PM PDT/7PM PST (3AM UTC)');
    console.log('   🔄 Notion sync: Twice daily at 6AM & 6PM UTC');
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
          
          debugLog.info(`🏡 Processing client visit: "${clientName}" on ${targetDateString}`);
          debugLog.info(`🔍 Event title: "${event.title}"`);
          
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
      debugLog.info(`🔍 Checking for existing entry: "${clientName}" on ${dateString}`);
      
      // Use the proper getters to access the notion client and database ID
      const notion = this.notionService.client;
      const DATABASE_ID = this.notionService.databaseId;
      
      if (!notion || !DATABASE_ID) {
        debugLog.error('❌ Cannot access Notion client or database ID');
        return null;
      }
      
      // Try multiple query strategies to catch duplicates
      const queries = [
        // Exact match on Client Name and Date
        {
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
          page_size: 10,
        },
        // Also check by title containing the client name (fallback)
        {
          database_id: DATABASE_ID,
          filter: {
            and: [
              {
                property: 'Title',
                title: { contains: clientName },
              },
              {
                property: 'Date',
                date: { equals: dateString },
              }
            ]
          },
          page_size: 10,
        }
      ];

      let allEntries: any[] = [];
      
      for (const query of queries) {
        try {
          const response = await notion.databases.query(query);
          allEntries.push(...response.results);
          debugLog.info(`🔍 Query found ${response.results.length} entries`);
        } catch (queryError) {
          debugLog.warn(`⚠️  Query failed, trying next strategy:`, queryError);
        }
      }
      
      // Remove duplicates by ID
      const uniqueEntries = allEntries.filter((entry, index, self) => 
        index === self.findIndex(e => e.id === entry.id)
      );
      
      debugLog.info(`🔍 Found ${uniqueEntries.length} unique existing entries for "${clientName}" on ${dateString}`);
      
      if (uniqueEntries.length > 0) {
        // Log details of found entries for debugging
        uniqueEntries.forEach((entry: any, index: number) => {
          const title = entry.properties?.Title?.title?.[0]?.text?.content || 'No title';
          const clientNameProp = entry.properties?.['Client Name']?.select?.name || 'No client name';
          const dateProp = entry.properties?.Date?.date?.start || 'No date';
          debugLog.info(`📋 Entry ${index + 1}: "${title}" | Client: "${clientNameProp}" | Date: ${dateProp}`);
        });
      }
      
      return uniqueEntries[0] || null;
    } catch (error) {
      debugLog.error(`❌ Error checking for existing entry: "${clientName}" on ${dateString}`, error);
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
      
      // Use the NotionService's proper template creation method
      debugLog.info(`🎨 Creating entry using NotionService template for ${clientName}`);
      
      const notionResponse = await this.notionService.createEntryWithCarryover(clientName, carryoverTasks);
      
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
      
      // Update the page with the specific date and team members
      await notion.pages.update({
        page_id: notionResponse.id,
        properties: {
          Date: {
            date: { start: dateString }, // Use the specified date
          },
          'Team Members': {
            multi_select: uniqueTeamMembers,
          },
        },
      });
      
      debugLog.info(`✅ Successfully created and updated entry for ${clientName} on ${dateString}`);
      
      return {
        success: true,
        page_url: (notionResponse as any).url || `https://notion.so/${notionResponse.id.replace(/-/g, '')}`,
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
    
    debugLog.info(`🔍 Extracting client name from title: "${title}"`);
    
    // Format 1: "Client Name - Service Type - Helper Name"
    const dashFormat = title.split(' - ');
    if (dashFormat.length >= 2) {
      const clientName = dashFormat[0].trim();
      debugLog.info(`📝 Extracted client name (dash format): "${clientName}"`);
      if (clientName.length > 0) {
        return clientName;
      }
    }
    
    // Format 2: "Client Name (Service Type)" or "Client Name DESCRIPTION (Service Type)"
    const parenMatch = title.match(/^([^(]+)\s*\(/);
    if (parenMatch) {
      const beforeParen = parenMatch[1].trim();
      
      // If it looks like "Client Name DESCRIPTION", try to extract just the client name
      // Common patterns: "Condon BRING BLANK 1/2" LINE, DAPHNE" -> "Condon"
      const words = beforeParen.split(/\s+/);
      
      // If first word is capitalized and looks like a name, use it
      if (words.length > 0 && words[0].match(/^[A-Z][a-z]+$/)) {
        const clientName = words[0];
        debugLog.info(`📝 Extracted client name (first word): "${clientName}"`);
        return clientName;
      }
      
      // If first two words look like a name, use them
      if (words.length >= 2 && words[0].match(/^[A-Z][a-z]+$/) && words[1].match(/^[A-Z][a-z]+$/)) {
        const clientName = `${words[0]} ${words[1]}`;
        debugLog.info(`📝 Extracted client name (first two words): "${clientName}"`);
        return clientName;
      }
      
      // Fallback to everything before parentheses
      debugLog.info(`📝 Extracted client name (before paren): "${beforeParen}"`);
      if (beforeParen.length > 0) {
        return beforeParen;
      }
    }
    
    // Format 3: Simple client name without special formatting
    const words = title.split(/\s+/);
    if (words.length > 0 && words[0].match(/^[A-Z][a-z]+$/)) {
      const clientName = words[0];
      debugLog.info(`📝 Extracted client name (simple): "${clientName}"`);
      return clientName;
    }
    
    // Format 4: Use the whole title as client name if it's reasonable
    if (title.length > 0 && title.length <= 100) {
      debugLog.info(`📝 Using full title as client name: "${title}"`);
      return title;
    }
    
    debugLog.warn(`⚠️  Could not extract client name from: "${title}"`);
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