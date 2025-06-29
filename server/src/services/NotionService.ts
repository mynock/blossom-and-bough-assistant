import { Client } from '@notionhq/client';
import { debugLog } from '../utils/logger';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID!;
const TEMPLATE_ID = process.env.NOTION_TEMPLATE_ID;

export interface NotionWorkEntry {
  id: string;
  url: string;
  client_name: string;
  date: string;
  carryover_tasks: string[];
}

export interface CreateSmartEntryRequest {
  client_name: string;
}

export interface CreateSmartEntryResponse {
  success: boolean;
  page_url: string;
  carryover_tasks: string[];
  error?: string;
}

export class NotionService {
  constructor() {
    if (!process.env.NOTION_TOKEN) {
      debugLog.warn('NOTION_TOKEN not found in environment variables');
    }
    if (!process.env.NOTION_DATABASE_ID) {
      debugLog.warn('NOTION_DATABASE_ID not found in environment variables');
    }
    if (!process.env.NOTION_TEMPLATE_ID) {
      debugLog.warn('NOTION_TEMPLATE_ID not found in environment variables');
    }
  }

  async getLastEntryForClient(clientName: string) {
    try {
      debugLog.info(`Fetching last entry for client: ${clientName}`);
      
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        filter: {
          property: 'Client Name',
          select: { equals: clientName },
        },
        sorts: [{ property: 'Date', direction: 'descending' }],
        page_size: 1,
      });

      debugLog.info(`Found ${response.results.length} entries for client ${clientName}`);
      return response.results[0] || null;
    } catch (error) {
      debugLog.error('Error fetching last entry for client:', error);
      throw error;
    }
  }

  async extractUncompletedTasks(pageId: string): Promise<string[]> {
    try {
      debugLog.info(`Extracting uncompleted tasks from page: ${pageId}`);
      
      const response = await notion.blocks.children.list({
        block_id: pageId,
      });

      const uncompletedTasks: string[] = [];
      
      for (const block of response.results) {
        if ('type' in block && block.type === 'to_do' && 'to_do' in block) {
          if (!block.to_do.checked && block.to_do.rich_text.length > 0) {
            const taskText = block.to_do.rich_text
              .map((text: any) => text.plain_text)
              .join('');
            uncompletedTasks.push(taskText);
          }
        }
      }

      debugLog.info(`Found ${uncompletedTasks.length} uncompleted tasks`);
      return uncompletedTasks;
    } catch (error) {
      debugLog.error('Error extracting uncompleted tasks:', error);
      throw error;
    }
  }

  async ensureClientExistsInDatabase(clientName: string) {
    try {
      debugLog.info(`Checking if client exists in Notion database: ${clientName}`);
      
      // Get the database to check current select options
      const database = await notion.databases.retrieve({ database_id: DATABASE_ID });
      
      // Check if Client Name property exists and is a select
      const clientNameProperty = (database as any).properties['Client Name'];
      if (!clientNameProperty || clientNameProperty.type !== 'select') {
        debugLog.warn('Client Name property is not a select field');
        return;
      }

      // Check if the client name already exists as an option
      const existingOptions = clientNameProperty.select.options || [];
      const clientExists = existingOptions.some((option: any) => option.name === clientName);

      if (!clientExists) {
        debugLog.info(`Adding new client option to Notion database: ${clientName}`);
        
        // Update the database to add the new client option
        await notion.databases.update({
          database_id: DATABASE_ID,
          properties: {
            'Client Name': {
              select: {
                options: [
                  ...existingOptions,
                  { name: clientName, color: 'default' }
                ]
              }
            }
          }
        });
        
        debugLog.info(`Successfully added ${clientName} to Notion database options`);
      }
    } catch (error) {
      debugLog.error('Error ensuring client exists in database:', error);
      // Don't throw - we can still create the entry even if this fails
    }
  }

  async createEntryWithCarryover(clientName: string, carryoverTasks: string[]) {
    try {
      debugLog.info(`Creating entry for ${clientName} with ${carryoverTasks.length} carryover tasks using template: ${TEMPLATE_ID}`);
      
      // Ensure the client exists in the Notion database select options
      await this.ensureClientExistsInDatabase(clientName);
      
      let response;
      
      if (TEMPLATE_ID) {
        // First, duplicate the template page
        debugLog.info(`Duplicating template page: ${TEMPLATE_ID}`);
        const templateResponse = await notion.blocks.children.list({
          block_id: TEMPLATE_ID,
        });
        
        // Create new page in the database
        const pageTitle = `${clientName} (Maintenance)`;
        response = await notion.pages.create({
          parent: { database_id: DATABASE_ID },
          properties: {
            'Client Name': {
              select: { name: clientName },
            },
            Date: {
              date: { start: new Date().toISOString().split('T')[0] },
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
        
        // Copy template content to the new page
        if (templateResponse.results.length > 0) {
          debugLog.info(`Copying ${templateResponse.results.length} blocks from template to new page`);
          
          // Process blocks to handle special cases like tables and insert carryover tasks
          const processedBlocks = await Promise.all(templateResponse.results.map(async (block: any, index: number) => {
            // Remove the id and other metadata that shouldn't be copied
            const { id, created_time, created_by, last_edited_time, last_edited_by, archived, ...blockWithoutMeta } = block;
            
            // Handle table blocks specially
            if (block.type === 'table' && block.table) {
              debugLog.info(`Processing table block at index ${index}`);
              try {
                // Get table rows
                const tableRows = await notion.blocks.children.list({ block_id: block.id });
                
                // Process table rows
                const processedRows = tableRows.results.map((row: any) => {
                  const { id, created_time, created_by, last_edited_time, last_edited_by, archived, ...rowWithoutMeta } = row;
                  return rowWithoutMeta;
                });
                
                return {
                  ...blockWithoutMeta,
                  table: {
                    ...block.table,
                    children: processedRows,
                  }
                };
              } catch (tableError) {
                debugLog.error(`Error processing table block ${index}:`, tableError);
                // Skip this block if we can't process it
                return null;
              }
            }
            
            // Handle other block types that might have children
            if (block.has_children) {
              debugLog.info(`Processing block with children at index ${index}, type: ${block.type}`);
              try {
                const childBlocks = await notion.blocks.children.list({ block_id: block.id });
                const processedChildren = childBlocks.results.map((child: any) => {
                  const { id, created_time, created_by, last_edited_time, last_edited_by, archived, ...childWithoutMeta } = child;
                  return childWithoutMeta;
                });
                
                return {
                  ...blockWithoutMeta,
                  children: processedChildren,
                };
              } catch (childError) {
                debugLog.error(`Error processing child blocks for block ${index}:`, childError);
                // Return block without children if we can't process them
                return blockWithoutMeta;
              }
            }
            
            return blockWithoutMeta;
          }));
          
          // Insert carryover tasks after the first to-do item in the template
          if (carryoverTasks.length > 0) {
            debugLog.info(`Inserting ${carryoverTasks.length} carryover tasks into template content`);
            
            // Find the first to-do item and insert carryover tasks after it
            let insertIndex = -1;
            for (let i = 0; i < processedBlocks.length; i++) {
              if (processedBlocks[i] && (processedBlocks[i] as any).type === 'to_do') {
                insertIndex = i + 1;
                debugLog.info(`Found first to-do at index ${i}, will insert carryover tasks at index ${insertIndex}`);
                break;
              }
            }
            
            if (insertIndex > 0) {
              // Create carryover task blocks
              const carryoverTaskBlocks = carryoverTasks.map(task => ({
                object: 'block' as const,
                type: 'to_do' as const,
                to_do: {
                  rich_text: [{ text: { content: task } }],
                  checked: false,
                },
              }));
              
              // Insert carryover tasks at the found position
              processedBlocks.splice(insertIndex, 0, ...carryoverTaskBlocks);
              debugLog.info(`Inserted ${carryoverTasks.length} carryover tasks into template at index ${insertIndex}`);
            }
          }
          
          // Filter out any null blocks (failed to process)
          const validBlocks = processedBlocks.filter(block => block !== null);
          
          if (validBlocks.length > 0) {
            debugLog.info(`Appending ${validBlocks.length} processed blocks to new page`);
            await notion.blocks.children.append({
              block_id: response.id,
              children: validBlocks,
            });
          } else {
            debugLog.warn('No valid blocks to copy from template');
          }
        }
        
        // The page title should automatically reflect the Name property
        debugLog.info(`Page created with title: ${pageTitle}`);
              } else {
          // Fallback: create page without template
          debugLog.warn('No template ID provided, creating page without template');
          const pageTitle = `${new Date().toLocaleDateString()} - ${clientName} (Maintenance)`;
          response = await notion.pages.create({
            parent: { database_id: DATABASE_ID },
            properties: {
              'Client Name': {
                select: { name: clientName },
              },
              Date: {
                date: { start: new Date().toISOString().split('T')[0] },
              },
              'Work Type': {
                select: { name: 'Maintenance' },
              },
              'Team Members': {
                multi_select: [{ name: 'Andrea' }],
              }
            },
          });
        }

            // Carryover tasks are now inserted directly into the template content above

      debugLog.info(`Successfully created Notion entry for ${clientName} using template: ${TEMPLATE_ID || 'none'}`);
      return response;
    } catch (error) {
      debugLog.error('Error creating entry with carryover:', error);
      throw error;
    }
  }

  async getAvailableTemplates() {
    try {
      debugLog.info('Fetching available templates for database');
      
      // Get the database to check for templates
      const database = await notion.databases.retrieve({ database_id: DATABASE_ID });
      
      debugLog.info('Database retrieved, checking for template information');
      
      // Try to get template information from database properties
      const databaseInfo = {
        id: database.id,
        title: (database as any).title?.[0]?.plain_text || 'Unknown',
        properties: Object.keys((database as any).properties || {}),
        url: (database as any).url,
      };
      
      // Also try to search for pages that might be templates in the database
      const templatesQuery = await notion.databases.query({
        database_id: DATABASE_ID,
        filter: {
          or: [
            {
              property: 'Name',
              title: { contains: 'template' }
            },
            {
              property: 'Name', 
              title: { contains: 'Template' }
            }
          ]
        },
        page_size: 10,
      });
      
      const templatePages = templatesQuery.results.map((page: any) => ({
        id: page.id,
        title: page.properties.Name?.title?.[0]?.plain_text || 'Untitled',
        url: page.url,
        created_time: page.created_time,
        properties: Object.keys(page.properties),
      }));
      
      debugLog.info(`Found ${templatePages.length} potential template pages`);
      
      // Try to access the configured template directly
      let configuredTemplateInfo = null;
      if (TEMPLATE_ID) {
        try {
          debugLog.info(`Attempting to access configured template: ${TEMPLATE_ID}`);
          const templatePage = await notion.pages.retrieve({ page_id: TEMPLATE_ID });
          const templateBlocks = await notion.blocks.children.list({ block_id: TEMPLATE_ID });
          
          configuredTemplateInfo = {
            id: templatePage.id,
            url: (templatePage as any).url,
            created_time: (templatePage as any).created_time,
            properties: (templatePage as any).properties,
            block_count: templateBlocks.results.length,
            blocks_preview: templateBlocks.results.slice(0, 3).map((block: any) => ({
              type: block.type,
              id: block.id,
            })),
          };
          debugLog.info(`Successfully accessed configured template with ${templateBlocks.results.length} blocks`);
        } catch (templateError) {
          debugLog.error(`Error accessing configured template ${TEMPLATE_ID}:`, templateError);
          configuredTemplateInfo = {
            error: templateError instanceof Error ? templateError.message : 'Unknown error',
          };
        }
      }
      
      return {
        success: true,
        database: databaseInfo,
        template_pages: templatePages,
        configured_template_id: TEMPLATE_ID,
        configured_template_info: configuredTemplateInfo,
      };
    } catch (error) {
      debugLog.error('Error fetching available templates:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        database: null,
        template_pages: [],
        configured_template_id: TEMPLATE_ID,
        configured_template_info: null,
      };
    }
  }

  async createSmartEntry(clientName: string): Promise<CreateSmartEntryResponse> {
    try {
      // Get last entry for client
      const lastEntry = await this.getLastEntryForClient(clientName);
      let carryoverTasks: string[] = [];
      
      if (lastEntry) {
        carryoverTasks = await this.extractUncompletedTasks(lastEntry.id);
      }

      // Create new Notion entry
      const newPage = await this.createEntryWithCarryover(clientName, carryoverTasks);
      
      return {
        success: true,
        page_url: (newPage as any).url || `https://notion.so/${newPage.id.replace(/-/g, '')}`,
        carryover_tasks: carryoverTasks,
      };
    } catch (error) {
      debugLog.error('Error creating smart entry:', error);
      return {
        success: false,
        page_url: '',
        carryover_tasks: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
} 