import { Client } from '@notionhq/client';
import { WorkActivityService, CreateWorkActivityData } from './WorkActivityService';
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
      // Convert Notion page to natural text format
      const naturalText = await this.convertNotionPageToNaturalText(page);
      
      if (!naturalText.trim()) {
        debugLog.warn(`Skipping page ${page.id} - no content to parse`);
        const skipMessage = `${this.createPageReference(page)}: No content to parse`;
        if (onProgress) {
          onProgress(`Skipped - no content to parse`);
        }
        return { action: 'skipped', message: skipMessage };
      }

      // Send AI parsing progress update
      if (onProgress) {
        onProgress(`Parsing page with AI...`);
      }

      // Use AI to parse the natural text
      debugLog.info(`Parsing Notion page ${page.id} with AI...`);
      const aiResult = await this.anthropicService.parseWorkNotes(naturalText);

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
      
      // Add Notion page ID to the parsed activity
      const activityWithNotionId = {
        ...parsedActivity,
        notionPageId: page.id,
        lastEditedTime: page.last_edited_time
      };

      if (existingActivity) {
        // We already know we should sync (checked above)
        await this.updateWorkActivityFromParsedData(existingActivity.id, activityWithNotionId);
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
        
        await this.createWorkActivityFromParsedData(activityWithNotionId, clientProgressCallback);
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
      const travelTime = this.parseTravelTime(properties, 'Travel Time');
      const nonBillableTime = this.parseNonBillableTime(properties, 'Non Billable Time');

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
      // Calculate total hours if missing or zero and we have start/end times
      const calculatedTotalHours = this.calculateTotalHours(parsedActivity);
      if (calculatedTotalHours !== null && (!parsedActivity.totalHours || parsedActivity.totalHours === 0)) {
        parsedActivity.totalHours = calculatedTotalHours;
        debugLog.info(`📊 Calculated total hours for ${parsedActivity.clientName} on ${parsedActivity.date}: ${calculatedTotalHours}h from ${parsedActivity.startTime}-${parsedActivity.endTime} with ${parsedActivity.employees?.length || 1} employee(s)`);
      }

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

      // Get the client ID after ensuring it exists
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
      
      // Match employees from parsed activity
      if (parsedActivity.employees && parsedActivity.employees.length > 0) {
        for (const empName of parsedActivity.employees) {
          const matchedEmployee = allEmployees.find(emp => 
            emp.name.toLowerCase().includes(empName.toLowerCase()) ||
            empName.toLowerCase().includes(emp.name.toLowerCase())
          );
          if (matchedEmployee) {
            employeeIds.push(matchedEmployee.id);
          }
        }
      }

      // Calculate billable hours
      const billableHours = this.calculateBillableHours(
        parsedActivity.totalHours || 0, 
        parsedActivity.driveTime, 
        parsedActivity.lunchTime,
        parsedActivity.nonBillableTime
      );

      // Create work activity directly with correct lastUpdatedBy for Notion sync
      const workActivity: NewWorkActivity = {
        workType: parsedActivity.workType || 'MAINTENANCE',
        date: parsedActivity.date,
        status: 'completed',
        startTime: parsedActivity.startTime || null,
        endTime: parsedActivity.endTime || null,
        billableHours: billableHours,
        totalHours: parsedActivity.totalHours || 0,
        hourlyRate: null,
        clientId: clientRecord.id,
        projectId: null,
        travelTimeMinutes: parsedActivity.driveTime || 0,
        breakTimeMinutes: parsedActivity.lunchTime || 0,
        nonBillableTimeMinutes: parsedActivity.nonBillableTime || 0,
        notes: parsedActivity.notes || null,
        tasks: parsedActivity.tasks?.join('\n') || null,
        notionPageId: parsedActivity.notionPageId, // Set Notion page ID directly
        lastNotionSyncAt: new Date(parsedActivity.lastEditedTime), // Store Notion page's last_edited_time
        lastUpdatedBy: 'notion_sync' as const // Correctly mark as Notion sync from the start
      };

      // Prepare employee assignments - each employee gets the full work duration
      // Since totalHours is already duration × employees, we need to get back to the base duration
      const workDuration = employeeIds.length > 0 ? parsedActivity.totalHours / employeeIds.length : parsedActivity.totalHours;
      const employees = employeeIds.map(employeeId => ({
        employeeId,
        hours: workDuration // Each employee gets the work duration
      }));

      // Prepare charges
      const charges = parsedActivity.charges?.map((charge: any) => ({
        chargeType: charge.type || 'material',
        description: charge.description || 'Unknown charge',
        quantity: charge.quantity || 1,
        unitRate: charge.cost || 0,
        totalCost: charge.cost || 0,
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
      // Calculate total hours if missing or zero and we have start/end times
      const calculatedTotalHours = this.calculateTotalHours(parsedActivity);
      if (calculatedTotalHours !== null && (!parsedActivity.totalHours || parsedActivity.totalHours === 0)) {
        parsedActivity.totalHours = calculatedTotalHours;
        debugLog.info(`📊 Calculated total hours for update ${workActivityId}: ${calculatedTotalHours}h from ${parsedActivity.startTime}-${parsedActivity.endTime} with ${parsedActivity.employees?.length || 1} employee(s)`);
      }

      // Calculate billable hours
      const billableHours = this.calculateBillableHours(
        parsedActivity.totalHours || 0, 
        parsedActivity.driveTime, 
        parsedActivity.lunchTime,
        parsedActivity.nonBillableTime
      );

      // For updates, we'll use a more direct approach since we already have an ID
      const updateData = {
        workType: parsedActivity.workType,
        date: parsedActivity.date,
        startTime: parsedActivity.startTime || null,
        endTime: parsedActivity.endTime || null,
        billableHours: billableHours,
        totalHours: parsedActivity.totalHours || 0,
        travelTimeMinutes: parsedActivity.driveTime || 0,
        breakTimeMinutes: parsedActivity.lunchTime || 0,
        nonBillableTimeMinutes: parsedActivity.nonBillableTime || 0,
        notes: parsedActivity.notes || null,
        tasks: parsedActivity.tasks?.join('\n') || null,
        lastNotionSyncAt: new Date(parsedActivity.lastEditedTime), // Store Notion page's last_edited_time
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
    let inChargesSection = false;

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
              } else if (currentSection.includes('notes')) {
                notes += text + '\n';
              }
            }
            break;

          case 'bulleted_list_item':
          case 'numbered_list_item':
            if (inChargesSection) {
              const listText = this.extractTextFromRichText(block as any);
              if (listText) {
                const chargeItem = this.parseChargeFromText(listText);
                if (chargeItem) {
                  materials.push(chargeItem);
                }
              }
            }
            break;

          case 'table':
            if (inChargesSection && 'table' in block) {
              // Get table rows for materials/charges
              const tableRows = await notion.blocks.children.list({ block_id: block.id });
              for (const row of tableRows.results) {
                if ('type' in row && row.type === 'table_row' && 'table_row' in row) {
                  const cells = row.table_row.cells;
                  if (cells.length >= 2) {
                    const description = cells[0]?.map((text: any) => text.plain_text).join('') || '';
                    const costText = cells[1]?.map((text: any) => text.plain_text).join('') || '0';
                    const cost = parseFloat(costText.replace(/[^0-9.-]/g, '')) || 0;
                    
                    if (description && description.toLowerCase() !== 'item' && description.toLowerCase() !== 'charge') {
                      materials.push({ description: description.trim(), cost });
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
  private parseChargeFromText(text: string): { description: string; cost: number } | null {
    if (!text || text.trim() === '') return null;
    
    // Skip plant list items (ignore for now as requested)
    const plantIndicators = ['native', 'achillea', 'agastache', 'guara', 'allium', 'terracotta', 'whirling', 'butterflies', 'kudos', 'yellow', 'cernuum'];
    const lowerText = text.toLowerCase();
    if (plantIndicators.some(indicator => lowerText.includes(indicator))) {
      debugLog.debug(`Skipping plant list item: ${text}`);
      return null;
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
   */
  private calculateBillableHours(totalHours: number, driveTime?: number, lunchTime?: number, nonBillableTime?: number): number {
    let nonBillableHours = 0;
    
    if (driveTime) {
      nonBillableHours += driveTime / 60; // Convert minutes to hours
    }
    
    if (lunchTime) {
      nonBillableHours += lunchTime / 60; // Convert minutes to hours
    }
    
    if (nonBillableTime) {
      nonBillableHours += nonBillableTime / 60; // Convert minutes to hours
    }
    
    const billableHours = totalHours - nonBillableHours;
    
    // Ensure billable hours is not negative
    return Math.max(0, Math.round(billableHours * 100) / 100); // Round to 2 decimal places
  }
} 