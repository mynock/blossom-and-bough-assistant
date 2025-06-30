import { Client } from '@notionhq/client';
import { WorkActivityService } from './WorkActivityService';
import { ClientService } from './ClientService';
import { EmployeeService } from './EmployeeService';
import { AnthropicService } from './AnthropicService';
import { WorkNotesParserService } from './WorkNotesParserService';
import { debugLog } from '../utils/logger';
import { NewWorkActivity } from '../db/schema';

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
  private workNotesParserService: WorkNotesParserService;

  constructor(anthropicService?: AnthropicService) {
    this.workActivityService = new WorkActivityService();
    this.clientService = new ClientService();
    this.employeeService = new EmployeeService();
    
    // Use injected service or create new one
    this.anthropicService = anthropicService || new AnthropicService();
    this.workNotesParserService = new WorkNotesParserService(this.anthropicService);

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
    abortSignal?: AbortSignal
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
        
        try {
          // Send progress update
          if (onProgress) {
            onProgress(currentPage, notionPages.length, `Processing page ${currentPage}/${notionPages.length}...`, { ...stats });
          }
          
          // First check if work activity already exists by Notion page ID
          const existingActivity = await this.workActivityService.getWorkActivityByNotionPageId(page.id);

          if (existingActivity) {
            // Check if we should sync this record BEFORE doing expensive AI processing
            const shouldSync = this.shouldSyncFromNotion(
              page.last_edited_time,
              existingActivity.lastNotionSyncAt?.toISOString(),
              existingActivity.lastUpdatedBy
            );
            
            if (!shouldSync) {
              // Skip AI processing entirely - we already know we won't sync
              debugLog.info(`Skipping page ${page.id} - local changes are newer than last Notion sync (avoiding AI processing)`);
              
              // We need to get the client name for the warning, but we'll extract it from Notion properties directly
              const clientName = this.extractClientNameFromNotionPage(page);
              const date = this.extractDateFromNotionPage(page);
              
              stats.warnings.push(`"${clientName}" on ${date}: Skipped sync - you have newer local changes that would be overwritten`);
              if (onProgress) {
                onProgress(currentPage, notionPages.length, `⚠️ Skipped: ${clientName} - local changes newer`, { ...stats });
              }
              continue; // Skip to next page without AI processing
            }
          }

          // Only do expensive AI processing if we need to sync or create new activity
          // Convert Notion page to natural text format
          const naturalText = await this.convertNotionPageToNaturalText(page);
          
          if (!naturalText.trim()) {
            debugLog.warn(`Skipping page ${page.id} - no content to parse`);
            stats.warnings.push(`Page ${page.id}: No content to parse`);
            if (onProgress) {
              onProgress(currentPage, notionPages.length, `Skipped page ${currentPage}/${notionPages.length} - no content`, { ...stats });
            }
            continue;
          }

          // Send AI parsing progress update
          if (onProgress) {
            onProgress(currentPage, notionPages.length, `Parsing page ${currentPage}/${notionPages.length} with AI...`, { ...stats });
          }

          // Use AI to parse the natural text
          debugLog.info(`Parsing Notion page ${page.id} with AI...`);
          const aiResult = await this.anthropicService.parseWorkNotes(naturalText);

          if (!aiResult.activities || aiResult.activities.length === 0) {
            debugLog.warn(`Skipping page ${page.id} - AI could not extract work activities`);
            stats.warnings.push(`Page ${page.id}: AI could not extract work activities`);
            if (onProgress) {
              onProgress(currentPage, notionPages.length, `Skipped page ${currentPage}/${notionPages.length} - no activities found`, { ...stats });
            }
            continue;
          }

          // Use the first parsed activity (assuming one activity per Notion page)
          const parsedActivity = aiResult.activities[0];
          
          // Add Notion page ID to the parsed activity
          const activityWithNotionId = {
            ...parsedActivity,
            notionPageId: page.id,
            lastEditedTime: page.last_edited_time
          };

          if (existingActivity) {
            // We already know we should sync (checked above)
            await this.updateWorkActivityFromParsedData(existingActivity.id, activityWithNotionId);
            stats.updated++;
            debugLog.info(`Updated work activity ${existingActivity.id} from Notion page ${page.id}`);
            if (onProgress) {
              onProgress(currentPage, notionPages.length, `✅ Updated: ${activityWithNotionId.clientName} (${activityWithNotionId.date})`, { ...stats });
            }
          } else {
            // Create new work activity using the validated workflow
            const clientProgressCallback = onProgress ? (message: string) => {
              onProgress(currentPage, notionPages.length, message, { ...stats });
            } : undefined;
            
            await this.createWorkActivityFromParsedData(activityWithNotionId, clientProgressCallback);
            stats.created++;
            debugLog.info(`Created new work activity from Notion page ${page.id}`);
            if (onProgress) {
              onProgress(currentPage, notionPages.length, `✨ Created: ${activityWithNotionId.clientName} (${activityWithNotionId.date})`, { ...stats });
            }
          }

          // Log any AI warnings
          if (aiResult.warnings && aiResult.warnings.length > 0) {
            stats.warnings.push(...aiResult.warnings.map(w => `Page ${page.id}: ${w}`));
          }

        } catch (error) {
          debugLog.error(`Error processing Notion page ${page.id}:`, error);
          stats.errors++;
          stats.warnings.push(`Page ${page.id}: Processing error - ${error instanceof Error ? error.message : 'Unknown error'}`);
          if (onProgress) {
            onProgress(currentPage, notionPages.length, `❌ Error processing page ${currentPage}/${notionPages.length}`, { ...stats });
          }
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
   * Get all pages from the Notion database
   */
  private async getAllNotionPages(): Promise<any[]> {
    const pages: any[] = [];
    let hasMore = true;
    let startCursor: string | undefined;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: startCursor,
        page_size: 100,
      });

      pages.push(...response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    }

    return pages;
  }

  /**
   * Convert a Notion page to natural text format for AI parsing
   */
  private async convertNotionPageToNaturalText(page: any): Promise<string> {
    try {
      const properties = page.properties;

      // Extract basic properties
      const clientName = this.getSelectProperty(properties, 'Client Name');
      const date = this.getDateProperty(properties, 'Date');
      const workType = this.getSelectProperty(properties, 'Work Type');
      const startTime = this.getTextProperty(properties, 'Start Time');
      const endTime = this.getTextProperty(properties, 'End Time');
      const teamMembers = this.getMultiSelectProperty(properties, 'Team Members');
      const travelTime = this.getNumberProperty(properties, 'Travel Time');

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
          // Convert team member names to abbreviations if possible
          const memberAbbrevs = teamMembers.map(member => this.getEmployeeAbbreviation(member)).join(' & ');
          naturalText += ` w ${memberAbbrevs}`;
        }
        if (travelTime) {
          naturalText += ` inc ${travelTime} min drive`;
        }
        naturalText += '\n';
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

      debugLog.info(`Converted Notion page ${page.id} to natural text (${naturalText.length} chars)`);
      return naturalText;

    } catch (error) {
      debugLog.error(`Error converting Notion page ${page.id} to text:`, error);
      return '';
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
   * Create a new work activity from AI-parsed data
   */
  private async createWorkActivityFromParsedData(
    parsedActivity: any, 
    onProgress?: (message: string) => void
  ): Promise<void> {
    try {
      // Check if we need to create the client
      const existingClients = await this.clientService.getAllClients();
      const existingClient = existingClients.find(client => 
        client.name.toLowerCase().trim() === parsedActivity.clientName.toLowerCase().trim()
      );

      if (!existingClient && onProgress) {
        onProgress(`🏗️ Creating new client: ${parsedActivity.clientName}`);
      }

      // Ensure the client exists before validation
      await this.ensureClientExists(parsedActivity.clientName);

      // Validate the parsed activity using the same logic as work notes import
      const mockAiResult = {
        activities: [parsedActivity],
        unparsedSections: [],
        warnings: []
      };

      const preview = await this.workNotesParserService.validateAndPreview(mockAiResult);
      
      if (preview.activities.length === 0 || !preview.activities[0].canImport) {
        throw new Error(`Validation failed: ${preview.activities[0]?.validationIssues.map(i => i.message).join(', ')}`);
      }

      // Import the validated activity
      const importResults = await this.workNotesParserService.importActivities([preview.activities[0]]);
      
      if (importResults.failed > 0) {
        throw new Error(`Import failed: ${importResults.errors.join(', ')}`);
      }

      // Update the created activity with Notion page ID and correct lastUpdatedBy
      // We need to find the just-created activity and add the notionPageId
      await this.updateNotionPageIdForActivity(parsedActivity, preview.activities[0]);

    } catch (error) {
      debugLog.error('Error creating work activity from parsed data:', error);
      throw error;
    }
  }

  /**
   * Ensure a client exists, creating it if necessary
   */
  private async ensureClientExists(clientName: string): Promise<void> {
    if (!clientName || clientName.trim() === '') {
      throw new Error('Client name is required');
    }

    try {
      // Check if client already exists (case-insensitive search)
      const existingClients = await this.clientService.getAllClients();
      const existingClient = existingClients.find(client => 
        client.name.toLowerCase().trim() === clientName.toLowerCase().trim()
      );

      if (existingClient) {
        debugLog.info(`Client "${clientName}" already exists (ID: ${existingClient.id})`);
        return;
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
  private async updateWorkActivityFromParsedData(workActivityId: number, parsedActivity: any): Promise<void> {
    try {
      // For updates, we'll use a more direct approach since we already have an ID
      const updateData = {
        workType: parsedActivity.workType,
        date: parsedActivity.date,
        startTime: parsedActivity.startTime || null,
        endTime: parsedActivity.endTime || null,
        billableHours: parsedActivity.totalHours,
        totalHours: parsedActivity.totalHours,
        travelTimeMinutes: parsedActivity.driveTime || 0,
        breakTimeMinutes: parsedActivity.lunchTime || 0,
        notes: parsedActivity.notes || null,
        tasks: parsedActivity.tasks?.join('\n') || null,
        lastNotionSyncAt: new Date(), // Mark when we synced from Notion
        lastUpdatedBy: 'notion_sync' as const, // Mark that this update came from Notion sync
      };

      await this.workActivityService.updateWorkActivity(workActivityId, updateData);
      debugLog.info(`Updated work activity ${workActivityId} with AI-parsed data`);

    } catch (error) {
      debugLog.error(`Error updating work activity ${workActivityId}:`, error);
      throw error;
    }
  }

  /**
   * Update the work activity with Notion page ID after creation and correct lastUpdatedBy
   */
  private async updateNotionPageIdForActivity(parsedActivity: any, validatedActivity: any): Promise<void> {
    try {
      // Find the activity by matching client, date, and other unique characteristics
      const activities = await this.workActivityService.getWorkActivitiesByDateRange(
        parsedActivity.date, 
        parsedActivity.date
      );

      debugLog.info(`Looking for activity to update with Notion page ID ${parsedActivity.notionPageId}. Found ${activities.length} activities on ${parsedActivity.date}`);

      // Find the most recently created activity that matches our criteria
      const matchingActivities = activities.filter(a => 
        a.clientId === validatedActivity.clientId &&
        a.totalHours === parsedActivity.totalHours &&
        a.date === parsedActivity.date &&
        !a.notionPageId // Only activities without Notion page ID
      );

      debugLog.info(`Found ${matchingActivities.length} matching activities without Notion page ID`);

      // Sort by most recent creation and take the first one
      const matchingActivity = matchingActivities
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0];

      if (matchingActivity) {
        debugLog.info(`Updating activity ${matchingActivity.id} with Notion page ID and correcting lastUpdatedBy to 'notion_sync'`);
        await this.workActivityService.updateWorkActivity(matchingActivity.id, {
          notionPageId: parsedActivity.notionPageId,
          lastNotionSyncAt: new Date(), // Mark when we synced from Notion
          lastUpdatedBy: 'notion_sync' as const // Correct the lastUpdatedBy value for Notion imports
        });
        debugLog.info(`✅ Successfully updated work activity ${matchingActivity.id} with Notion page ID ${parsedActivity.notionPageId} and corrected lastUpdatedBy to 'notion_sync'`);
      } else {
        debugLog.warn(`❌ Could not find matching work activity to update with Notion page ID ${parsedActivity.notionPageId}. Looking for: clientId=${validatedActivity.clientId}, totalHours=${parsedActivity.totalHours}, date=${parsedActivity.date}, no existing notionPageId`);
        
        // Log available activities for debugging
        activities.forEach(a => {
          debugLog.info(`Available activity: id=${a.id}, clientId=${a.clientId}, totalHours=${a.totalHours}, date=${a.date}, notionPageId=${a.notionPageId}, lastUpdatedBy=${a.lastUpdatedBy}`);
        });
      }

    } catch (error) {
      debugLog.error('Error updating work activity with Notion page ID:', error);
      // Don't throw here since the activity was created successfully
    }
  }

  /**
   * Get page content (blocks) from Notion
   */
  private async getPageContent(pageId: string): Promise<{ tasks: string; notes: string; materials: Array<{ description: string; cost: number }> }> {
    const response = await notion.blocks.children.list({
      block_id: pageId,
    });

    let tasks = '';
    let notes = '';
    const materials: Array<{ description: string; cost: number }> = [];
    let currentSection = '';
    let inMaterialsTable = false;

    for (const block of response.results) {
      if ('type' in block) {
        switch (block.type) {
          case 'heading_3':
            if ('heading_3' in block && block.heading_3.rich_text.length > 0) {
              currentSection = block.heading_3.rich_text[0].plain_text.toLowerCase();
              if (currentSection.includes('materials') || currentSection.includes('charges')) {
                inMaterialsTable = true;
              } else {
                inMaterialsTable = false;
              }
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
              if (currentSection.includes('notes')) {
                notes += text + '\n';
              }
            }
            break;

          case 'table':
            if (inMaterialsTable && 'table' in block) {
              // Get table rows for materials/charges
              const tableRows = await notion.blocks.children.list({ block_id: block.id });
              for (const row of tableRows.results) {
                if ('type' in row && row.type === 'table_row' && 'table_row' in row) {
                  const cells = row.table_row.cells;
                  if (cells.length >= 2) {
                    const description = cells[0]?.map((text: any) => text.plain_text).join('') || '';
                    const costText = cells[1]?.map((text: any) => text.plain_text).join('') || '0';
                    const cost = parseFloat(costText) || 0;
                    
                    if (description && cost > 0) {
                      materials.push({ description, cost });
                    }
                  }
                }
              }
            }
            break;
        }
      }
    }

    return { tasks: tasks.trim(), notes: notes.trim(), materials };
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
      if (page.properties && page.properties['Client Name'] && page.properties['Client Name'].select) {
        return page.properties['Client Name'].select.name || 'Unknown Client';
      }
      if (page.properties && page.properties['Client'] && page.properties['Client'].select) {
        return page.properties['Client'].select.name || 'Unknown Client';
      }
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
   * Determine if a record should be synced from Notion based on who made the last update
   * Prevents overwriting user changes made through the web app
   */
  private shouldSyncFromNotion(
    notionLastEdited: string,
    lastNotionSyncAt: string | null | undefined,
    lastUpdatedBy: string | null | undefined
  ): boolean {
    // Simple rule: Only protect records that were last updated by the web app
    // If lastUpdatedBy is 'web_app', don't sync to protect user changes
    if (lastUpdatedBy === 'web_app') {
      debugLog.debug(`Skipping sync - record was last updated by web app (lastUpdatedBy: ${lastUpdatedBy})`);
      return false;
    }
    
    // For all other cases (lastUpdatedBy === 'notion_sync' or null/undefined), allow sync
    debugLog.debug(`Allowing sync - record was last updated by ${lastUpdatedBy || 'unknown'} (not web app)`);
    return true;
  }
} 