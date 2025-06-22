import { Client } from '@notionhq/client';
import { WorkActivityService } from './WorkActivityService';
import { ClientService } from './ClientService';
import { EmployeeService } from './EmployeeService';
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

  constructor() {
    this.workActivityService = new WorkActivityService();
    this.clientService = new ClientService();
    this.employeeService = new EmployeeService();

    if (!process.env.NOTION_TOKEN) {
      debugLog.warn('NOTION_TOKEN not found in environment variables');
    }
    if (!process.env.NOTION_DATABASE_ID) {
      debugLog.warn('NOTION_DATABASE_ID not found in environment variables');
    }
  }

  /**
   * Sync new and updated Notion pages with the CRM system
   */
  async syncNotionPages(): Promise<{ created: number; updated: number; errors: number }> {
    try {
      debugLog.info('Starting Notion pages sync...');
      
      const stats = { created: 0, updated: 0, errors: 0 };
      
      // Get all pages from the Notion database
      const notionPages = await this.getAllNotionPages();
      debugLog.info(`Found ${notionPages.length} pages in Notion database`);

      for (const page of notionPages) {
        try {
          const workActivityData = await this.extractWorkActivityData(page);
          
          if (!workActivityData) {
            debugLog.warn(`Skipping page ${page.id} - insufficient data`);
            continue;
          }

          // Check if work activity already exists by Notion page ID
          const existingActivity = await this.workActivityService.getWorkActivityByNotionPageId(workActivityData.notionPageId);
          
          if (existingActivity) {
            // Check if the Notion page was updated since last sync
            if (this.isNotionPageUpdated(workActivityData.lastEditedTime, existingActivity.updatedAt.toISOString())) {
              await this.updateWorkActivityFromNotion(existingActivity.id, workActivityData);
              stats.updated++;
              debugLog.info(`Updated work activity ${existingActivity.id} from Notion page ${workActivityData.notionPageId}`);
            }
          } else {
            // Create new work activity
            await this.createWorkActivityFromNotion(workActivityData);
            stats.created++;
            debugLog.info(`Created new work activity from Notion page ${workActivityData.notionPageId}`);
          }
        } catch (error) {
          debugLog.error(`Error processing Notion page ${page.id}:`, error);
          stats.errors++;
        }
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
   * Extract work activity data from a Notion page
   */
  private async extractWorkActivityData(page: any): Promise<NotionWorkActivityData | null> {
    try {
      const properties = page.properties;
      
      // Required fields
      const clientName = this.getSelectProperty(properties, 'Client Name');
      const date = this.getDateProperty(properties, 'Date');
      const workType = this.getSelectProperty(properties, 'Work Type') || 'Maintenance';
      
      if (!clientName || !date) {
        debugLog.warn(`Missing required fields for page ${page.id}: clientName=${clientName}, date=${date}`);
        return null;
      }

      // Optional fields
      const startTime = this.getTextProperty(properties, 'Start Time');
      const endTime = this.getTextProperty(properties, 'End Time');
      const teamMembers = this.getMultiSelectProperty(properties, 'Team Members') || [];
      const travelTime = this.getNumberProperty(properties, 'Travel Time');

      // Get page content (tasks, notes, materials)
      const pageContent = await this.getPageContent(page.id);

      return {
        notionPageId: page.id,
        clientName,
        date,
        workType,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        teamMembers,
        travelTime: travelTime || undefined,
        tasks: pageContent.tasks,
        notes: pageContent.notes,
        materials: pageContent.materials,
        lastEditedTime: page.last_edited_time,
      };
    } catch (error) {
      debugLog.error(`Error extracting data from Notion page ${page.id}:`, error);
      return null;
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
   * Create a new work activity from Notion data
   */
  private async createWorkActivityFromNotion(data: NotionWorkActivityData): Promise<void> {
    // Find or create client
    let client = await this.clientService.getClientByName(data.clientName);
    if (!client) {
      // Create basic client record
      client = await this.clientService.createClient({
        clientId: data.clientName.toLowerCase().replace(/\s+/g, '-'),
        name: data.clientName,
        address: '',
        geoZone: 'TBD',
      });
    }

    // Calculate total hours from start/end time if available
    const totalHours = this.calculateHours(data.startTime, data.endTime);
    
    // Create work activity
    const workActivity: NewWorkActivity = {
      workType: data.workType,
      date: data.date,
      status: 'completed',
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      billableHours: totalHours,
      totalHours: totalHours || 0,
      hourlyRate: null,
      projectId: null,
      clientId: client.id,
      travelTimeMinutes: data.travelTime || null,
      breakTimeMinutes: null,
      notes: data.notes || null,
      tasks: data.tasks || null,
      notionPageId: data.notionPageId,
    };

    // Get employee IDs for team members
    const employees = await this.mapTeamMembersToEmployees(data.teamMembers);

    // Create charges for materials
    const charges = data.materials.map(material => ({
      chargeType: 'material',
      description: material.description,
      quantity: 1,
      unitRate: material.cost,
      totalCost: material.cost,
      billable: true,
    }));

    await this.workActivityService.createWorkActivity({
      workActivity,
      employees,
      charges: charges.length > 0 ? charges : undefined,
    });
  }

  /**
   * Update an existing work activity with Notion data
   */
  private async updateWorkActivityFromNotion(workActivityId: number, data: NotionWorkActivityData): Promise<void> {
    // Find or create client
    let client = await this.clientService.getClientByName(data.clientName);
    if (!client) {
      client = await this.clientService.createClient({
        clientId: data.clientName.toLowerCase().replace(/\s+/g, '-'),
        name: data.clientName,
        address: '',
        geoZone: 'TBD',
      });
    }

    const totalHours = this.calculateHours(data.startTime, data.endTime);

    const updateData = {
      workType: data.workType,
      date: data.date,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      billableHours: totalHours,
      totalHours: totalHours || 0,
      clientId: client.id,
      travelTimeMinutes: data.travelTime || null,
      notes: data.notes || null,
      tasks: data.tasks || null,
    };

    await this.workActivityService.updateWorkActivity(workActivityId, updateData);

    // TODO: Update employees and charges as well
    // This would require more complex logic to handle additions/removals
  }

  /**
   * Map team member names to employee IDs
   */
  private async mapTeamMembersToEmployees(teamMembers: string[]): Promise<Array<{ employeeId: number; hours: number }>> {
    const employees = [];
    
    for (const memberName of teamMembers) {
      const employee = await this.employeeService.getEmployeeByName(memberName);
      if (employee) {
        employees.push({ employeeId: employee.id, hours: 0 }); // Hours will need to be calculated separately
      }
    }

    return employees;
  }

  /**
   * Check if Notion page was updated since last sync
   */
  private isNotionPageUpdated(notionLastEdited: string, dbLastUpdated: string): boolean {
    return new Date(notionLastEdited) > new Date(dbLastUpdated);
  }

  /**
   * Calculate total hours from start and end time strings
   */
  private calculateHours(startTime?: string, endTime?: string): number | null {
    if (!startTime || !endTime) return null;

    try {
      // Parse time strings like "8:45" or "3:10"
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMin;
      let endMinutes = endHour * 60 + endMin;
      
      // Handle case where end time is next day (rare but possible)
      if (endMinutes < startMinutes) {
        endMinutes += 24 * 60;
      }
      
      return (endMinutes - startMinutes) / 60;
    } catch (error) {
      debugLog.warn(`Could not parse time strings: start=${startTime}, end=${endTime}`);
      return null;
    }
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
} 