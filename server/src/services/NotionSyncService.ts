import { Client } from '@notionhq/client';
import { WorkActivityService, CreateWorkActivityData } from './WorkActivityService';
import { ClientService } from './ClientService';
import { EmployeeService } from './EmployeeService';
import { AnthropicService } from './AnthropicService';
import { debugLog } from '../utils/logger';
import { NewWorkActivity, otherCharges, workActivityEmployees } from '../db/schema';
import { eq } from 'drizzle-orm';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID!;

export interface NotionWorkActivityData {
  notionPageId: string;
  clientName: string;
  date: string;
  workType: string;
  startTime?: string;
  endTime?: string;
  teamMembers: string[];
  travelTime?: number;
  tasks: string;
  notes: string;
  materials: Array<{ description: string; cost: number }>;
  lastEditedTime: string;
}

export class NotionSyncService {
  private workActivityService: WorkActivityService;
  private clientService: ClientService;
  private employeeService: EmployeeService;
  private anthropicService: AnthropicService;

  constructor(anthropicService?: AnthropicService) {
    this.workActivityService = new WorkActivityService();
    this.clientService = new ClientService();
    this.employeeService = new EmployeeService();
    
    // Use injected service or create new one
    this.anthropicService = anthropicService || new AnthropicService();

    if (!process.env.NOTION_TOKEN) {
      debugLog.warn('NOTION_TOKEN not found in environment variables');
    }
    if (!process.env.NOTION_DATABASE_ID) {
      debugLog.warn('NOTION_DATABASE_ID not found in environment variables');
    }
  }

  /**
   * Sync new and updated Notion pages with the CRM system using AI parsing
   */
  async syncNotionPages(
    onProgress?: (current: number, total: number, message: string, incrementalStats?: { created: number; updated: number; errors: number; warnings: string[] }) => void,
    abortSignal?: AbortSignal,
    forceSync: boolean = false
  ): Promise<{ created: number; updated: number; errors: number; warnings: string[] }> {
    try {
      debugLog.info('Starting Notion pages sync with AI parsing...');
      
      const stats = { created: 0, updated: 0, errors: 0, warnings: [] as string[] };
      
      // Check if cancelled before starting
      if (abortSignal?.aborted) {
        throw new Error('Sync cancelled before starting');
      }
      
      // Get all pages from the Notion database
      const notionPages = await this.getAllNotionPages();
      debugLog.info(`Found ${notionPages.length} pages in Notion database`);
      
      // Send initial progress
      if (onProgress) {
        onProgress(0, notionPages.length, `Found ${notionPages.length} pages to process`, { ...stats });
      }

      for (let i = 0; i < notionPages.length; i++) {
        // Check for cancellation
        if (abortSignal?.aborted) {
          debugLog.info(`Sync cancelled after processing ${i} pages`);
          if (onProgress) {
            onProgress(i, notionPages.length, `Sync cancelled after processing ${i}/${notionPages.length} pages`, { ...stats });
          }
          throw new Error(`Sync cancelled after processing ${i} pages`);
        }
        
        const page = notionPages[i];
        const currentPage = i + 1;
        
        // Send progress update
        if (onProgress) {
          onProgress(currentPage, notionPages.length, `Processing page ${currentPage}/${notionPages.length}...`, { ...stats });
        }
        
        // Use the extracted single page processing logic
        const result = await this.processSingleNotionPage(page, (message: string) => {
          if (onProgress) {
            onProgress(currentPage, notionPages.length, message, { ...stats });
          }
        }, forceSync);
        
        // Update stats based on result
        if (result.action === 'created') {
          stats.created++;
        } else if (result.action === 'updated') {
          stats.updated++;
        }
        
        if (result.warnings) {
          stats.warnings.push(...result.warnings);
        }
        
        if (result.error) {
          stats.errors++;
          stats.warnings.push(result.error);
        }
      }

      // Send final progress
      if (onProgress) {
        onProgress(notionPages.length, notionPages.length, `🎉 Sync completed: ${stats.created} created, ${stats.updated} updated, ${stats.errors} errors`, { ...stats });
      }

      debugLog.info(`Notion sync completed: ${stats.created} created, ${stats.updated} updated, ${stats.errors} errors`);
      return stats;
    } catch (error) {
      debugLog.error('Error syncing Notion pages:', error);
      throw error;
    }
  }

  /**
   * Sync a specific Notion page by ID
   */
  async syncSpecificNotionPage(
    pageId: string,
    onProgress?: (message: string) => void,
    forceSync: boolean = false
  ): Promise<{ created: number; updated: number; errors: number; warnings: string[] }> {
    try {
      debugLog.info(`Starting sync for specific Notion page: ${pageId}`);
      
      const stats = { created: 0, updated: 0, errors: 0, warnings: [] as string[] };
      
      // Get the specific page from Notion
      const page = await notion.pages.retrieve({ page_id: pageId });
      
      if (!page) {
        throw new Error(`Notion page ${pageId} not found`);
      }

      if (onProgress) {
        onProgress(`Found page: ${this.extractClientNameFromNotionPage(page)} on ${this.extractDateFromNotionPage(page)}`);
      }

      // Process the single page using the extracted logic
      const result = await this.processSingleNotionPage(page, onProgress, forceSync);
      
      // Update stats based on result
      if (result.action === 'created') {
        stats.created = 1;
      } else if (result.action === 'updated') {
        stats.updated = 1;
      } else if (result.action === 'skipped') {
        stats.warnings.push(result.message || 'Page was skipped');
      }
      
      if (result.warnings) {
        stats.warnings.push(...result.warnings);
      }
      
      if (result.error) {
        stats.errors = 1;
        stats.warnings.push(result.error);
      }

      debugLog.info(`Specific page sync completed: ${stats.created} created, ${stats.updated} updated, ${stats.errors} errors`);
      return stats;
    } catch (error) {
      debugLog.error(`Error syncing specific Notion page ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Process a single Notion page (extracted from the main sync loop)
   */
  private async processSingleNotionPage(
    page: any,
    onProgress?: (message: string) => void,
    forceSync: boolean = false
  ): Promise<{
    action: 'created' | 'updated' | 'skipped';
    message?: string;
    warnings?: string[];
    error?: string;
  }> {
    const warnings: string[] = [];
    
    try {
      // First check if work activity already exists by Notion page ID
      const existingActivity = await this.workActivityService.getWorkActivityByNotionPageId(page.id);

      if (existingActivity) {
        // Check if we should sync this record BEFORE doing expensive AI processing (unless force sync is enabled)
        if (!forceSync) {
          const syncDecision = this.shouldSyncFromNotion(
            page.last_edited_time,
            existingActivity.lastNotionSyncAt?.toISOString(),
            existingActivity.lastUpdatedBy
          );
          
          if (!syncDecision.shouldSync) {
            // Skip AI processing entirely - we already know we won't sync
            debugLog.info(`Skipping page ${page.id} - local changes are newer than last Notion sync (avoiding AI processing)`);
            
            const clientName = this.extractClientNameFromNotionPage(page);
            const date = this.extractDateFromNotionPage(page);
            
            const skipMessage = `"${clientName}" on ${date}: Skipped sync - you have newer local changes that would be overwritten`;
            if (onProgress) {
              onProgress(`⚠️ Skipped: ${clientName} - local changes newer`);
            }
            return { action: 'skipped', message: skipMessage };
          }
          
          // If there's a warning from the sync decision, collect it for later with page reference
          if (syncDecision.warning) {
            const clientName = this.extractClientNameFromNotionPage(page);
            const date = this.extractDateFromNotionPage(page);
            warnings.push(`"${clientName}" on ${date}: ${syncDecision.warning}`);
          }
        } else {
          debugLog.info(`Force sync enabled - bypassing timestamp checks for page ${page.id}`);
          if (onProgress) {
            onProgress(`🔄 Force sync enabled - processing regardless of timestamps`);
          }
        }
      }

      // Only do expensive AI processing if we need to sync or create new activity
      // Extract structured data from Notion page
      const structuredResult = await this.extractNotionStructuredData(page);
      const structuredData = structuredResult.structuredData;
      const extractedContent = structuredResult.extractedContent;
      
      debugLog.info(`📊 Structured data extracted for AI processing`);
      debugLog.info(`📋 Extracted content: ${JSON.stringify(extractedContent)}`);
      
      if (!structuredData) {
        debugLog.warn(`Skipping page ${page.id} - failed to extract structured data`);
        const skipMessage = `${this.createPageReference(page)}: Failed to extract structured data`;
        if (onProgress) {
          onProgress(`Skipped - data extraction failed`);
        }
        return { action: 'skipped', message: skipMessage };
      }

      // Send AI processing progress update
      if (onProgress) {
        onProgress(`Processing structured data with AI...`);
      }

      // Use AI to process the structured data
      debugLog.info(`Processing Notion page ${page.id} with AI using structured data...`);
      debugLog.info(`📤 AI Input structured data:`, JSON.stringify(structuredData, null, 2));
      const aiResult = await this.anthropicService.processStructuredNotionData(structuredData);
      debugLog.info(`📥 AI Response:`, JSON.stringify(aiResult, null, 2));

      if (!aiResult.activities || aiResult.activities.length === 0) {
        debugLog.warn(`Skipping page ${page.id} - AI could not extract work activities`);
        const skipMessage = `${this.createPageReference(page)}: AI could not extract work activities`;
        if (onProgress) {
          onProgress(`Skipped - no activities found`);
        }
        return { action: 'skipped', message: skipMessage };
      }

      // Use the first parsed activity (assuming one activity per Notion page)
      const parsedActivity = aiResult.activities[0];
      
      // Debug: Compare AI-parsed client name with directly extracted client name
      const directlyExtractedClientName = this.extractClientNameFromNotionPage(page);
      debugLog.info(`🔍 Client name comparison for page ${page.id}:`);
      debugLog.info(`   📋 Directly extracted: "${directlyExtractedClientName}"`);
      debugLog.info(`   🤖 AI parsed: "${parsedActivity.clientName}"`);
      
      if (directlyExtractedClientName !== 'Unknown Client' && directlyExtractedClientName !== parsedActivity.clientName) {
        debugLog.warn(`⚠️ Client name mismatch! Direct: "${directlyExtractedClientName}" vs AI: "${parsedActivity.clientName}"`);
      }
      
      // Add Notion page ID and extracted content to the parsed activity
      const activityWithNotionId = {
        ...parsedActivity,
        notionPageId: page.id,
        lastEditedTime: page.last_edited_time,
        // Prioritize directly extracted content over AI parsing results
        notes: extractedContent.notes || parsedActivity.notes,
        tasks: extractedContent.tasks || parsedActivity.tasks
      };

      if (existingActivity) {
        // We already know we should sync (checked above)
        await this.updateWorkActivityFromParsedData(existingActivity.id, activityWithNotionId, page.properties);
        debugLog.info(`Updated work activity ${existingActivity.id} from Notion page ${page.id}`);
        if (onProgress) {
          onProgress(`✅ Updated: ${activityWithNotionId.clientName} (${activityWithNotionId.date})`);
        }
        
        // Log any AI warnings
        if (aiResult.warnings && aiResult.warnings.length > 0) {
          warnings.push(...aiResult.warnings.map(w => `${this.createPageReference(page, existingActivity.id)}: ${w}`));
        }
        
        return { action: 'updated', warnings: warnings.length > 0 ? warnings : undefined };
      } else {
        // Create new work activity using the validated workflow
        const clientProgressCallback = onProgress ? (message: string) => {
          onProgress(message);
        } : undefined;
        
        await this.createWorkActivityFromParsedData(activityWithNotionId, page.properties, clientProgressCallback);
        debugLog.info(`Created new work activity from Notion page ${page.id}`);
        if (onProgress) {
          onProgress(`✨ Created: ${activityWithNotionId.clientName} (${activityWithNotionId.date})`);
        }
        
        // Log any AI warnings
        if (aiResult.warnings && aiResult.warnings.length > 0) {
          warnings.push(...aiResult.warnings.map(w => `${this.createPageReference(page)}: ${w}`));
        }
        
        return { action: 'created', warnings: warnings.length > 0 ? warnings : undefined };
      }

    } catch (error) {
      debugLog.error(`Error processing Notion page ${page.id}:`, error);
      const errorMessage = `${this.createPageReference(page)}: Processing error - ${error instanceof Error ? error.message : 'Unknown error'}`;
      if (onProgress) {
        onProgress(`❌ Error processing page`);
      }
      return { action: 'skipped', error: errorMessage };
    }
  }

  /**
   * Get all pages from the Notion database, excluding pages with future dates
   */
  private async getAllNotionPages(): Promise<any[]> {
    const pages: any[] = [];
    let hasMore = true;
    let startCursor: string | undefined;

    // Get today's date in YYYY-MM-DD format for filtering (using local timezone)
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD format in local timezone

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: startCursor,
        page_size: 100,
        filter: {
          property: "Date",
          date: {
            on_or_before: todayStr
          }
        }
      });

      pages.push(...response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    }

    debugLog.info(`Found ${pages.length} pages with dates on or before ${todayStr} (excluding future dates)`);
    return pages;
  }


  /**
   * Extract structured data from Notion page for AI processing
   */
  private async extractNotionStructuredData(page: any): Promise<{
    structuredData: any;
    extractedContent: {
      notes: string | null;
      tasks: string | null;
    };
  }> {
    try {
      const properties = page.properties;

      // Extract all structured properties
      const clientName = this.getSelectProperty(properties, 'Client Name');
      const date = this.getDateProperty(properties, 'Date');
      const workType = this.getSelectProperty(properties, 'Work Type');
      const startTime = this.getTextProperty(properties, 'Start Time');
      const endTime = this.getTextProperty(properties, 'End Time');
      const teamMembers = this.getMultiSelectProperty(properties, 'Team Members');
      const travelTime = this.parseTravelTime(properties, 'Travel Time');
      const breakTime = this.parseNonBillableTime(properties, 'Break Minutes');
      const totalHours = this.parseHoursProperty(properties, 'Total Hours');
      
      debugLog.info(`📊 Extracting structured data for ${clientName}: travel=${travelTime}min, break=${breakTime}min, hours=${totalHours}`);

      // Get page content (unstructured data)
      const pageContent = await this.getPageContent(page.id);

      // Create structured data object for AI
      const structuredData = {
        // Structured fields from Notion properties
        clientName,
        date,
        workType,
        startTime,
        endTime,
        teamMembers,
        travelTimeMinutes: travelTime,
        breakTimeMinutes: breakTime,
        totalHours,
        notionPageId: page.id,
        lastEditedTime: page.last_edited_time,
        
        // Unstructured content from page blocks
        tasksContent: pageContent.tasks,
        notesContent: pageContent.notes,
        materialsData: pageContent.materials,
        hoursAdjustments: pageContent.hoursAdjustments
      };

      debugLog.info(`✅ Extracted structured data from Notion page ${page.id}`);
      return {
        structuredData,
        extractedContent: {
          notes: pageContent.notes || null,
          tasks: pageContent.tasks || null,
        }
      };
    } catch (error) {
      debugLog.error(`Error extracting structured data from Notion page ${page.id}:`, error);
      return {
        structuredData: null,
        extractedContent: {
          notes: null,
          tasks: null
        }
      };
    }
  }

  /**
   * Convert a Notion page to natural text format for AI parsing (legacy method)
   */
  private async convertNotionPageToNaturalText(page: any): Promise<{
    naturalText: string;
    extractedContent: {
      notes: string | null;
      tasks: string | null;
    };
  }> {
    try {
      const properties = page.properties;

      // Extract basic properties
      const clientName = this.getSelectProperty(properties, 'Client Name');
      const date = this.getDateProperty(properties, 'Date');
      const workType = this.getSelectProperty(properties, 'Work Type');
      const startTime = this.getTextProperty(properties, 'Start Time');
      const endTime = this.getTextProperty(properties, 'End Time');
      const teamMembers = this.getMultiSelectProperty(properties, 'Team Members');
      const travelTime = this.parseTravelTime(properties, 'Travel Time');
      const breakTime = this.parseNonBillableTime(properties, 'Break Minutes');
      
      debugLog.info(`🚗 Notion travel time parsing for ${clientName}: travelTime=${travelTime}, breakTime=${breakTime}`);

      // Get page content
      const pageContent = await this.getPageContent(page.id);

      // Build natural text in a format similar to work notes
      let naturalText = '';

      // Add date
      if (date) {
        // Convert YYYY-MM-DD to M/D format for consistency with work notes
        const dateObj = new Date(date);
        const month = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        naturalText += `${month}/${day}\n`;
      }

      // Add time and team info
      if (startTime && endTime) {
        naturalText += `Time: ${startTime}-${endTime}`;
        if (teamMembers && teamMembers.length > 0) {
          // Use team member names directly without abbreviation conversion
          naturalText += ` w ${teamMembers.join(' & ')}`;
        }
        if (travelTime) {
          naturalText += ` inc ${travelTime} min drive`;
        }
        naturalText += '\n';
      }

      // Add break time if present
      if (breakTime && breakTime > 0) {
        const hours = Math.floor(breakTime / 60);
        const minutes = breakTime % 60;
        if (hours > 0) {
          naturalText += `Break time: ${hours}:${minutes.toString().padStart(2, '0')}\n`;
        } else {
          naturalText += `Break time: ${minutes} min\n`;
        }
      }

      // Add client name
      if (clientName) {
        naturalText += `${clientName}\n`;
      }

      // Add work type if specified and different from default
      if (workType && workType.toLowerCase() !== 'maintenance') {
        naturalText += `Work Type: ${workType}\n`;
      }

      // Add tasks
      if (pageContent.tasks) {
        naturalText += 'Work Completed:\n';
        naturalText += pageContent.tasks + '\n';
      }

      // Add notes
      if (pageContent.notes) {
        naturalText += 'Notes:\n';
        naturalText += pageContent.notes + '\n';
      }

      // Add materials/charges
      if (pageContent.materials && pageContent.materials.length > 0) {
        naturalText += 'Charges:\n';
        pageContent.materials.forEach(material => {
          naturalText += `- ${material.description}`;
          if (material.cost > 0) {
            naturalText += ` ($${material.cost})`;
          }
          naturalText += '\n';
        });
      }

      // Add hours adjustments
      if (pageContent.hoursAdjustments && pageContent.hoursAdjustments.length > 0) {
        naturalText += 'Hours Adjustments:\n';
        pageContent.hoursAdjustments.forEach(adjustment => {
          naturalText += `- ${adjustment.person}: ${adjustment.adjustment}`;
          if (adjustment.notes) {
            naturalText += ` (${adjustment.notes})`;
          }
          naturalText += '\n';
        });
      }

      debugLog.info(`Converted Notion page ${page.id} to natural text (${naturalText.length} chars)`);
      return {
        naturalText,
        extractedContent: {
          notes: pageContent.notes || null,
          tasks: pageContent.tasks || null,
        }
      };

    } catch (error) {
      debugLog.error(`Error converting Notion page ${page.id} to text:`, error);
      return {
        naturalText: '',
        extractedContent: {
          notes: null,
          tasks: null,
        }
      };
    }
  }

  /**
   * Get employee abbreviation for natural text format
   */
  private getEmployeeAbbreviation(memberName: string): string {
    const name = memberName.toLowerCase();
    if (name.includes('virginia')) return 'V';
    if (name.includes('rebecca')) return 'R';
    if (name.includes('anne')) return 'A';
    if (name.includes('megan')) return 'M';
    if (name.includes('andrea')) return 'Me';
    return memberName; // Return full name if no abbreviation found
  }

  /**
   * Parse hours property from Notion (handles various formats)
   */
  private parseHoursProperty(properties: any, propertyName: string): number | null {
    try {
      const property = properties[propertyName];
      if (!property) return null;

      if (property.type === 'number' && property.number) {
        return property.number;
      }

      if (property.type === 'rich_text' && property.rich_text?.[0]?.text?.content) {
        const text = property.rich_text[0].text.content.trim();
        const hours = parseFloat(text);
        return isNaN(hours) ? null : hours;
      }

      return null;
    } catch (error) {
      debugLog.warn(`Failed to parse hours property '${propertyName}':`, error);
      return null;
    }
  }

  /**
   * Calculate hours from time range and employee count
   */
  private calculateHoursFromTimeRange(startTime: string, endTime: string, employeeCount: number): number | null {
    try {
      // Parse time strings (e.g., "2:00 pm", "4:35 pm")
      const start = this.parseTime(startTime);
      const end = this.parseTime(endTime);
      
      if (!start || !end) return null;

      let duration = end - start;
      if (duration < 0) duration += 24; // Handle overnight work

      // Total work hours = duration × number of employees
      return duration * employeeCount;
    } catch (error) {
      debugLog.warn(`Failed to calculate hours from time range ${startTime}-${endTime}:`, error);
      return null;
    }
  }

  /**
   * Parse time string to decimal hours
   */
  private parseTime(timeStr: string): number | null {
    try {
      const time = timeStr.toLowerCase().trim();
      
      // Handle formats like "2:00 pm", "14:30", "2:30"
      const pmMatch = time.match(/(\d{1,2}):(\d{2})\s*pm/);
      const amMatch = time.match(/(\d{1,2}):(\d{2})\s*am/);
      const militaryMatch = time.match(/(\d{1,2}):(\d{2})$/);

      if (pmMatch) {
        let hours = parseInt(pmMatch[1]);
        const minutes = parseInt(pmMatch[2]);
        if (hours !== 12) hours += 12;
        return hours + minutes / 60;
      }

      if (amMatch) {
        let hours = parseInt(amMatch[1]);
        const minutes = parseInt(amMatch[2]);
        if (hours === 12) hours = 0;
        return hours + minutes / 60;
      }

      if (militaryMatch) {
        const hours = parseInt(militaryMatch[1]);
        const minutes = parseInt(militaryMatch[2]);
        return hours + minutes / 60;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Apply hours adjustments from Notion page content
   */
  private applyHoursAdjustments(baseHours: number, adjustments: Array<{ person: string; adjustment: string; notes: string }>): number {
    let totalAdjustment = 0;

    for (const adj of adjustments) {
      try {
        const adjustmentStr = adj.adjustment.trim();
        
        // Parse adjustment like "-0:25", "0:10", "+1:30"
        const match = adjustmentStr.match(/([+-]?)(\d+):(\d{2})/);
        if (match) {
          const sign = match[1] === '-' ? -1 : 1;
          const hours = parseInt(match[2]);
          const minutes = parseInt(match[3]);
          const adjustmentHours = sign * (hours + minutes / 60);
          
          totalAdjustment += adjustmentHours;
          debugLog.info(`   Applied adjustment: ${adj.person} ${adjustmentStr} = ${adjustmentHours}h (${adj.notes})`);
        }
      } catch (error) {
        debugLog.warn(`Failed to parse hours adjustment "${adj.adjustment}":`, error);
      }
    }

    return Math.max(0, baseHours + totalAdjustment);
  }

  /**
   * Find employee match with flexible name matching
   */
  private findEmployeeMatch(searchName: string, employees: any[]): any | null {
    const search = searchName.toLowerCase().trim();
    
    // Define name mappings for AI-generated names to common first names
    const nameVariants: Record<string, string[]> = {
      'andrea': ['andrea', 'andy'],
      'virginia': ['virginia', 'ginny', 'ginger'],
      'rebecca': ['rebecca', 'becca', 'becky'],
      'anne': ['anne', 'anna', 'annie'],
      'megan': ['megan', 'meg', 'meghan'],
      'jessica': ['jessica', 'jess', 'jessie'],
      'sarah': ['sarah', 'sara'],
      'michael': ['michael', 'mike', 'mick'],
      'carlos': ['carlos', 'carl'],
    };
    
    // Strategy 1: Exact match
    let match = employees.find(emp => emp.name.toLowerCase() === search);
    if (match) {
      debugLog.info(`   📍 Found exact match: "${searchName}" = "${match.name}"`);
      return match;
    }
    
    // Strategy 2: Contains match (original logic)
    match = employees.find(emp => 
      emp.name.toLowerCase().includes(search) ||
      search.includes(emp.name.toLowerCase())
    );
    if (match) {
      debugLog.info(`   📍 Found contains match: "${searchName}" ~ "${match.name}"`);
      return match;
    }
    
    // Strategy 3: First name matching with variants
    const searchFirstName = search.split(' ')[0];
    for (const [baseName, variants] of Object.entries(nameVariants)) {
      if (variants.includes(searchFirstName)) {
        // Look for employees whose first name matches any variant of this base name
        match = employees.find(emp => {
          const empFirstName = emp.name.toLowerCase().split(' ')[0];
          return variants.includes(empFirstName) || empFirstName === baseName;
        });
        if (match) {
          debugLog.info(`   📍 Found variant match: "${searchName}" (${searchFirstName}) -> "${match.name}" via ${baseName}`);
          return match;
        }
      }
    }
    
    // Strategy 4: Partial first name match (for common nicknames)
    match = employees.find(emp => {
      const empFirstName = emp.name.toLowerCase().split(' ')[0];
      return empFirstName.startsWith(searchFirstName) || searchFirstName.startsWith(empFirstName);
    });
    if (match) {
      debugLog.info(`   📍 Found partial first name match: "${searchName}" ~ "${match.name}"`);
      return match;
    }
    
    debugLog.info(`   ❌ No match found for "${searchName}" using any strategy`);
    return null;
  }

  /**
   * Create work activity directly from structured Notion data (bypassing AI parsing)
   */
  private async createWorkActivityFromStructuredData(
    page: any,
    onProgress?: (message: string) => void
  ): Promise<void> {
    try {
      const properties = page.properties;

      // Extract all structured data directly from Notion
      const clientName = this.getSelectProperty(properties, 'Client Name');
      const date = this.getDateProperty(properties, 'Date');
      const workType = this.getSelectProperty(properties, 'Work Type') || 'maintenance';
      const startTime = this.getTextProperty(properties, 'Start Time');
      const endTime = this.getTextProperty(properties, 'End Time');
      const teamMembers = this.getMultiSelectProperty(properties, 'Team Members') || [];
      const travelTime = this.parseTravelTime(properties, 'Travel Time') || 0;
      const breakTime = this.parseNonBillableTime(properties, 'Break Minutes') || 0;
      const totalHoursFromNotion = this.parseHoursProperty(properties, 'Total Hours');

      debugLog.info(`📊 Direct Notion data extraction for ${clientName}:`);
      debugLog.info(`   Date: ${date}, Work Type: ${workType}`);
      debugLog.info(`   Time: ${startTime} - ${endTime}`);
      debugLog.info(`   Team Members: ${teamMembers.join(', ')}`);
      debugLog.info(`   Travel: ${travelTime}min, Break: ${breakTime}min`);
      debugLog.info(`   Total Hours from Notion: ${totalHoursFromNotion}`);

      // Get page content for tasks, notes, and charges
      const pageContent = await this.getPageContent(page.id);

      // Calculate total hours if not provided in Notion
      let totalHours = totalHoursFromNotion;
      if (!totalHours && startTime && endTime) {
        const calculatedHours = this.calculateHoursFromTimeRange(startTime, endTime, teamMembers.length);
        if (calculatedHours) {
          totalHours = calculatedHours;
          debugLog.info(`📊 Calculated total hours: ${totalHours}h (${startTime}-${endTime} × ${teamMembers.length} employees)`);
        }
      }

      if (!totalHours) {
        throw new Error(`Cannot determine total hours for work activity - no 'Total Hours' field and unable to calculate from time range`);
      }

      // Apply hours adjustments if any
      if (pageContent.hoursAdjustments && pageContent.hoursAdjustments.length > 0) {
        const adjustedHours = this.applyHoursAdjustments(totalHours, pageContent.hoursAdjustments);
        debugLog.info(`📊 Applied hours adjustments: ${totalHours} → ${adjustedHours}`);
        totalHours = adjustedHours;
      }

      // Ensure client exists
      if (!clientName) {
        throw new Error('Client name is required but not found in Notion page');
      }
      
      await this.ensureClientExists(clientName);
      const allClients = await this.clientService.getAllClients();
      const clientRecord = allClients.find(client => 
        client.name.toLowerCase().trim() === clientName.toLowerCase().trim()
      );

      if (!clientRecord) {
        throw new Error(`Could not find client "${clientName}" after creation`);
      }

      // Match employees
      const allEmployees = await this.employeeService.getAllEmployees();
      const employeeIds: number[] = [];
      
      debugLog.info(`🔍 Matching employees for ${clientName}:`);
      debugLog.info(`   Team members from Notion: ${JSON.stringify(teamMembers)}`);
      debugLog.info(`   Available employees: ${allEmployees.map(emp => `${emp.name} (ID: ${emp.id})`).join(', ')}`);
      
      for (const memberName of teamMembers) {
        const matchedEmployee = this.findEmployeeMatch(memberName, allEmployees);
        if (matchedEmployee) {
          employeeIds.push(matchedEmployee.id);
          debugLog.info(`   ✅ Matched "${memberName}" to "${matchedEmployee.name}" (ID: ${matchedEmployee.id})`);
        } else {
          debugLog.info(`   ❌ No match found for "${memberName}"`);
        }
      }

      debugLog.info(`   Final employee IDs: ${employeeIds.join(', ')}`);
      
      if (employeeIds.length === 0) {
        debugLog.warn(`⚠️ No employees matched - work activity will have no employee assignments!`);
      }

      // Calculate billable hours
      const billableHours = this.calculateBillableHours(
        totalHours,
        breakTime,
        0, // nonBillableTime
        0, // adjustedTravelTimeMinutes  
        pageContent.hoursAdjustments,
        0  // adjustedBreakTimeMinutes
      );

      debugLog.info(`🧮 Hours calculation: totalHours=${totalHours}, billableHours=${billableHours}`);

      // Create work activity
      if (!date) {
        throw new Error('Date is required but not found in Notion page');
      }
      
      const workActivity: NewWorkActivity = {
        workType: (workType || 'maintenance').toUpperCase() as any,
        date: date,
        status: 'needs_review',
        startTime: startTime || null,
        endTime: endTime || null,
        billableHours: billableHours,
        totalHours: totalHours,
        hourlyRate: null,
        clientId: clientRecord.id,
        projectId: null,
        travelTimeMinutes: travelTime,
        breakTimeMinutes: breakTime,
        nonBillableTimeMinutes: 0,
        notes: pageContent.notes || null,
        tasks: pageContent.tasks || null,
        notionPageId: page.id,
        lastNotionSyncAt: new Date(page.last_edited_time),
        lastUpdatedBy: 'notion_sync' as const
      };

      // Prepare employee assignments
      const workDuration = employeeIds.length > 0 ? totalHours / employeeIds.length : totalHours;
      const employees = employeeIds.map(employeeId => ({
        employeeId,
        hours: workDuration
      }));

      debugLog.info(`📊 Employee assignments: ${employees.map(e => `Employee ${e.employeeId}: ${e.hours}h`).join(', ')}`);

      // Prepare charges
      const charges = pageContent.materials?.map((material: any) => ({
        chargeType: 'material',
        description: material.description || 'Unknown material',
        quantity: material.quantity || null,
        unitRate: material.cost || null,
        totalCost: material.cost || null,
        billable: true
      })).filter((charge: any) => charge.description && charge.description !== 'Unknown material') || [];

      // Create work activity
      const createData: CreateWorkActivityData = {
        workActivity,
        employees,
        charges
      };

      await this.workActivityService.createWorkActivity(createData);
      debugLog.info(`✅ Created work activity from structured Notion data with ${employees.length} employees and ${charges.length} charges`);

    } catch (error) {
      debugLog.error('Error creating work activity from structured Notion data:', error);
      throw error;
    }
  }

  /**
   * Create a new work activity from AI-parsed data (legacy method)
   */
  private async createWorkActivityFromParsedData(
    parsedActivity: any, 
    notionPageProperties?: any,
    onProgress?: (message: string) => void
  ): Promise<void> {
    try {
      // Parse travel time and break time directly from Notion properties if available
      let travelTime = 0;
      let breakTime = 0;
      if (notionPageProperties) {
        travelTime = this.parseTravelTime(notionPageProperties, 'Travel Time') || 0;
        breakTime = this.parseNonBillableTime(notionPageProperties, 'Break Minutes') || 0;
        debugLog.info(`🚗 Direct Notion parsing for ${parsedActivity.clientName}: travelTime=${travelTime}, breakTime=${breakTime}`);
      }

      // Calculate total hours if missing or zero and we have start/end times
      const calculatedTotalHours = this.calculateTotalHours(parsedActivity);
      if (calculatedTotalHours !== null && (!parsedActivity.totalHours || parsedActivity.totalHours === 0)) {
        parsedActivity.totalHours = calculatedTotalHours;
        debugLog.info(`📊 Calculated total hours for ${parsedActivity.clientName} on ${parsedActivity.date}: ${calculatedTotalHours}h from ${parsedActivity.startTime}-${parsedActivity.endTime} with ${parsedActivity.employees?.length || 1} employee(s)`);
      }

      // Check if we need to create the client
      const existingClients = await this.clientService.getAllClients();
      
      debugLog.info(`🔍 Looking for client: "${parsedActivity.clientName}"`);
      
      // Try exact match first
      let existingClient = existingClients.find(client => 
        client.name.toLowerCase().trim() === parsedActivity.clientName.toLowerCase().trim()
      );
      
      // If no exact match, try fuzzy matching
      if (!existingClient) {
        const fuzzyMatch = this.findBestClientMatch(parsedActivity.clientName, existingClients);
        if (fuzzyMatch && fuzzyMatch.client) {
          existingClient = fuzzyMatch.client;
          debugLog.info(`🎯 Using fuzzy matched client: "${parsedActivity.clientName}" → "${fuzzyMatch.client.name}"`);
          // Update the parsed activity to use the matched client name
          parsedActivity.clientName = fuzzyMatch.client.name;
        }
      }

      if (!existingClient && onProgress) {
        onProgress(`🏗️ Creating new client: ${parsedActivity.clientName}`);
      }

      // Ensure the client exists before validation
      await this.ensureClientExists(parsedActivity.clientName);

      // Get the client ID after ensuring it exists (using the potentially updated client name)
      const updatedClients = await this.clientService.getAllClients();
      const clientRecord = updatedClients.find(client => 
        client.name.toLowerCase().trim() === parsedActivity.clientName.toLowerCase().trim()
      );

      if (!clientRecord) {
        throw new Error(`Could not find client "${parsedActivity.clientName}" after creation`);
      }

      // Get all employees for employee matching
      const allEmployees = await this.employeeService.getAllEmployees();
      const employeeIds: number[] = [];
      
      // Match employees from parsed activity with improved matching logic
      debugLog.info(`🔍 Matching employees for ${parsedActivity.clientName}:`);
      debugLog.info(`   Parsed employees: ${JSON.stringify(parsedActivity.employees)}`);
      debugLog.info(`   Available employees: ${allEmployees.map(emp => `${emp.name} (ID: ${emp.id})`).join(', ')}`);
      
      if (parsedActivity.employees && parsedActivity.employees.length > 0) {
        for (const empName of parsedActivity.employees) {
          debugLog.info(`   Looking for match for: "${empName}"`);
          const matchedEmployee = this.findEmployeeMatch(empName, allEmployees);
          if (matchedEmployee) {
            employeeIds.push(matchedEmployee.id);
            debugLog.info(`   ✅ Matched "${empName}" to "${matchedEmployee.name}" (ID: ${matchedEmployee.id})`);
          } else {
            debugLog.info(`   ❌ No match found for "${empName}"`);
          }
        }
      }
      
      debugLog.info(`   Final employee IDs: ${employeeIds.join(', ')}`);
      debugLog.info(`   Employee count: ${employeeIds.length}`);
      
      // If no employees matched, log this as a warning but don't default to anyone
      if (employeeIds.length === 0) {
        debugLog.warn(`⚠️  No employees matched for ${parsedActivity.clientName} - work activity will have no employee assignments!`);
      }

      // Calculate billable hours - do NOT subtract raw travel time, only adjusted travel time
      const billableHours = this.calculateBillableHours(
        parsedActivity.totalHours || 0, 
        parsedActivity.lunchTime,
        parsedActivity.nonBillableTime,
        0, // adjustedTravelTimeMinutes
        parsedActivity.hoursAdjustments,
        0 // adjustedBreakTimeMinutes
      );

      // Debug logging for billable hours calculation
      debugLog.info(`🧮 Hours calculation for ${parsedActivity.clientName}: totalHours=${parsedActivity.totalHours}, billableHours=${billableHours}, driveTime=${parsedActivity.driveTime}min (stored but NOT subtracted), lunchTime=${parsedActivity.lunchTime}min, nonBillableTime=${parsedActivity.nonBillableTime}min`);

      // Create work activity directly with correct lastUpdatedBy for Notion sync
      const workActivity: NewWorkActivity = {
        workType: parsedActivity.workType || 'MAINTENANCE',
        date: parsedActivity.date,
        status: 'needs_review',
        startTime: parsedActivity.startTime || null,
        endTime: parsedActivity.endTime || null,
        billableHours: billableHours,
        totalHours: parsedActivity.totalHours || 0,
        hourlyRate: null,
        clientId: clientRecord.id,
        projectId: null,
        travelTimeMinutes: travelTime || parsedActivity.driveTime || 0,
        breakTimeMinutes: breakTime || parsedActivity.lunchTime || 0,
        nonBillableTimeMinutes: parsedActivity.nonBillableTime || 0,
        notes: parsedActivity.notes || null,
        tasks: Array.isArray(parsedActivity.tasks) ? parsedActivity.tasks.join('\n') : parsedActivity.tasks || null,
        notionPageId: parsedActivity.notionPageId, // Set Notion page ID directly
        lastNotionSyncAt: new Date(parsedActivity.lastEditedTime), // Store Notion page's last_edited_time
        lastUpdatedBy: 'notion_sync' as const // Correctly mark as Notion sync from the start
      };

      // Prepare employee assignments - each employee gets the full work duration
      // Since totalHours is already duration × employees, we need to get back to the base duration
      const workDuration = employeeIds.length > 0 ? parsedActivity.totalHours / employeeIds.length : parsedActivity.totalHours;
      debugLog.info(`📊 Employee assignment calculation for ${parsedActivity.clientName}:`);
      debugLog.info(`   Total hours from AI: ${parsedActivity.totalHours}`);
      debugLog.info(`   Number of employees: ${employeeIds.length}`);
      debugLog.info(`   Work duration per employee: ${workDuration}`);
      
      const employees = employeeIds.map(employeeId => ({
        employeeId,
        hours: workDuration // Each employee gets the work duration
      }));
      
      debugLog.info(`   Employee assignments: ${employees.map(e => `Employee ${e.employeeId}: ${e.hours}h`).join(', ')}`);

      // Prepare charges
      const charges = parsedActivity.charges?.map((charge: any) => ({
        chargeType: charge.type || 'material',
        description: charge.description || 'Unknown charge',
        quantity: charge.quantity || null,
        unitRate: charge.cost || null,
        totalCost: charge.cost || null, // Allow null cost for non-billable or informational charges
        billable: charge.billable !== undefined ? charge.billable : true
      })).filter((charge: any) => charge.description && charge.description !== 'Unknown charge') || [];

      // Create work activity directly using WorkActivityService
      const createData: CreateWorkActivityData = {
        workActivity,
        employees,
        charges
      };

      await this.workActivityService.createWorkActivity(createData);
      debugLog.info(`✅ Created work activity from Notion with correct lastUpdatedBy: 'notion_sync'`);

    } catch (error) {
      debugLog.error('Error creating work activity from parsed data:', error);
      throw error;
    }
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const a = str1.toLowerCase().trim();
    const b = str2.toLowerCase().trim();
    
    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0.0;
    
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const maxLength = Math.max(a.length, b.length);
    const distance = matrix[b.length][a.length];
    return (maxLength - distance) / maxLength;
  }

  /**
   * Find the best matching client using fuzzy matching
   */
  private findBestClientMatch(clientName: string, existingClients: any[]): { client: any; similarity: number; } | null {
    debugLog.info(`🔍 Finding best match for client: "${clientName}"`);
    debugLog.info(`📋 Available clients: ${existingClients.map(c => c.name).join(', ')}`);
    
    let bestMatch: any = null;
    let bestSimilarity = 0;
    
    for (const client of existingClients) {
      const similarity = this.calculateSimilarity(clientName, client.name);
      debugLog.info(`📊 Similarity "${clientName}" vs "${client.name}": ${(similarity * 100).toFixed(1)}%`);
      
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = client;
      }
    }
    
    // Consider it a match if similarity is above 85%
    if (bestSimilarity >= 0.85) {
      debugLog.info(`✅ Found good match: "${clientName}" → "${bestMatch.name}" (${(bestSimilarity * 100).toFixed(1)}%)`);
      return { client: bestMatch, similarity: bestSimilarity };
    }
    
    debugLog.info(`❌ No good match found for "${clientName}" (best: ${(bestSimilarity * 100).toFixed(1)}%)`);
    return null;
  }

  /**
   * Ensure a client exists, creating it if necessary with improved matching
   */
  private async ensureClientExists(clientName: string): Promise<void> {
    if (!clientName || clientName.trim() === '') {
      throw new Error('Client name is required');
    }

    try {
      // Check if client already exists (case-insensitive search)
      const existingClients = await this.clientService.getAllClients();
      
      // First try exact match
      const existingClient = existingClients.find(client => 
        client.name.toLowerCase().trim() === clientName.toLowerCase().trim()
      );

      if (existingClient) {
        debugLog.info(`✅ Exact match found: "${clientName}" → "${existingClient.name}" (ID: ${existingClient.id})`);
        return;
      }

      // Try fuzzy matching for similar names
      const fuzzyMatch = this.findBestClientMatch(clientName, existingClients);
      if (fuzzyMatch) {
        debugLog.info(`🎯 Using fuzzy match: "${clientName}" → "${fuzzyMatch.client.name}" (${(fuzzyMatch.similarity * 100).toFixed(1)}% match)`);
        return; // Use the existing similar client instead of creating a new one
      }

      // Create the client if it doesn't exist
      debugLog.info(`Creating new client: "${clientName}"`);
      const newClient = await this.clientService.createClient({
        clientId: `notion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID
        name: clientName.trim(),
        address: '', // Empty address - can be filled in later
        geoZone: '', // Empty geo zone - can be filled in later
        isRecurringMaintenance: false,
        activeStatus: 'active'
      });

      debugLog.info(`✨ Auto-created client "${clientName}" (ID: ${newClient.id}) from Notion import`);
    } catch (error) {
      debugLog.error(`Error ensuring client "${clientName}" exists:`, error);
      throw new Error(`Failed to create client "${clientName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing work activity from AI-parsed data
   */
  private async updateWorkActivityFromParsedData(workActivityId: number, parsedActivity: any, notionPageProperties?: any): Promise<void> {
    try {
      // Parse travel time and break time directly from Notion properties if available
      let travelTime = 0;
      let breakTime = 0;
      if (notionPageProperties) {
        travelTime = this.parseTravelTime(notionPageProperties, 'Travel Time') || 0;
        breakTime = this.parseNonBillableTime(notionPageProperties, 'Break Minutes') || 0;
        debugLog.info(`🚗 Direct Notion parsing for update ${workActivityId}: travelTime=${travelTime}, breakTime=${breakTime}`);
      }

      // Calculate total hours if missing or zero and we have start/end times
      const calculatedTotalHours = this.calculateTotalHours(parsedActivity);
      if (calculatedTotalHours !== null && (!parsedActivity.totalHours || parsedActivity.totalHours === 0)) {
        parsedActivity.totalHours = calculatedTotalHours;
        debugLog.info(`📊 Calculated total hours for update ${workActivityId}: ${calculatedTotalHours}h from ${parsedActivity.startTime}-${parsedActivity.endTime} with ${parsedActivity.employees?.length || 1} employee(s)`);
      }

      // Calculate billable hours - do NOT subtract raw travel time, only adjusted travel time
      const billableHours = this.calculateBillableHours(
        parsedActivity.totalHours || 0, 
        parsedActivity.lunchTime,
        parsedActivity.nonBillableTime,
        0, // adjustedTravelTimeMinutes
        parsedActivity.hoursAdjustments,
        0 // adjustedBreakTimeMinutes
      );

      // For updates, we'll use a more direct approach since we already have an ID
      const updateData = {
        workType: parsedActivity.workType,
        date: parsedActivity.date,
        startTime: parsedActivity.startTime || null,
        endTime: parsedActivity.endTime || null,
        billableHours: billableHours,
        totalHours: parsedActivity.totalHours || 0,
        travelTimeMinutes: travelTime || parsedActivity.driveTime || 0,
        breakTimeMinutes: breakTime || parsedActivity.lunchTime || 0,
        nonBillableTimeMinutes: parsedActivity.nonBillableTime || 0,
        notes: parsedActivity.notes || null,
        tasks: Array.isArray(parsedActivity.tasks) ? parsedActivity.tasks.join('\n') : parsedActivity.tasks || null,
        lastNotionSyncAt: new Date(parsedActivity.lastEditedTime), // Store Notion page's last_edited_time
        lastUpdatedBy: 'notion_sync' as const, // Mark that this update came from Notion sync
      };

      await this.workActivityService.updateWorkActivity(workActivityId, updateData);
      
      // Handle charges update - delete existing charges and recreate them
      debugLog.info(`🔍 Parsed activity charges:`, parsedActivity.charges);
      if (parsedActivity.charges && parsedActivity.charges.length > 0) {
        debugLog.info(`🔄 Updating ${parsedActivity.charges.length} charges for work activity ${workActivityId}`);
        
        // Delete existing charges
        await this.workActivityService.db.delete(otherCharges)
          .where(eq(otherCharges.workActivityId, workActivityId));
        
        // Prepare and insert new charges
        const charges = parsedActivity.charges.map((charge: any, index: number) => {
          let description: string;
          let cost: number | null = null;
          let chargeType: string = 'material';
          let quantity: number | null = null;
          let billable: boolean = true;
          
          // Handle case where AI returns a string instead of an object
          if (typeof charge === 'string') {
            description = charge;
          } else {
            description = charge.description || charge.name || charge.item || 'Unknown charge';
            cost = charge.cost || charge.price || charge.amount || null;
            chargeType = charge.type || charge.chargeType || 'material';
            quantity = charge.quantity || null;
            billable = charge.billable !== undefined ? charge.billable : true;
          }
          
          const processedCharge = {
            workActivityId,
            chargeType,
            description,
            quantity,
            unitRate: cost,
            totalCost: cost,
            billable
          };
          debugLog.info(`🔍 Processing charge ${index + 1}:`, charge, '→', processedCharge);
          return processedCharge;
        }).filter((charge: any) => {
          const keep = charge.description && charge.description !== 'Unknown charge';
          if (!keep) {
            debugLog.warn(`🚫 Filtered out charge with description: "${charge.description}"`);
          }
          return keep;
        });
        
        debugLog.info(`🔍 Final charges array (${charges.length} items):`, charges);
        
        if (charges.length > 0) {
          await this.workActivityService.db.insert(otherCharges).values(charges);
          debugLog.info(`✅ Updated ${charges.length} charges for work activity ${workActivityId}`);
        } else {
          debugLog.warn(`⚠️ No valid charges to insert after filtering`);
        }
      } else {
        debugLog.info(`📝 No charges to update for work activity ${workActivityId} (parsedActivity.charges: ${parsedActivity.charges?.length || 'undefined'})`);
      }
      
      // Handle employee assignments update - delete existing assignments and recreate them
      if (parsedActivity.employees && parsedActivity.employees.length > 0) {
        debugLog.info(`👥 Updating employee assignments for work activity ${workActivityId}`);
        
        // Get all employees for matching
        const allEmployees = await this.employeeService.getAllEmployees();
        const employeeIds: number[] = [];
        
        // Match employees from parsed activity with improved matching logic
        debugLog.info(`🔍 Matching employees for update ${workActivityId}:`);
        debugLog.info(`   Parsed employees: ${JSON.stringify(parsedActivity.employees)}`);
        debugLog.info(`   Available employees: ${allEmployees.map(emp => `${emp.name} (ID: ${emp.id})`).join(', ')}`);
        
        for (const empName of parsedActivity.employees) {
          debugLog.info(`   Looking for match for: "${empName}"`);
          const matchedEmployee = this.findEmployeeMatch(empName, allEmployees);
          if (matchedEmployee) {
            employeeIds.push(matchedEmployee.id);
            debugLog.info(`   ✅ Matched "${empName}" to "${matchedEmployee.name}" (ID: ${matchedEmployee.id})`);
          } else {
            debugLog.info(`   ❌ No match found for "${empName}"`);
          }
        }
        
        debugLog.info(`   Final employee IDs for update: ${employeeIds.join(', ')}`);
        debugLog.info(`   Employee count: ${employeeIds.length}`);
        
        if (employeeIds.length > 0) {
          // Delete existing employee assignments
          await this.workActivityService.db.delete(workActivityEmployees)
            .where(eq(workActivityEmployees.workActivityId, workActivityId));
          
          // Calculate work duration per employee
          const workDuration = parsedActivity.totalHours / employeeIds.length;
          debugLog.info(`📊 Employee assignment calculation for update ${workActivityId}:`);
          debugLog.info(`   Total hours from AI: ${parsedActivity.totalHours}`);
          debugLog.info(`   Number of employees: ${employeeIds.length}`);
          debugLog.info(`   Work duration per employee: ${workDuration}`);
          
          // Create new employee assignments
          const employeeAssignments = employeeIds.map(employeeId => ({
            workActivityId,
            employeeId,
            hours: workDuration
          }));
          
          await this.workActivityService.db.insert(workActivityEmployees).values(employeeAssignments);
          debugLog.info(`✅ Updated employee assignments for work activity ${workActivityId}: ${employeeAssignments.map(e => `Employee ${e.employeeId}: ${e.hours}h`).join(', ')}`);
        } else {
          debugLog.warn(`⚠️ No employees matched for update ${workActivityId} - employee assignments not updated`);
        }
      } else {
        debugLog.info(`📝 No employees to update for work activity ${workActivityId} (parsedActivity.employees: ${parsedActivity.employees?.length || 'undefined'})`);
      }
      
      debugLog.info(`Updated work activity ${workActivityId} with AI-parsed data, charges, and employee assignments`);

    } catch (error) {
      debugLog.error(`Error updating work activity ${workActivityId}:`, error);
      throw error;
    }
  }

  /**
   * Get page content (blocks) from Notion
   */
  private async getPageContent(pageId: string): Promise<{ tasks: string; notes: string; materials: Array<{ description: string; cost: number }>; hoursAdjustments: Array<{ person: string; adjustment: string; notes: string }> }> {
    const response = await notion.blocks.children.list({
      block_id: pageId,
    });

    let tasks = '';
    let notes = '';
    const materials: Array<{ description: string; cost: number }> = [];
    const hoursAdjustments: Array<{ person: string; adjustment: string; notes: string }> = [];
    let currentSection = '';
    let inChargesSection = false;
    let inHoursAdjustmentsSection = false;

    for (const block of response.results) {
      if ('type' in block) {
        switch (block.type) {
          case 'heading_1':
          case 'heading_2':
          case 'heading_3':
            const headingText = this.extractTextFromRichText(block as any);
            if (headingText) {
              currentSection = headingText.toLowerCase();
              inChargesSection = currentSection.includes('materials') || 
                               currentSection.includes('charges') || 
                               currentSection.includes('materials/fees');
              inHoursAdjustmentsSection = currentSection.includes('hours adjustments') ||
                                         currentSection.includes('hour adjustments');
            }
            break;

          case 'to_do':
            if ('to_do' in block && block.to_do.rich_text.length > 0) {
              const taskText = block.to_do.rich_text.map((text: any) => text.plain_text).join('');
              const isCompleted = block.to_do.checked ? '[x]' : '[ ]';
              tasks += `${isCompleted} ${taskText}\n`;
            }
            break;

          case 'paragraph':
            if ('paragraph' in block && block.paragraph.rich_text.length > 0) {
              const text = block.paragraph.rich_text.map((text: any) => text.plain_text).join('');
              
              // Check if this paragraph contains charges info
              if (text.toLowerCase().includes('charges:')) {
                inChargesSection = true;
                currentSection = 'charges';
              } else if (currentSection.includes('notes') || !inChargesSection && !inHoursAdjustmentsSection) {
                // Add to notes if in notes section OR if not in any special section
                notes += text + '\n';
              }
            }
            break;

          case 'bulleted_list_item':
          case 'numbered_list_item':
            if (inChargesSection) {
              const listText = this.extractTextFromRichText(block as any);
              if (listText) {
                const chargeItem = this.parseChargeFromText(listText, true); // true = from charges section
                if (chargeItem) {
                  materials.push(chargeItem);
                }
              }
            }
            break;

          case 'table':
            if (inChargesSection && 'table' in block) {
              debugLog.info(`📋 Found table in charges section, processing...`);
              // Get table rows for materials/charges
              const tableRows = await notion.blocks.children.list({ block_id: block.id });
              debugLog.info(`📋 Table has ${tableRows.results.length} rows`);
              for (const row of tableRows.results) {
                if ('type' in row && row.type === 'table_row' && 'table_row' in row) {
                  const cells = row.table_row.cells;
                  if (cells.length >= 2) {
                    const description = cells[0]?.map((text: any) => text.plain_text).join('') || '';
                    const secondColumnText = cells[1]?.map((text: any) => text.plain_text).join('') || '';
                    
                    debugLog.info(`📋 Table row: "${description}" | "${secondColumnText}"`);
                    
                    // Skip header rows
                    if (description && description.toLowerCase() !== 'item' && description.toLowerCase() !== 'charge') {
                      // Check if second column looks like a cost (has $ or decimal) or just units/quantity
                      let cost = 0;
                      let finalDescription = description.trim();
                      
                      if (secondColumnText.match(/\$|cost|price/i) || secondColumnText.match(/^\s*\d+\.\d{2}\s*$/)) {
                        // This looks like a cost column
                        cost = parseFloat(secondColumnText.replace(/[^0-9.-]/g, '')) || 0;
                      } else if (secondColumnText.trim()) {
                        // This looks like units/quantity column, append to description
                        finalDescription += ` - ${secondColumnText.trim()}`;
                      }
                      
                      debugLog.info(`📋 Added material: "${finalDescription}" (cost: $${cost})`);
                      materials.push({ description: finalDescription, cost });
                    } else {
                      debugLog.info(`📋 Skipped header row: "${description}"`);
                    }
                  }
                }
              }
            } else if (inHoursAdjustmentsSection && 'table' in block) {
              debugLog.info(`⏰ Found table in hours adjustments section, processing...`);
              // Get table rows for hours adjustments
              const tableRows = await notion.blocks.children.list({ block_id: block.id });
              debugLog.info(`⏰ Hours adjustments table has ${tableRows.results.length} rows`);
              for (const row of tableRows.results) {
                if ('type' in row && row.type === 'table_row' && 'table_row' in row) {
                  const cells = row.table_row.cells;
                  if (cells.length >= 3) {
                    const person = cells[0]?.map((text: any) => text.plain_text).join('') || '';
                    const adjustment = cells[1]?.map((text: any) => text.plain_text).join('') || '';
                    const notes = cells[2]?.map((text: any) => text.plain_text).join('') || '';
                    
                    debugLog.info(`⏰ Hours adjustment row: "${person}" | "${adjustment}" | "${notes}"`);
                    
                    // Skip header rows
                    if (person && person.toLowerCase() !== 'person' && adjustment.trim()) {
                      debugLog.info(`⏰ Added hours adjustment: ${person} - ${adjustment} (${notes})`);
                      hoursAdjustments.push({ person: person.trim(), adjustment: adjustment.trim(), notes: notes.trim() });
                    } else {
                      debugLog.info(`⏰ Skipped header row: "${person}"`);
                    }
                  }
                }
              }
            }
            break;
        }
      }
    }

    debugLog.info(`📋 Final materials array: ${materials.length} items`, materials);
    debugLog.info(`⏰ Final hours adjustments array: ${hoursAdjustments.length} items`, hoursAdjustments);
    return { tasks: tasks.trim(), notes: notes.trim(), materials, hoursAdjustments };
  }

  /**
   * Extract text content from rich text blocks
   */
  private extractTextFromRichText(block: any): string {
    if (block.type === 'heading_1' && block.heading_1?.rich_text) {
      return block.heading_1.rich_text.map((text: any) => text.plain_text).join('');
    }
    if (block.type === 'heading_2' && block.heading_2?.rich_text) {
      return block.heading_2.rich_text.map((text: any) => text.plain_text).join('');
    }
    if (block.type === 'heading_3' && block.heading_3?.rich_text) {
      return block.heading_3.rich_text.map((text: any) => text.plain_text).join('');
    }
    if (block.type === 'bulleted_list_item' && block.bulleted_list_item?.rich_text) {
      return block.bulleted_list_item.rich_text.map((text: any) => text.plain_text).join('');
    }
    if (block.type === 'numbered_list_item' && block.numbered_list_item?.rich_text) {
      return block.numbered_list_item.rich_text.map((text: any) => text.plain_text).join('');
    }
    return '';
  }

  /**
   * Parse charge information from text like "1 bag debris" or "2 native mock orange"
   */
  private parseChargeFromText(text: string, isFromChargesSection: boolean = true): { description: string; cost: number } | null {
    if (!text || text.trim() === '') return null;
    
    // Only skip plant list items if this is NOT from a charges/materials section
    // This allows plant-related materials/fees to be processed as charges
    if (!isFromChargesSection) {
      const plantIndicators = ['native', 'achillea', 'agastache', 'guara', 'allium', 'terracotta', 'whirling', 'butterflies', 'kudos', 'yellow', 'cernuum'];
      const lowerText = text.toLowerCase();
      if (plantIndicators.some(indicator => lowerText.includes(indicator))) {
        debugLog.debug(`Skipping plant list item: ${text}`);
        return null;
      }
    }

    // Try to extract cost from parentheses like "mulch ($27)" or "debris (35)"
    const costMatch = text.match(/\(.*?(\d+(?:\.\d{2})?)\s*\)/);
    const cost = costMatch ? parseFloat(costMatch[1]) : 0;

    // Clean up description (remove cost info in parentheses)
    let description = text.replace(/\(.*?\)/g, '').trim();
    
    // If no explicit cost, look for debris items which typically have standard costs
    if (cost === 0 && description.toLowerCase().includes('debris')) {
      // Default cost for debris items
      return { description, cost: 25 }; // Default debris cost
    }

    return { description, cost };
  }

  /**
   * Check if Notion page was updated since last sync
   */
  private isNotionPageUpdated(notionLastEdited: string, dbLastUpdated: string): boolean {
    return new Date(notionLastEdited) > new Date(dbLastUpdated);
  }

  // Helper methods for extracting Notion properties
  private getSelectProperty(properties: any, propertyName: string): string | null {
    const prop = properties[propertyName];
    return prop?.select?.name || null;
  }

  private getMultiSelectProperty(properties: any, propertyName: string): string[] {
    const prop = properties[propertyName];
    return prop?.multi_select?.map((item: any) => item.name) || [];
  }

  private getTextProperty(properties: any, propertyName: string): string | null {
    const prop = properties[propertyName];
    if (prop?.rich_text?.length > 0) {
      return prop.rich_text.map((text: any) => text.plain_text).join('');
    }
    return null;
  }

  private getNumberProperty(properties: any, propertyName: string): number | null {
    const prop = properties[propertyName];
    return prop?.number || null;
  }

  /**
   * Parse travel time in "25x3" format (minutes × people)
   * Returns total travel time in minutes
   */
  private parseTravelTime(properties: any, propertyName: string): number | null {
    const prop = properties[propertyName];
    if (!prop) return null;
    
    // First try to get as number (legacy format)
    if (prop.number) {
      return prop.number;
    }
    
    // Try to get as text and parse "25x3" format
    let travelTimeText = null;
    if (prop.rich_text?.length > 0) {
      travelTimeText = prop.rich_text.map((text: any) => text.plain_text).join('');
    } else if (prop.title?.length > 0) {
      travelTimeText = prop.title.map((text: any) => text.plain_text).join('');
    }
    
    if (travelTimeText) {
      // Parse "25x3" format
      const match = travelTimeText.match(/(\d+)\s*x\s*(\d+)/i);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const people = parseInt(match[2], 10);
        return minutes * people; // Total travel time
      }
      
      // Try to parse as plain number
      const plainNumber = parseInt(travelTimeText, 10);
      if (!isNaN(plainNumber)) {
        return plainNumber;
      }
    }
    
    return null;
  }

  /**
   * Parse non-billable time in "0:15" format (HH:MM)
   * Returns time in minutes
   */
  private parseNonBillableTime(properties: any, propertyName: string): number | null {
    const prop = properties[propertyName];
    if (!prop) return null;
    
    // First try to get as number (legacy format)
    if (prop.number) {
      return prop.number;
    }
    
    // Try to get as text
    let timeText = null;
    if (prop.rich_text?.length > 0) {
      timeText = prop.rich_text.map((text: any) => text.plain_text).join('');
    } else if (prop.title?.length > 0) {
      timeText = prop.title.map((text: any) => text.plain_text).join('');
    }
    
    if (timeText) {
      // Parse "0:15" format (HH:MM)
      const match = timeText.match(/(\d+):(\d+)/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        return hours * 60 + minutes; // Convert to total minutes
      }
      
      // Try to parse as plain number (assume minutes)
      const plainNumber = parseInt(timeText, 10);
      if (!isNaN(plainNumber)) {
        return plainNumber;
      }
    }
    
    return null;
  }

  private getDateProperty(properties: any, propertyName: string): string | null {
    const prop = properties[propertyName];
    return prop?.date?.start || null;
  }

  /**
   * Get statistics about work activities imported from Notion
   */
  async getImportStats(): Promise<{
    totalWorkActivities: number;
    notionImported: number;
    percentage: number;
  }> {
    try {
      // Get all work activities
      const allActivities = await this.workActivityService.getAllWorkActivities();
      const totalWorkActivities = allActivities.length;

      // Count activities with Notion page IDs
      const notionImported = allActivities.filter(activity => 
        activity.notionPageId && activity.notionPageId.trim() !== ''
      ).length;

      // Calculate percentage
      const percentage = totalWorkActivities > 0 
        ? Math.round((notionImported / totalWorkActivities) * 100) 
        : 0;

      debugLog.info(`Import stats: ${notionImported}/${totalWorkActivities} (${percentage}%) from Notion`);

      return {
        totalWorkActivities,
        notionImported,
        percentage
      };
    } catch (error) {
      debugLog.error('Error getting import stats:', error);
      throw error;
    }
  }

  /**
   * Extract client name directly from Notion page properties
   */
  private extractClientNameFromNotionPage(page: any): string {
    try {
      debugLog.info(`🏷️ Extracting client name from Notion page ${page.id}`);
      debugLog.info(`📋 Available properties: ${Object.keys(page.properties || {}).join(', ')}`);
      
      if (page.properties && page.properties['Client Name'] && page.properties['Client Name'].select) {
        const clientName = page.properties['Client Name'].select.name || 'Unknown Client';
        debugLog.info(`✅ Found client name in 'Client Name' property: "${clientName}"`);
        return clientName;
      }
      if (page.properties && page.properties['Client'] && page.properties['Client'].select) {
        const clientName = page.properties['Client'].select.name || 'Unknown Client';
        debugLog.info(`✅ Found client name in 'Client' property: "${clientName}"`);
        return clientName;
      }
      
      debugLog.warn(`❌ No client name found in Notion page ${page.id} properties`);
      return 'Unknown Client';
    } catch (error) {
      debugLog.warn(`Error extracting client name from page ${page.id}:`, error);
      return 'Unknown Client';
    }
  }

  /**
   * Extract date directly from Notion page properties
   */
  private extractDateFromNotionPage(page: any): string {
    try {
      if (page.properties && page.properties['Date'] && page.properties['Date'].date) {
        return page.properties['Date'].date.start || 'Unknown Date';
      }
      if (page.properties && page.properties['Work Date'] && page.properties['Work Date'].date) {
        return page.properties['Work Date'].date.start || 'Unknown Date';
      }
      return 'Unknown Date';
    } catch (error) {
      debugLog.warn(`Error extracting date from page ${page.id}:`, error);
      return 'Unknown Date';
    }
  }

  /**
   * Create a user-friendly page reference for warnings and messages
   */
  private createPageReference(page: any, workActivityId?: number): string {
    const clientName = this.extractClientNameFromNotionPage(page);
    const date = this.extractDateFromNotionPage(page);
    
    // Format date nicely (convert YYYY-MM-DD to M/D/YYYY)
    let formattedDate = date;
    try {
      if (date !== 'Unknown Date') {
        const dateObj = new Date(date);
        formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
      }
    } catch (error) {
      // Keep original date if parsing fails
    }

    // Create base reference
    let reference = `"${clientName}" on ${formattedDate}`;
    
    // Add work activity link if available
    if (workActivityId) {
      reference = `[${reference}](/work-activities/${workActivityId})`;
    }
    
    // Add Notion page link
    const notionUrl = `https://notion.so/${page.id.replace(/-/g, '')}`;
    reference += ` ([View in Notion](${notionUrl}))`;
    
    return reference;
  }

  /**
   * Determine if a record should be synced from Notion based on when it was last edited
   * Only sync if the Notion page has been updated since our last sync
   * Returns an object with sync decision and optional warning message
   */
  private shouldSyncFromNotion(
    notionLastEdited: string,
    lastNotionSyncAt: string | null | undefined,
    lastUpdatedBy: string | null | undefined
  ): { shouldSync: boolean; warning?: string } {
    // If we've never synced this page before, always sync
    if (!lastNotionSyncAt) {
      debugLog.debug(`Allowing sync - no previous sync timestamp (lastNotionSyncAt: ${lastNotionSyncAt})`);
      return { shouldSync: true };
    }

    // Check if the Notion page has been updated since our last sync
    const notionEditedDate = new Date(notionLastEdited);
    const lastSyncDate = new Date(lastNotionSyncAt);
    
    const notionIsNewer = notionEditedDate > lastSyncDate;
    
    if (!notionIsNewer) {
      debugLog.debug(`Skipping sync - Notion page hasn't been updated since last sync (Notion: ${notionLastEdited}, Last sync: ${lastNotionSyncAt})`);
      return { shouldSync: false };
    }

    // If the record was last updated by the web app, warn about collaborative editing
    if (lastUpdatedBy === 'web_app') {
      debugLog.debug(`Notion page is newer than last sync, but record was last updated by web app - will sync anyway as Notion changes take precedence`);
      return { 
        shouldSync: true, 
        warning: 'Your local changes have been overwritten by newer Notion updates (collaborative editing)' 
      };
    }
    
    debugLog.debug(`Allowing sync - Notion page is newer than last sync (Notion: ${notionLastEdited}, Last sync: ${lastNotionSyncAt})`);
    return { shouldSync: true };
  }

  /**
   * Calculate total hours from start time, end time, and number of employees
   * Returns null if calculation is not possible
   */
  private calculateTotalHours(parsedActivity: any): number | null {
    if (!parsedActivity.startTime || !parsedActivity.endTime) {
      return null;
    }

    try {
      // Parse times - they should be in HH:MM format
      const startParts = parsedActivity.startTime.split(':');
      const endParts = parsedActivity.endTime.split(':');
      
      if (startParts.length !== 2 || endParts.length !== 2) {
        return null;
      }

      const startHour = parseInt(startParts[0], 10);
      const startMinute = parseInt(startParts[1], 10);
      const endHour = parseInt(endParts[0], 10);
      const endMinute = parseInt(endParts[1], 10);

      if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
        return null;
      }

      // Convert to minutes
      const startMinutes = startHour * 60 + startMinute;
      let endMinutes = endHour * 60 + endMinute;

      // Handle overnight work (end time is next day)
      if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60; // Add 24 hours
      }

      const durationMinutes = endMinutes - startMinutes;
      const durationHours = durationMinutes / 60;

      // Multiply by number of employees to get total person-hours
      const employeeCount = parsedActivity.employees?.length || 1;
      const totalHours = durationHours * employeeCount;

      return Math.round(totalHours * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      debugLog.error('Error calculating total hours:', error);
      return null;
    }
  }

  /**
   * Calculate billable hours from total hours minus non-billable time
   * Note: totalHours represents total person-hours (duration × employee count)
   * Non-billable time (lunch, non-billable time) should be subtracted as a fixed amount, not per-person
   * Raw travel time is NOT subtracted - only adjustedTravelTimeMinutes affects billable hours
   * Hours adjustments are applied to total hours first, then billable hours calculated
   * Break time is billable, only non-billable time is subtracted
   * Formula: adjustedTotalHours = totalHours + hoursAdjustments
   *          billableHours = adjustedTotalHours - (breakTimeMinutes/60) + (adjustedBreakTimeMinutes/60) - (nonBillableTime/60) + (adjustedTravelTimeMinutes/60)
   */
  private calculateBillableHours(
    totalHours: number, 
    breakTimeMinutes?: number, 
    nonBillableTime?: number,
    adjustedTravelTimeMinutes: number = 0,
    hoursAdjustments?: Array<{ person: string; adjustment: string; notes: string; hours?: number }>,
    adjustedBreakTimeMinutes: number = 0
  ): number {
    const breakHours = (breakTimeMinutes || 0) / 60; // Convert minutes to hours
    const adjustedBreakHours = adjustedBreakTimeMinutes / 60; // Convert minutes to hours
    const nonBillableHours = (nonBillableTime || 0) / 60; // Convert minutes to hours
    const adjustedTravelHours = adjustedTravelTimeMinutes / 60; // Convert minutes to hours
    
    // Calculate hours adjustments and apply to total hours first
    let totalAdjustmentHours = 0;
    if (hoursAdjustments && hoursAdjustments.length > 0) {
      totalAdjustmentHours = hoursAdjustments.reduce((sum, adj) => {
        if (adj.hours !== undefined) {
          return sum + adj.hours;
        }
        // Parse adjustment string if hours not already calculated
        const parsedHours = this.parseTimeToHours(adj.adjustment);
        return sum + parsedHours;
      }, 0);
      debugLog.info(`⏰ Total hours adjustments: ${totalAdjustmentHours} hours from ${hoursAdjustments.length} adjustments`);
    }
    
    // Apply hours adjustments to total hours first, then calculate billable hours
    const adjustedTotalHours = totalHours + totalAdjustmentHours;
    debugLog.info(`📊 Adjusted total hours: ${totalHours} + ${totalAdjustmentHours} = ${adjustedTotalHours}`);
    
    // Remove implicit break time, then add back adjusted break time
    const billableHours = adjustedTotalHours - breakHours + adjustedBreakHours - nonBillableHours + adjustedTravelHours;
    
    // Ensure billable hours is not negative
    return Math.max(0, Math.round(billableHours * 100) / 100); // Round to 2 decimal places
  }

  /**
   * Parse time string like "2:25" or "-0:30" to decimal hours
   */
  private parseTimeToHours(timeString: string): number {
    if (!timeString || typeof timeString !== 'string') {
      return 0;
    }

    // Remove any whitespace
    const cleanTime = timeString.trim();
    
    // Check for negative sign
    const isNegative = cleanTime.startsWith('-');
    const timeWithoutSign = isNegative ? cleanTime.substring(1) : cleanTime;
    
    // Parse H:MM or HH:MM format
    const timeParts = timeWithoutSign.split(':');
    if (timeParts.length !== 2) {
      debugLog.warn(`Invalid time format for hours adjustment: ${timeString}`);
      return 0;
    }
    
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    
    if (isNaN(hours) || isNaN(minutes)) {
      debugLog.warn(`Could not parse hours adjustment: ${timeString}`);
      return 0;
    }
    
    const decimalHours = hours + (minutes / 60);
    const result = isNegative ? -decimalHours : decimalHours;
    
    debugLog.info(`⏰ Parsed "${timeString}" to ${result} hours`);
    return result;
  }
} 