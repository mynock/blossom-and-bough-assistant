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

  get client() {
    return notion;
  }

  get databaseId() {
    return DATABASE_ID;
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

  async appendTodoItems(pageId: string, todoTexts: string[]): Promise<{ success: boolean; count: number; pageUrl: string }> {
    try {
      debugLog.info(`Appending ${todoTexts.length} todo items to page: ${pageId}`);

      // Get all blocks on the page
      const response = await notion.blocks.children.list({
        block_id: pageId,
        page_size: 100,
      });

      // Find the Tasks heading section and the last to_do block within it
      let tasksHeadingIndex = -1;
      let lastTodoBlockId: string | null = null;
      let inTasksSection = false;

      for (const block of response.results) {
        if (!('type' in block)) continue;

        // Look for Tasks heading
        if (block.type === 'heading_2' && 'heading_2' in block) {
          const headingText = (block.heading_2 as any).rich_text?.[0]?.text?.content?.toLowerCase() || '';
          if (headingText.includes('task')) {
            inTasksSection = true;
            tasksHeadingIndex = response.results.indexOf(block);
            continue;
          } else if (inTasksSection) {
            // Hit the next heading, stop looking
            break;
          }
        }

        // Track the last to_do block in the Tasks section
        if (inTasksSection && block.type === 'to_do') {
          lastTodoBlockId = block.id;
        }
      }

      // Build the new to-do blocks
      const newTodoBlocks = todoTexts.map(text => ({
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: {
          rich_text: [{ text: { content: text } }],
          checked: false,
        },
      }));

      // Append the blocks - use `after` parameter if we found a position
      if (lastTodoBlockId) {
        await notion.blocks.children.append({
          block_id: pageId,
          children: newTodoBlocks,
          after: lastTodoBlockId,
        });
      } else {
        // Fallback: append at end of page
        await notion.blocks.children.append({
          block_id: pageId,
          children: newTodoBlocks,
        });
      }

      // Get the page URL
      const page = await notion.pages.retrieve({ page_id: pageId });
      const pageUrl = (page as any).url || `https://notion.so/${pageId.replace(/-/g, '')}`;

      debugLog.info(`Successfully appended ${todoTexts.length} todo items to page ${pageId}`);
      return { success: true, count: todoTexts.length, pageUrl };
    } catch (error) {
      debugLog.error('Error appending todo items:', error);
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
            
            // Handle table blocks specially - improved for Materials/Fees and Plant List tables
            if (block.type === 'table' && block.table) {
              debugLog.info(`Processing table block at index ${index} with ${block.table.table_width} columns`);
              try {
                // Get table rows
                const tableRows = await notion.blocks.children.list({ 
                  block_id: block.id,
                  page_size: 100 // Ensure we get all rows
                });
                
                debugLog.info(`Found ${tableRows.results.length} rows in table`);
                
                // Process each table row, preserving structure
                const processedRows = tableRows.results.map((row: any, rowIndex: number) => {
                  const { id, created_time, created_by, last_edited_time, last_edited_by, archived, ...rowWithoutMeta } = row;
                  
                  // Special handling for table_row type
                  if (row.type === 'table_row' && row.table_row) {
                    debugLog.debug(`Processing table row ${rowIndex} with ${row.table_row.cells?.length || 0} cells`);
                    return {
                      ...rowWithoutMeta,
                      table_row: {
                        cells: row.table_row.cells || []
                      }
                    };
                  }
                  
                  return rowWithoutMeta;
                });
                
                return {
                  ...blockWithoutMeta,
                  table: {
                    table_width: block.table.table_width,
                    has_column_header: block.table.has_column_header || false,
                    has_row_header: block.table.has_row_header || false,
                    children: processedRows,
                  },
                };
              } catch (tableError) {
                debugLog.error(`Error processing table block ${index}:`, tableError);
                // Return a simplified table structure as fallback with empty children
                return {
                  ...blockWithoutMeta,
                  table: {
                    table_width: block.table.table_width || 2,
                    has_column_header: block.table.has_column_header || false,
                    has_row_header: block.table.has_row_header || false,
                    children: []
                  },
                };
              }
            }
            
            // Handle other block types that might have children
            if (block.has_children && block.type !== 'table') {
              debugLog.info(`Processing block with children at index ${index}, type: ${block.type}`);
              try {
                const childBlocks = await notion.blocks.children.list({ 
                  block_id: block.id,
                  page_size: 100
                });
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
            
            // Find the first to-do item in the Tasks section and insert carryover tasks after it
            let insertIndex = -1;
            let foundTasksSection = false;
            
            for (let i = 0; i < processedBlocks.length; i++) {
              const block = processedBlocks[i] as any;
              
              // Look for Tasks heading first
              if (block && block.type === 'heading_2' && 
                  block.heading_2?.rich_text?.[0]?.text?.content?.toLowerCase().includes('task')) {
                foundTasksSection = true;
                debugLog.info(`Found Tasks section at index ${i}`);
                continue;
              }
              
              // Once we're in the Tasks section, find the first to-do item
              if (foundTasksSection && block && block.type === 'to_do') {
                insertIndex = i + 1;
                debugLog.info(`Found first to-do in Tasks section at index ${i}, will insert carryover tasks at index ${insertIndex}`);
                break;
              }
              
              // If we hit another heading after Tasks section, stop looking
              if (foundTasksSection && block && block.type === 'heading_2') {
                debugLog.info(`Reached next section at index ${i}, inserting carryover tasks here`);
                insertIndex = i;
                break;
              }
            }
            
            // If no specific location found, insert after first to-do (fallback to old behavior)
            if (insertIndex === -1) {
              for (let i = 0; i < processedBlocks.length; i++) {
                if (processedBlocks[i] && (processedBlocks[i] as any).type === 'to_do') {
                  insertIndex = i + 1;
                  debugLog.info(`Fallback: Found first to-do at index ${i}, will insert carryover tasks at index ${insertIndex}`);
                  break;
                }
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
            } else {
              debugLog.warn(`Could not find suitable location for carryover tasks, appending to end`);
              const carryoverTaskBlocks = carryoverTasks.map(task => ({
                object: 'block' as const,
                type: 'to_do' as const,
                to_do: {
                  rich_text: [{ text: { content: task } }],
                  checked: false,
                },
              }));
              processedBlocks.push(...carryoverTaskBlocks);
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
          // Fallback: create page without template - include new template structure
          debugLog.warn('No template ID provided, creating page with default template structure');
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

          // Add the template structure blocks
          const templateBlocks = [
            // Tasks section
            {
              object: 'block' as const,
              type: 'heading_2' as const,
              heading_2: {
                rich_text: [{ text: { content: 'Tasks' } }],
              },
            },
            {
              object: 'block' as const,
              type: 'to_do' as const,
              to_do: {
                rich_text: [{ text: { content: 'To-do' } }],
                checked: false,
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
            // Materials/Fees section
            {
              object: 'block' as const,
              type: 'heading_2' as const,
              heading_2: {
                rich_text: [{ text: { content: 'Materials/Fees:' } }],
              },
            },
            {
              object: 'block' as const,
              type: 'table' as const,
              table: {
                table_width: 2,
                has_column_header: true,
                has_row_header: false,
                children: [
                  {
                    object: 'block' as const,
                    type: 'table_row' as const,
                    table_row: {
                      cells: [
                        [{ text: { content: 'Item' } }],
                        [{ text: { content: 'Cost' } }]
                      ],
                    },
                  },
                  {
                    object: 'block' as const,
                    type: 'table_row' as const,
                    table_row: {
                      cells: [
                        [{ text: { content: '' } }],
                        [{ text: { content: '' } }]
                      ],
                    },
                  },
                ],
              },
            },
            // Plant List section
            {
              object: 'block' as const,
              type: 'heading_2' as const,
              heading_2: {
                rich_text: [{ text: { content: 'Plant List' } }],
              },
            },
            {
              object: 'block' as const,
              type: 'table' as const,
              table: {
                table_width: 2,
                has_column_header: true,
                has_row_header: false,
                children: [
                  {
                    object: 'block' as const,
                    type: 'table_row' as const,
                    table_row: {
                      cells: [
                        [{ text: { content: 'Name' } }],
                        [{ text: { content: 'Number' } }]
                      ],
                    },
                  },
                  {
                    object: 'block' as const,
                    type: 'table_row' as const,
                    table_row: {
                      cells: [
                        [{ text: { content: '' } }],
                        [{ text: { content: '' } }]
                      ],
                    },
                  },
                ],
              },
            },
          ];

          // Add all the template blocks to the page
          await notion.blocks.children.append({
            block_id: response.id,
            children: templateBlocks,
          });

          debugLog.info(`Created fallback page with template structure for ${clientName}`);
        }

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

  async checkForExistingEntry(clientName: string, dateString: string): Promise<any> {
    try {
      debugLog.info(`🔍 DUPLICATE CHECK (NotionService): Searching for existing entry - Client: "${clientName}" | Date: ${dateString}`);
      
      if (!notion || !DATABASE_ID) {
        debugLog.error('❌ Cannot access Notion client or database ID for duplicate check');
        return null;
      }
      
      // Try multiple query strategies to catch duplicates with enhanced logging
      const queries = [
        {
          name: 'Exact Client Name + Date Match',
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
          }
        },
        {
          name: 'Title Contains Client Name + Date Match',
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
          }
        },
        {
          name: 'Case Insensitive Title Search + Date Match',
          filter: {
            and: [
              {
                property: 'Title',
                title: { contains: clientName.toLowerCase() },
              },
              {
                property: 'Date',
                date: { equals: dateString },
              }
            ]
          }
        }
      ];

      let allEntries: any[] = [];
      let queriesSucceeded = 0;
      
      for (const { name, filter } of queries) {
        try {
          debugLog.info(`🔍 Running duplicate check strategy: ${name}`);
          const response = await notion.databases.query({
            database_id: DATABASE_ID,
            filter,
            page_size: 10,
          });
          allEntries.push(...response.results);
          queriesSucceeded++;
          debugLog.info(`🔍 Strategy "${name}" found ${response.results.length} entries`);
        } catch (queryError) {
          debugLog.warn(`⚠️ Duplicate check strategy "${name}" failed:`, queryError);
        }
      }
      
      // Remove duplicates by ID
      const uniqueEntries = allEntries.filter((entry, index, self) => 
        index === self.findIndex(e => e.id === entry.id)
      );
      
      debugLog.info(`🔍 DUPLICATE CHECK RESULT: Found ${uniqueEntries.length} unique existing entries for "${clientName}" on ${dateString} (${queriesSucceeded}/${queries.length} queries succeeded)`);
      
      if (uniqueEntries.length > 0) {
        // Log details of found entries for debugging
        debugLog.info(`📋 EXISTING ENTRIES FOUND - Will prevent creation:`);
        uniqueEntries.forEach((entry: any, index: number) => {
          const title = entry.properties?.Title?.title?.[0]?.text?.content || 'No title';
          const clientNameProp = entry.properties?.['Client Name']?.select?.name || 'No client name';
          const dateProp = entry.properties?.Date?.date?.start || 'No date';
          const entryUrl = entry.url || `https://notion.so/${entry.id.replace(/-/g, '')}`;
          debugLog.info(`📋 Entry ${index + 1}: "${title}" | Client: "${clientNameProp}" | Date: ${dateProp} | URL: ${entryUrl}`);
        });
        
        if (uniqueEntries.length > 1) {
          debugLog.warn(`⚠️ MULTIPLE DUPLICATES DETECTED: Found ${uniqueEntries.length} entries for the same client/date combination. This may indicate data inconsistency.`);
        }
      } else {
        debugLog.info(`✅ DUPLICATE CHECK PASSED: No existing entries found for "${clientName}" on ${dateString} - safe to create new entry`);
      }
      
      return uniqueEntries[0] || null;
    } catch (error) {
      debugLog.error(`❌ Error during duplicate check for "${clientName}" on ${dateString}:`, error);
      debugLog.error(`❌ Returning null to prevent duplicate creation due to check failure`);
      return null;
    }
  }

  async createEntryForDate(clientName: string, dateString: string, helperAssignments: string[] = []): Promise<CreateSmartEntryResponse> {
    try {
      debugLog.info(`🆕 Creating entry for ${clientName} on ${dateString} (unified method)`);
      
      // Check for duplicate entry first
      const existingEntry = await this.checkForExistingEntry(clientName, dateString);
      
      if (existingEntry) {
        const entryTitle = existingEntry.properties?.Title?.title?.[0]?.text?.content || 'No title';
        const entryUrl = existingEntry.url || `https://notion.so/${existingEntry.id.replace(/-/g, '')}`;
        
        debugLog.info(`🚫 DUPLICATE PREVENTED: Entry already exists for ${clientName} on ${dateString}`);
        debugLog.info(`📋 Existing entry: "${entryTitle}"`);
        debugLog.info(`🔗 Entry URL: ${entryUrl}`);
        
        return {
          success: false,
          page_url: entryUrl,
          carryover_tasks: [],
          error: `Entry already exists for ${clientName} on ${dateString}. Existing entry: ${entryTitle}`,
        };
      }

      // Get carryover tasks from the last entry
      const lastEntry = await this.getLastEntryForClient(clientName);
      let carryoverTasks: string[] = [];
      
      if (lastEntry) {
        carryoverTasks = await this.extractUncompletedTasks(lastEntry.id);
        debugLog.info(`📋 Found ${carryoverTasks.length} carryover tasks from last entry`);
      }

      // Create new Notion entry with carryover tasks
      debugLog.info(`✅ No duplicates found - creating new entry for ${clientName} on ${dateString}`);
      const newPage = await this.createEntryWithCarryover(clientName, carryoverTasks);
      
      // Always include Andrea, plus any additional helpers from calendar events
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

      // Update the date to the specified date and team members
      const updateProperties: any = {};
      
      if (dateString !== new Date().toISOString().split('T')[0]) {
        debugLog.info(`📅 Updating entry date from today to ${dateString}`);
        updateProperties.Date = {
          date: { start: dateString },
        };
      }
      
      if (helperAssignments.length > 0) {
        updateProperties['Team Members'] = {
          multi_select: uniqueTeamMembers,
        };
      }
      
      if (Object.keys(updateProperties).length > 0) {
        await notion.pages.update({
          page_id: newPage.id,
          properties: updateProperties,
        });
      }
      
      return {
        success: true,
        page_url: (newPage as any).url || `https://notion.so/${newPage.id.replace(/-/g, '')}`,
        carryover_tasks: carryoverTasks,
      };
    } catch (error) {
      debugLog.error(`Error creating entry for ${clientName} on ${dateString}:`, error);
      return {
        success: false,
        page_url: '',
        carryover_tasks: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async createSmartEntry(clientName: string): Promise<CreateSmartEntryResponse> {
    try {
      // Use the unified method for today's date
      const today = new Date().toISOString().split('T')[0];
      debugLog.info(`🔍 Manual entry creation for client "${clientName}" on ${today} (using unified method)`);
      
      return await this.createEntryForDate(clientName, today);
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