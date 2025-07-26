import { GoogleCalendarService } from './GoogleCalendarService';
import { NotionService } from './NotionService';
import { debugLog } from '../utils/logger';

export interface CronJobInfo {
  id: string;
  name: string;
  schedule: string;
  description: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  status: 'scheduled' | 'running' | 'error' | 'disabled';
}

export class CronService {
  private googleCalendarService: GoogleCalendarService;
  private notionService: NotionService;
  private isScheduled = false;
  private processingLocks = new Map<string, Promise<void>>(); // Race condition prevention
  private cronJobs = new Map<string, any>(); // Store cron job instances
  private jobStatus = new Map<string, CronJobInfo>(); // Store job status

  constructor() {
    this.googleCalendarService = new GoogleCalendarService();
    this.notionService = new NotionService();
    
    // Initialize job status
    this.initializeJobStatus();
  }

  private initializeJobStatus(): void {
    // Disable cron jobs in development by default unless explicitly enabled
    const cronEnabled = process.env.NODE_ENV === 'production' || process.env.CRON_ENABLED === 'true';
    
    this.jobStatus.set('maintenance-entries', {
      id: 'maintenance-entries',
      name: 'Maintenance Entry Creation',
      schedule: '0 3 * * *',
      description: 'Creates Notion maintenance entries for tomorrow\'s Google Calendar events',
      enabled: cronEnabled,
      status: 'scheduled'
    });

    this.jobStatus.set('notion-sync', {
      id: 'notion-sync', 
      name: 'Notion Page Sync',
      schedule: '0 6,18 * * *',
      description: 'Syncs updated Notion pages into the CRM as work activities',
      enabled: cronEnabled,
      status: 'scheduled'
    });
  }

  public getCronJobsStatus(): CronJobInfo[] {
    // Calculate next run times
    this.updateNextRunTimes();
    return Array.from(this.jobStatus.values());
  }

  private updateNextRunTimes(): void {
    const parser = require('node-cron');
    
    for (const [id, jobInfo] of this.jobStatus.entries()) {
      if (jobInfo.enabled) {
        try {
          // Calculate next run time (this is approximate)
          const now = new Date();
          const nextRun = this.getNextCronTime(jobInfo.schedule, now);
          jobInfo.nextRun = nextRun;
        } catch (error) {
          debugLog.warn(`Could not calculate next run time for ${id}:`, error);
        }
      } else {
        jobInfo.nextRun = undefined;
      }
    }
  }

  private getNextCronTime(schedule: string, from: Date): Date {
    // Simple next run calculation for common patterns
    const [minute, hour, ...rest] = schedule.split(' ');
    const nextRun = new Date(from);
    
    if (hour === '3' && minute === '0') {
      // Daily at 3 AM UTC
      nextRun.setUTCHours(3, 0, 0, 0);
      if (nextRun <= from) {
        nextRun.setUTCDate(nextRun.getUTCDate() + 1);
      }
    } else if (hour === '6,18' && minute === '0') {
      // Twice daily at 6 AM and 6 PM UTC
      const currentHour = from.getUTCHours();
      if (currentHour < 6) {
        nextRun.setUTCHours(6, 0, 0, 0);
      } else if (currentHour < 18) {
        nextRun.setUTCHours(18, 0, 0, 0);
      } else {
        nextRun.setUTCDate(nextRun.getUTCDate() + 1);
        nextRun.setUTCHours(6, 0, 0, 0);
      }
    }
    
    return nextRun;
  }

  public toggleCronJob(jobId: string, enabled: boolean): boolean {
    const jobInfo = this.jobStatus.get(jobId);
    if (!jobInfo) {
      return false;
    }

    jobInfo.enabled = enabled;
    jobInfo.status = enabled ? 'scheduled' : 'disabled';

    // Restart scheduling with new settings
    if (this.isScheduled) {
      this.stopScheduledTasks();
      this.startScheduledTasks();
    }

    debugLog.info(`Cron job ${jobId} ${enabled ? 'enabled' : 'disabled'}`);
    console.log(`🔄 Cron job ${jobInfo.name} ${enabled ? 'enabled' : 'disabled'}`);
    
    return true;
  }

  private stopScheduledTasks(): void {
    // Destroy existing cron jobs
    for (const [jobId, cronJob] of this.cronJobs.entries()) {
      if (cronJob && cronJob.destroy) {
        cronJob.destroy();
      }
    }
    this.cronJobs.clear();
    this.isScheduled = false;
  }

  public startScheduledTasks(): void {
    if (this.isScheduled) {
      debugLog.info('🔄 Cron tasks already scheduled');
      return;
    }

    // Import cron here to avoid import issues
    const cron = require('node-cron');

    // Only schedule enabled jobs
    const maintenanceJob = this.jobStatus.get('maintenance-entries');
    if (maintenanceJob?.enabled) {
      const cronJob = cron.schedule('0 3 * * *', async () => {
        console.log('🕐 Daily Notion maintenance entry cron job started');
        debugLog.info('🕐 Daily Notion maintenance entry cron job started');
        
        // Update status
        maintenanceJob.status = 'running';
        maintenanceJob.lastRun = new Date();
        
        try {
          await this.createMaintenanceEntriesForTomorrow();
          maintenanceJob.status = 'scheduled';
          console.log('✅ Daily Notion maintenance entry cron job completed');
        } catch (error) {
          maintenanceJob.status = 'error';
          console.error('❌ Error in maintenance entry cron job:', error);
          debugLog.error('❌ Error in maintenance entry cron job:', error);
        }
      }, {
        scheduled: true,
        timezone: 'UTC'
      });
      
      this.cronJobs.set('maintenance-entries', cronJob);
    }

    // Schedule Notion sync - Twice daily at 6AM & 6PM UTC
    const notionJob = this.jobStatus.get('notion-sync');
    if (notionJob?.enabled) {
      const cronJob = cron.schedule('0 6,18 * * *', async () => {
        console.log('🔄 Notion sync cron job started');
        debugLog.info('🔄 Notion sync cron job started');
        
        // Update status
        notionJob.status = 'running';
        notionJob.lastRun = new Date();
        
        try {
          const { NotionSyncService } = await import('./NotionSyncService');
          const { AnthropicService } = await import('./AnthropicService');
          const anthropicService = new AnthropicService();
          const notionSyncService = new NotionSyncService(anthropicService);
          
          const stats = await notionSyncService.syncNotionPages();
          console.log(`📊 Notion sync completed: Created ${stats.created}, Updated ${stats.updated}, Errors ${stats.errors}`);
          debugLog.info(`📊 Notion sync completed: Created ${stats.created}, Updated ${stats.updated}, Errors ${stats.errors}`);
          
          notionJob.status = 'scheduled';
        } catch (error) {
          notionJob.status = 'error';
          console.error('❌ Error in Notion sync cron job:', error);
          debugLog.error('❌ Error in Notion sync cron job:', error);
        }
      }, {
        scheduled: true,
        timezone: 'UTC'
      });
      
      this.cronJobs.set('notion-sync', cronJob);
    }

    this.isScheduled = true;
    const enabledJobs = Array.from(this.jobStatus.values()).filter(job => job.enabled);
    
    debugLog.info('✅ Internal cron scheduling enabled:');
    debugLog.info('   📅 Maintenance entries: Daily at 8PM PDT/7PM PST (3AM UTC)');
    debugLog.info('   🔄 Notion sync: Twice daily at 6AM & 6PM UTC');
    
    // Also log to console for Railway visibility
    console.log(`✅ Internal cron scheduling enabled (${enabledJobs.length} jobs):`);
    for (const job of enabledJobs) {
      console.log(`   ${job.id === 'maintenance-entries' ? '📅' : '🔄'} ${job.name}: ${job.schedule}`);
    }
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
          
          // Use unified entry creation method from NotionService (includes duplicate checking)
          debugLog.info(`🆕 Attempting to create entry for ${clientName} on ${targetDateString} using unified method`);
          
          const result = await this.notionService.createEntryForDate(clientName, targetDateString, helperAssignments);
          
          if (result.success) {
            debugLog.info(`✅ Successfully created Notion entry for ${clientName}`);
            debugLog.info(`📝 Entry URL: ${result.page_url}`);
            debugLog.info(`📋 Carryover tasks: ${result.carryover_tasks.length}`);
            results.created++;
          } else {
            // Check if it's a duplicate (not an error)
            if (result.error && result.error.includes('Entry already exists')) {
              debugLog.info(`⏭️ SKIPPING: ${result.error}`);
              debugLog.info(`🔗 Existing entry URL: ${result.page_url}`);
              debugLog.info(`🚫 No duplicate entry created for client/day combination: ${clientName}/${targetDateString}`);
              results.updated++; // Track as "handled" rather than created
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
      debugLog.info(`   🆕 Created: ${results.created} new entries`);
      debugLog.info(`   ⏭️ Skipped: ${results.updated} existing entries (duplicates prevented)`);
      debugLog.info(`   ❌ Errors: ${results.errors}`);
      
    } catch (error) {
      debugLog.error('❌ Error in daily maintenance entry creation:', error);
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
        return this.cleanClientName(clientName);
      }
    }
    
    // Format 2: "Client Name (Service Type)" or "Client Name DESCRIPTION (Service Type)"
    const parenMatch = title.match(/^([^(]+)\s*\(/);
    if (parenMatch) {
      const beforeParen = parenMatch[1].trim();
      
      // Clean up the client name by removing extra words that aren't part of the name
      const cleanedName = this.cleanClientName(beforeParen);
      debugLog.info(`📝 Extracted client name (before paren): "${beforeParen}" -> cleaned: "${cleanedName}"`);
      if (cleanedName.length > 0) {
        return cleanedName;
      }
    }
    
    // Format 3: Simple client name without special formatting
    const cleanedName = this.cleanClientName(title);
    debugLog.info(`📝 Extracted client name (simple): "${title}" -> cleaned: "${cleanedName}"`);
    if (cleanedName.length > 0) {
      return cleanedName;
    }
    
    debugLog.warn(`⚠️  Could not extract client name from: "${title}"`);
    return null;
  }

  private cleanClientName(name: string): string {
    if (!name) return '';
    
    // Split into words
    const words = name.trim().split(/\s+/);
    
    // Filter out words that are clearly not part of a client name
    const filteredWords = words.filter(word => {
      const wordLower = word.toLowerCase();
      
      // Skip words that are clearly not names
      const skipWords = [
        'maintenance', 'maint', 'visit', 'work', 'service', 'job',
        'ladder', 'bring', 'blank', 'line', 'daphne', 'boxwood',
        'pruning', 'weeding', 'cleanup', 'mulching', 'planting',
        'design', 'consultation', 'planning', 'scheduling',
        'confirmed', 'tentative', 'planning', 'c', 't', 'p'
      ];
      
      if (skipWords.includes(wordLower)) {
        return false;
      }
      
      // Skip words that are all caps (likely instructions or equipment)
      if (word === word.toUpperCase() && word.length > 2) {
        return false;
      }
      
      // Skip words that contain numbers (likely quantities or measurements)
      if (/\d/.test(word)) {
        return false;
      }
      
      return true;
    });
    
    // Take the first 1-2 words that look like a proper name
    const nameWords = filteredWords.slice(0, 2);
    
    // Ensure the first word starts with a capital letter
    if (nameWords.length > 0 && nameWords[0].match(/^[A-Z][a-z]+$/)) {
      return nameWords.join(' ');
    }
    
    // If no proper name pattern found, return empty
    return '';
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
    // Check the actual Google Calendar colorId property
    // Yellow events have colorId "5" or "11" in Google Calendar
    const colorId = event.rawEvent?.colorId;
    
    debugLog.info(`🔍 Checking event "${event.title}" - colorId: ${colorId}`);
    
    // Yellow client visits should have colorId "5" or "11"
    if (colorId === '5' || colorId === '11') {
      debugLog.info(`🟡 Event "${event.title}" identified as yellow client visit (colorId: ${colorId})`);
      return true;
    }
    
    // If no colorId is set, it might be using the default calendar color
    // In this case, we need to be more conservative and only accept events
    // that are clearly client visits based on the calendar they belong to
    if (!colorId) {
      debugLog.info(`⚪ Event "${event.title}" has no colorId - checking calendar context`);
      
      // Check if this is from the main work calendar (which should be yellow for client visits)
      const calendarId = event.rawEvent?.organizer?.email || event.rawEvent?.creator?.email;
      const isWorkCalendar = calendarId === process.env.GOOGLE_CALENDAR_ID;
      
      if (isWorkCalendar) {
        // For work calendar events without explicit color, use more conservative heuristics
        const title = event.title?.toLowerCase() || '';
        
        // Exclude obvious non-client events
        const excludePatterns = [
          'meeting', 'office', 'admin', 'break', 'lunch', 'call', 'travel',
          'team', 'training', 'review', 'planning', 'errand', 'sched', 'comms'
        ];
        
        const isExcluded = excludePatterns.some(pattern => title.includes(pattern));
        
        if (isExcluded) {
          debugLog.info(`⚪ Event "${event.title}" excluded by pattern matching (no colorId)`);
          return false;
        }
        
        // Only accept if it has a clear client name pattern
        const hasClientPattern = /^[A-Z][a-z]+/.test(event.title); // Starts with capitalized word
        if (hasClientPattern) {
          debugLog.info(`🟡 Event "${event.title}" assumed to be client visit (work calendar, client name pattern)`);
          return true;
        }
      }
    }
    
    debugLog.info(`⚪ Event "${event.title}" not identified as yellow client visit (colorId: ${colorId})`);
    return false;
  }

  private isOrangeHelperEvent(event: any): boolean {
    // Check the actual Google Calendar colorId property
    // Orange helper events have colorId "6" in Google Calendar
    const colorId = event.colorId;
    
    debugLog.info(`🔍 Checking helper event "${event.summary || event.title}" - colorId: ${colorId}`);
    
    // Orange helper events should have colorId "6"
    if (colorId === '6') {
      debugLog.info(`🟠 Event "${event.summary || event.title}" identified as orange helper event (colorId: ${colorId})`);
      return true;
    }
    
    // If no colorId is set, use heuristics as fallback
    if (!colorId) {
      debugLog.info(`⚪ Event "${event.summary || event.title}" has no colorId - using heuristics`);
      
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
        debugLog.info(`🟠 Event "${title}" assumed to be helper assignment (heuristics)`);
        return true;
      }
    }
    
    debugLog.info(`⚪ Event "${event.summary || event.title}" not identified as orange helper event (colorId: ${colorId})`);
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