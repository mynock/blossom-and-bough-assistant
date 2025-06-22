import Anthropic from '@anthropic-ai/sdk';
import { SchedulingContext, SchedulingResponse } from '../types';

export interface ParsedWorkActivity {
  date: string;
  clientName: string;
  employees: string[];
  startTime?: string;
  endTime?: string;
  totalHours: number;
  workType: string;
  tasks: string[];
  notes: string;
  charges?: Array<{
    description: string;
    type: string;
    cost?: number;
  }>;
  driveTime?: number;
  lunchTime?: number;
  confidence: number; // 0-1 confidence score
}

export interface WorkNotesParseResult {
  activities: ParsedWorkActivity[];
  unparsedSections: string[];
  warnings: string[];
}

export class AnthropicService {
  private client: Anthropic | null = null;
  private schedulingService: any = null; // Will be injected to avoid circular dependency

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      console.log('🤖 AnthropicService initialized with API key');
    } else {
      console.error('❌ AnthropicService: No API key found in environment variables');
      console.error('💡 Please set ANTHROPIC_API_KEY in your .env file');
    }
  }

  // Inject scheduling service to avoid circular dependency
  setSchedulingService(schedulingService: any) {
    this.schedulingService = schedulingService;
    console.log('🔗 AnthropicService: SchedulingService dependency injected');
  }

  async getSchedulingRecommendation(
    query: string, 
    context: SchedulingContext
  ): Promise<SchedulingResponse> {
    const startTime = Date.now();
    console.log('\n🚀 === ANTHROPIC API CALL START ===');
    console.log(`📝 Query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
    
    // Log context size breakdown
    const contextSizes = {
      helpers: JSON.stringify(context.helpers || []).length,
      clients: JSON.stringify(context.clients || []).length,
      calendarEvents: JSON.stringify(context.calendarEvents || []).length,
      maintenanceSchedule: JSON.stringify(context.maintenanceSchedule || []).length,
      projects: JSON.stringify(context.projects || []).length,
      helperAvailability: JSON.stringify(context.helperAvailability || []).length,
      businessMetrics: JSON.stringify(context.businessMetrics || {}).length,
      total: JSON.stringify(context).length
    };
    
    console.log(`📊 Context breakdown:`);
    console.log(`  - Helpers: ${contextSizes.helpers.toLocaleString()} chars`);
    console.log(`  - Clients: ${contextSizes.clients.toLocaleString()} chars`);
    console.log(`  - Calendar events: ${contextSizes.calendarEvents.toLocaleString()} chars`);
    console.log(`  - Maintenance: ${contextSizes.maintenanceSchedule.toLocaleString()} chars`);
    console.log(`  - Projects: ${contextSizes.projects.toLocaleString()} chars`);
    console.log(`  - Helper availability: ${contextSizes.helperAvailability.toLocaleString()} chars`);
    console.log(`  - Business metrics: ${contextSizes.businessMetrics.toLocaleString()} chars`);
    console.log(`  - Total context: ${contextSizes.total.toLocaleString()} chars`);

    if (!this.client) {
      const error = new Error('Anthropic API client not initialized. Please check your ANTHROPIC_API_KEY environment variable.');
      console.error('❌ API client not available:', error.message);
      throw error;
    }

    try {
      // Use full system prompt - no condensing
      const systemPrompt = this.buildSystemPrompt(context);
      const tools = this.getSchedulingTools();
      
      console.log(`📋 System prompt: ${systemPrompt.length} characters`);
      console.log(`🛠️ Available tools: ${tools.map(t => t.name).join(', ')}`);
      
      // Simple, clean conversation with Claude
      let messages: Array<{role: 'user' | 'assistant', content: any}> = [
        { role: 'user' as const, content: query }
      ];
      
      let currentMessage = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        temperature: 0.3,
        system: systemPrompt,
        tools: tools,
        messages: messages
      });

      console.log(`⏱️ Initial response: ${Date.now() - startTime}ms`);
      console.log(`📈 Usage: ${currentMessage.usage?.input_tokens} in, ${currentMessage.usage?.output_tokens} out`);
      
      // Handle tool calls naturally - no interference
      let toolRound = 1;
      const maxRounds = 10;
      
      while (toolRound <= maxRounds) {
        const toolUseContent = currentMessage.content.filter((content: any) => content.type === 'tool_use');
        
        if (toolUseContent.length === 0) {
          // No more tools needed - Claude is done
          const textResponse = currentMessage.content.find((content: any) => content.type === 'text');
          if (textResponse && textResponse.type === 'text') {
            const totalTime = Date.now() - startTime;
            console.log(`✅ Analysis complete: ${totalTime}ms, ${toolRound - 1} tool rounds`);
            console.log(`📝 Response: ${(textResponse as any).text.length} characters`);
            
            return {
              response: (textResponse as any).text,
              reasoning: `Claude analysis with ${toolRound - 1} rounds of tool usage`,
              suggestions: []
            };
          }
          break;
        }

        console.log(`🔧 Tool round ${toolRound}: ${toolUseContent.length} tools`);
        
        // Execute tools and add results to conversation
        messages.push({ role: 'assistant' as const, content: currentMessage.content });
        
        const toolResults = [];
        for (const toolUse of toolUseContent) {
          console.log(`🛠️ Executing: ${(toolUse as any).name}`);
          const result = await this.executeToolCall((toolUse as any).name, (toolUse as any).input);
          
          // Give Claude the full data - no summarization
          toolResults.push({
            type: 'tool_result' as const,
            tool_use_id: (toolUse as any).id,
            content: JSON.stringify(result)
          });
        }
        
        messages.push({ role: 'user' as const, content: toolResults });
        
        // Continue conversation - no conversation trimming
        currentMessage = await this.client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          temperature: 0.3,
          system: systemPrompt,
          tools: tools,
          messages: messages
        });

        console.log(`⏱️ Round ${toolRound} response: ${Date.now() - startTime}ms total`);
        console.log(`📈 Usage: ${currentMessage.usage?.input_tokens} in, ${currentMessage.usage?.output_tokens} out`);
        
        toolRound++;
      }
      
      // If we hit max rounds, return what we have
      const textResponse = currentMessage.content.find((content: any) => content.type === 'text');
      if (textResponse && textResponse.type === 'text') {
        console.log(`⚠️ Hit max rounds (${maxRounds}) but got response`);
        return {
          response: (textResponse as any).text,
          reasoning: `Claude analysis (hit ${maxRounds} round limit)`,
          suggestions: []
        };
      }
      
      throw new Error('No text response found after tool execution');
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ API call failed: ${totalTime}ms`);
      console.error('Error:', error);
      
      if (error instanceof Error && 'status' in error) {
        if ((error as any).status === 429) {
          const rateLimitError = new Error('Rate limit exceeded. Please try again later.');
          rateLimitError.name = 'RateLimitError';
          throw rateLimitError;
        }
      }
      
      throw error;
    }
  }

  private getSchedulingTools() {
    return [
      {
        name: 'get_calendar_events',
        description: 'Get calendar events for a specific date range with optional filters',
        input_schema: {
          type: 'object' as const,
          properties: {
            start_date: {
              type: 'string',
              description: 'Start date in YYYY-MM-DD format'
            },
            end_date: {
              type: 'string',
              description: 'End date in YYYY-MM-DD format'
            },
            helper_id: {
              type: 'string',
              description: 'Optional: Filter events for specific helper'
            },
            event_type: {
              type: 'string',
              description: 'Optional: Filter by event type (maintenance, client_visit, office_work)'
            }
          },
          required: ['start_date', 'end_date']
        }
      },
      {
        name: 'check_helper_availability',
        description: 'Check if a helper is available during a specific time period',
        input_schema: {
          type: 'object' as const,
          properties: {
            helper_id: {
              type: 'string',
              description: 'Helper ID to check'
            },
            start_date: {
              type: 'string',
              description: 'Start date in YYYY-MM-DD format'
            },
            end_date: {
              type: 'string',
              description: 'End date in YYYY-MM-DD format'
            },
            min_hours_needed: {
              type: 'number',
              description: 'Minimum hours needed for the job'
            }
          },
          required: ['helper_id', 'start_date', 'end_date']
        }
      },
      {
        name: 'get_maintenance_schedule',
        description: 'Get upcoming maintenance schedule for a specific client or all clients',
        input_schema: {
          type: 'object' as const,
          properties: {
            client_id: {
              type: 'string',
              description: 'Optional: Specific client ID or client name (case insensitive), or omit for all clients'
            },
            weeks_ahead: {
              type: 'number',
              description: 'How many weeks ahead to look (default: 8)'
            }
          }
        }
      },
      {
        name: 'calculate_travel_time',
        description: 'Calculate travel time between two locations',
        input_schema: {
          type: 'object' as const,
          properties: {
            origin: {
              type: 'string',
              description: 'Origin address or location'
            },
            destination: {
              type: 'string',
              description: 'Destination address or location'
            }
          },
          required: ['origin', 'destination']
        }
      },
      {
        name: 'find_scheduling_conflicts',
        description: 'Check for conflicts if scheduling a new event at a specific time',
        input_schema: {
          type: 'object' as const,
          properties: {
            helper_id: {
              type: 'string',
              description: 'Helper who would be assigned'
            },
            start_time: {
              type: 'string',
              description: 'Proposed start time (ISO format)'
            },
            duration_hours: {
              type: 'number',
              description: 'Duration in hours'
            },
            location: {
              type: 'string',
              description: 'Job location for travel time calculation'
            }
          },
          required: ['helper_id', 'start_time', 'duration_hours']
        }
      },
      {
        name: 'get_client_info',
        description: 'Get detailed information about a specific client or search for clients by name/criteria',
        input_schema: {
          type: 'object' as const,
          properties: {
            client_name: {
              type: 'string',
              description: 'Client name to search for (partial matches allowed)'
            },
            client_id: {
              type: 'string',
              description: 'Specific client ID if known'
            },
            zone: {
              type: 'string',
              description: 'Filter clients by zone'
            },
            maintenance_only: {
              type: 'boolean',
              description: 'Only return maintenance clients'
            }
          }
        }
      }
    ];
  }

  private async executeToolCall(toolName: string, input: any): Promise<any> {
    if (!this.schedulingService) {
      console.error('❌ Scheduling service not available for tool execution');
      return { error: 'Scheduling service not available' };
    }

    try {
      console.log(`🔍 Tool ${toolName} starting execution...`);
      
      switch (toolName) {
        case 'get_calendar_events':
          const events = await this.schedulingService.getCalendarEventsInRange(
            input.start_date,
            input.end_date,
            {
              helperId: input.helper_id,
              eventType: input.event_type
            }
          );
          console.log(`📅 get_calendar_events returned ${events.length} events`);
          return { events, count: events.length };

        case 'check_helper_availability':
          const availability = await this.schedulingService.checkHelperAvailability(
            input.helper_id,
            input.start_date,
            input.end_date,
            input.min_hours_needed
          );
          console.log(`👤 check_helper_availability for ${input.helper_id}: ${availability.available ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
          return availability;

        case 'get_maintenance_schedule':
          const maintenance = await this.schedulingService.getMaintenanceSchedule(
            input.client_id,
            input.weeks_ahead || 8
          );
          console.log(`🔧 get_maintenance_schedule returned ${maintenance.length} maintenance items`);
          return maintenance;

        case 'calculate_travel_time':
          const travelTime = await this.schedulingService.calculateTravelTime(
            input.origin,
            input.destination
          );
          console.log(`🚗 calculate_travel_time: ${input.origin} → ${input.destination} = ${travelTime.duration} (${travelTime.distance})`);
          return travelTime;

        case 'find_scheduling_conflicts':
          const conflicts = await this.schedulingService.findSchedulingConflicts({
            helperId: input.helper_id,
            startTime: input.start_time,
            durationHours: input.duration_hours,
            location: input.location
          });
          console.log(`⚠️ find_scheduling_conflicts found ${conflicts.conflicts?.length || 0} conflicts`);
          return conflicts;

        case 'get_client_info':
          const clientInfo = await this.schedulingService.getClientInfo(
            input.client_name,
            input.client_id,
            input.zone,
            input.maintenance_only
          );
          console.log(`🔍 get_client_info returned ${clientInfo.length} client(s)`);
          return clientInfo;

        default:
          console.error(`❌ Unknown tool: ${toolName}`);
          return { error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      console.error(`❌ Error executing tool ${toolName}:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error,
        input: input
      });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { error: `Failed to execute ${toolName}: ${errorMessage}` };
    }
  }

  public buildSystemPrompt(context: SchedulingContext): string {
    try {
      console.log('🔍 Building system prompt...');
      console.log('📊 Context keys:', Object.keys(context || {}));
      
      const helpers = context?.helpers || [];
      const clients = context?.clients || [];
      const calendarEvents = context?.calendarEvents || [];
      
      console.log(`📋 Data counts: helpers=${helpers.length}, clients=${clients.length}, events=${calendarEvents.length}`);
      
      // Build helpers table
      let helpersTable = '| Helper | Days | Skills | Rate | Team Status |\n|--------|------|--------|------|-------------|\n';
      
      if (helpers.length > 0) {
        try {
          helpers.forEach(h => {
            if (!h) return;
            const name = h.name || 'Unknown';
            const workdays = Array.isArray(h.workdays) ? h.workdays.join('/') : 'Unknown';
            const tier = h.capabilityTier || 'Unknown';
            const rate = h.hourlyRate ? `$${h.hourlyRate}` : 'Unknown';
            const notes = h.notes || 'Standard';
            
            helpersTable += `| **${name}** | ${workdays} | ${tier} | ${rate} | ${notes} |\n`;
          });
        } catch (helperError) {
          console.error('❌ Error processing helpers:', helperError);
          helpersTable += '| Error processing helpers | | | | |\n';
        }
      } else {
        helpersTable += '| No helpers available | | | | |\n';
      }

      // Group clients by maintenance status and zone
      const maintenanceClientsByZone: { [key: string]: any[] } = {};
      const nonMaintenanceClientsByZone: { [key: string]: any[] } = {};
      
      if (clients.length > 0) {
        try {
          clients.forEach(c => {
            if (!c) return;
            const zone = c.zone || 'Unknown';
            
            if (c.maintenanceSchedule?.isMaintenance) {
              if (!maintenanceClientsByZone[zone]) {
                maintenanceClientsByZone[zone] = [];
              }
              maintenanceClientsByZone[zone].push(c);
            } else {
              if (!nonMaintenanceClientsByZone[zone]) {
                nonMaintenanceClientsByZone[zone] = [];
              }
              nonMaintenanceClientsByZone[zone].push(c);
            }
          });
        } catch (clientError) {
          console.error('❌ Error processing clients:', clientError);
          maintenanceClientsByZone['Error'] = [{ name: 'Error processing clients' }];
        }
      }

      // Build maintenance clients by zone section
      let maintenanceClientsSection = '';
      Object.keys(maintenanceClientsByZone).forEach(zone => {
        const zoneClients = maintenanceClientsByZone[zone];
        const clientList = zoneClients.map(c => {
          const name = c.name || 'Unknown';
          const hours = c.maintenanceSchedule?.hoursPerVisit ? `${c.maintenanceSchedule.hoursPerVisit}h` : '';
          const rate = c.maintenanceSchedule?.rate ? `$${c.maintenanceSchedule.rate}` : '';
          const intervalWeeks = c.maintenanceSchedule?.intervalWeeks ? `${c.maintenanceSchedule.intervalWeeks}wk` : '';
          const special = c.notes ? '*' : '';
          
          // Build the client string with hours, rate, and interval
          let clientStr = name;
          const details = [];
          if (hours) details.push(hours);
          if (rate) details.push(rate);
          if (intervalWeeks) details.push(intervalWeeks);
          
          if (details.length > 0) {
            clientStr += ` (${details.join('/')})`;
          }
          clientStr += special;
          
          return clientStr;
        }).join(', ');
        maintenanceClientsSection += `**${zone}:** ${clientList}\n`;
      });

      // Build non-maintenance clients by zone section
      let nonMaintenanceClientsSection = '';
      Object.keys(nonMaintenanceClientsByZone).forEach(zone => {
        const zoneClients = nonMaintenanceClientsByZone[zone];
        const clientList = zoneClients.map(c => {
          const name = c.name || 'Unknown';
          const special = c.notes ? '*' : '';
          return `${name}${special}`;
        }).join(', ');
        nonMaintenanceClientsSection += `**${zone}:** ${clientList}\n`;
      });

      // Build recent events summary (last 7 days + next 14 days)
      let recentEventsSection = '';
      if (calendarEvents.length > 0) {
        try {
          const now = new Date();
          const thisWeekEvents: any[] = [];
          const nextWeekEvents: any[] = [];
          
          calendarEvents.forEach(e => {
            if (!e || !e.start) return;
            const eventDate = new Date(e.start);
            const daysDiff = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
            
            if (daysDiff >= 0 && daysDiff <= 7) {
              thisWeekEvents.push(e);
            } else if (daysDiff > 7 && daysDiff <= 14) {
              nextWeekEvents.push(e);
            }
          });

          if (thisWeekEvents.length > 0) {
            recentEventsSection += '**This Week:**\n';
            thisWeekEvents.forEach(e => {
              const date = new Date(e.start);
              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
              const dateStr = date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
              const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });
              const title = e.title || 'Untitled';
              recentEventsSection += `- ${dayName} ${dateStr}: ${timeStr} ${title}\n`;
            });
          }

          if (nextWeekEvents.length > 0) {
            recentEventsSection += '\n**Next Week:**\n';
            nextWeekEvents.forEach(e => {
              const date = new Date(e.start);
              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
              const dateStr = date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
              const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });
              const title = e.title || 'Untitled';
              recentEventsSection += `- ${dayName} ${dateStr}: ${timeStr} ${title}\n`;
            });
          }

          if (thisWeekEvents.length === 0 && nextWeekEvents.length === 0) {
            recentEventsSection = 'No events scheduled for the next 2 weeks';
          }
        } catch (eventError) {
          console.error('❌ Error processing events:', eventError);
          recentEventsSection = 'Error processing events';
        }
      } else {
        recentEventsSection = 'No events scheduled';
      }

      // Build maintenance summary
      let maintenanceSection = '';
      if (Array.isArray(context.maintenanceSchedule) && context.maintenanceSchedule.length > 0) {
        try {
          const overdue = context.maintenanceSchedule.filter((m: any) => m?.overdue);
          const upcoming = context.maintenanceSchedule.filter((m: any) => m && !m.overdue).slice(0, 10);
          
          if (overdue.length > 0) {
            maintenanceSection += `**${overdue.length} overdue clients** - Priority scheduling needed\n`;
          }
          
          if (upcoming.length > 0) {
            maintenanceSection += `**Next due:** ${upcoming.map((m: any) => {
              const clientName = m.clientName || 'Unknown';
              const nextDue = m.nextDue ? new Date(m.nextDue).toLocaleDateString() : 'Unknown';
              return `${clientName} (${nextDue})`;
            }).join(', ')}\n`;
          }
          
          maintenanceSection += `**Total maintenance clients:** ${context.maintenanceSchedule.length} on 4-week cycles`;
        } catch (maintenanceError) {
          console.error('❌ Error processing maintenance:', maintenanceError);
          maintenanceSection = 'Error processing maintenance schedule';
        }
      } else {
        maintenanceSection = 'No maintenance schedule data available';
      }

      const currentDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      const prompt = `# Andrea's AI Landscaping Scheduling Assistant

You are Andrea's intelligent scheduling assistant. Handle queries naturally - whether specific or broad. For complex analysis, use multiple tools as needed to provide comprehensive insights.

**IMPORTANT: All times and dates are in Pacific Time (US West Coast). Current year is 2025.**

## Business Rules
- Each helper needs 7-8 hours on workdays | **Andrea targets 3 field days/week**
- **Team jobs:** Most work requires 2+ people | Solo work only for Virginia/Rebecca/Andrea
- **Hour calculation:** Job hours = total work (split across team members)
- Group nearby clients to minimize travel | Match helper skills + team needs to project complexity
- 4-week maintenance cycles for most clients | Emergency work overrides routine maintenance

## Team (Current Date: ${currentDate})

**Andrea (Owner):** Field work 3 days/week target + project management
- **Field days:** Flexible, typically Mon/Thu/Fri
- **Solo capable:** Yes, can work with any helper or alone

${helpersTable}

**Work Calculation:** Hours listed = total job hours (can be split across team members)
- 12-hour job = Andrea + Helper for 6 hours OR Solo worker for 12 hours
- Always consider team composition when scheduling

## Maintenance Clients by Zone

${maintenanceClientsSection}

*Format: ClientName (hours/rate/interval) - where hours = estimated job hours, rate = hourly rate, interval = maintenance cycle in weeks*

## Non-Maintenance Clients by Zone

${nonMaintenanceClientsSection}

*Special markers: * = special notes/requirements*

## Current Schedule Snapshot (Next 2 weeks)

${recentEventsSection}

## Event Format Reference
Calendar events follow this standardized format:
**Title:** \`[Status] Client - WorkType (Helper) | Notes\`
- **Status:** [C] Confirmed, [T] Tentative, [P] Planning
- **WorkType:** Maintenance (Green), Ad-hoc (Red), Design (Purple), Office Work (Gray), Errands (Orange)
- **Helper:** Team member assigned (Rebecca, Anne, Megan, Virginia, Andrea)
- **Notes:** Additional details about the work

**Examples:**
- \`[C] Smith - Maintenance (Rebecca) | Pruning and mulching\`
- \`[P] Johnson - Design (Andrea) | Initial consultation\`
- \`[T] Office Work (Anne) | Invoicing and follow-ups\`

## Maintenance Status Summary
${maintenanceSection}

## Available Tools
Use when you need details beyond this summary:

**Database Tools (for client information):**
- \`get_client_info\` - Search and retrieve detailed client information by name, zone, or other criteria
- \`check_helper_availability\` - Detailed helper availability analysis

**Calendar Tools (for scheduling data):**
- \`get_calendar_events\` - Get specific date ranges, detailed event info, historical data
- \`find_scheduling_conflicts\` - Check for conflicts with proposed times

**Analysis Tools:**  
- \`calculate_travel_time\` - Optimize routes between locations
- \`get_maintenance_schedule\` - Calculate overdue clients, next service dates (use sparingly - prefer get_client_info for client details)

## Tool Usage Guidelines
- **Use tools naturally** based on what the user is asking
- **For broad queries** like "look at my schedule" or "any concerns" - use multiple tools to get a complete picture
- **For specific questions** - use the most direct tool
- **Think step by step** - if you need calendar data AND client details, get both
- **Provide comprehensive analysis** for open-ended questions

**For broad schedule reviews:** Start with get_calendar_events for the requested timeframe, then analyze what you see. Look for patterns, conflicts, workload balance, geographic efficiency, and maintenance timing. Provide actionable insights.

## Response Format
1. **Acknowledge** the request and relevant constraints
2. **Analyze** using provided context + tools as needed  
3. **Recommend** specific schedule with times, helpers, reasoning
4. **Highlight** key considerations (travel, skills, client preferences)
5. **Suggest alternatives** and ask clarifying questions

Use clear formatting: **bold names**, time ranges like "8:00 AM - 2:00 PM", and bullet points for options.`;

      console.log('✅ System prompt built successfully');
      return prompt;
      
    } catch (error) {
      console.error('❌ Error in buildSystemPrompt:', error);
      return 'Error building system prompt. Using fallback.';
    }
  }

  /**
   * Parse free-form work notes into structured work activities
   */
  async parseWorkNotes(workNotesText: string): Promise<WorkNotesParseResult> {
    if (!this.client) {
      throw new Error('Anthropic client not initialized');
    }

    const prompt = `You are an expert at parsing landscaping work logs into structured data. 

Parse the following work notes and extract individual work activities. Each activity should represent work done for a specific client on a specific date.

IMPORTANT PATTERNS TO RECOGNIZE:

TIME FORMATS:
- "8:45-3:10 w V inc 22x2 min drive" = start 8:45, end 3:10, with Virginia, including 44min drive
- "on site 9/9:25-11:45 inc lil break, add .5 drive" = on site 9:00-9:25 to 11:45, add 30min drive
- "R 8:30-4:15, Me 9:40-5" = Rebecca 8:30-4:15, Me 9:40-5:00

EMPLOYEE CODES:
- "w V" = with Virginia
- "w R" = with Rebecca  
- "w A" = with Anne
- "w M" = with Megan
- "solo" = solo work (Andrea Wilson working alone)
- "me" or "Me" = Andrea Wilson (the business owner)

BUSINESS CONTEXT:
- Andrea Wilson is the business owner of this landscaping company
- When notes mention "me", "Me", or "I", this refers to Andrea Wilson
- Andrea often works alongside her employees or solo on client sites

CLIENT NAMES:
- Direct client names like "Stoller", "Nadler", "Kurzweil", "Silver", etc.

CHARGES:
- "charge 1 debris bag" 
- "Charge: Sluggo, fert, 2-3 bags debris, 3 aspidistra (60 pdxn)"

WORK TYPES:
- maintenance (most common)
- installation/planting
- design/consultation
- pruning
- weeding
- cleanup

CRITICAL DATE PARSING RULES:
- The current year is 2025 (Pacific Time zone)
- For partial dates like "6/3", "5/13", "2/24", etc., ALWAYS assume the year 2025
- All dates should be interpreted as Pacific Time (US West Coast)
- Convert all dates to YYYY-MM-DD format using 2025 as the year unless explicitly specified otherwise
- Examples: "6/3" becomes "2025-06-03", "12/15" becomes "2025-12-15"

For each work activity found, extract:
1. Date (convert formats like "6/3", "5/13" to YYYY-MM-DD, assume 2025 as current year if not specified)
2. Client name
3. Employees involved (convert codes to full names: V=Virginia, R=Rebecca, A=Anne, M=Megan, me/Me=Andrea Wilson)
4. Start/end times if available
5. Total hours worked (calculate from times or extract from context)
6. Work type (categorize the main type of work)
7. Detailed tasks performed (bullet points of work done)
8. Notes (any client conversations, follow-ups, or observations)
9. Charges (materials, debris bags, plants, etc.)
10. Drive time if mentioned
11. Confidence score (0-1) based on how clear the parsing was

Return JSON in this exact format:
{
  "activities": [
    {
      "date": "2025-06-03",
      "clientName": "Stoller",
      "employees": ["Virginia"],
      "startTime": "08:45",
      "endTime": "15:10",
      "totalHours": 6.42,
      "workType": "maintenance",
      "tasks": [
        "Misc clean up/weeds",
        "Deadhead brunnera",
        "Deadhead / weeds / bulb clean up on east slope"
      ],
      "notes": "Stayed solo extra 15 min for design work. Take photos for design drawing + brainstorm ideas",
      "charges": [],
      "driveTime": 44,
      "lunchTime": 85,
      "confidence": 0.9
    }
  ],
  "unparsedSections": ["Any text sections that couldn't be parsed into activities"],
  "warnings": ["Any parsing concerns or ambiguities"]
}

CRITICAL: Return ONLY valid JSON. No trailing commas, no unescaped quotes, no extra text before or after the JSON.

WORK NOTES TO PARSE:
${workNotesText}`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      if (response.content && response.content.length > 0) {
        const content = response.content[0];
        if (content && content.type === 'text') {
          // Extract JSON from the response
          const jsonMatch = content.text.match(/\{[\s\S]*?\}/);
          if (jsonMatch) {
            try {
              const result = JSON.parse(jsonMatch[0]) as WorkNotesParseResult;
              return result;
            } catch (parseError) {
              console.error('❌ JSON parsing failed:', parseError);
              console.error('📄 Raw JSON string (first 1000 chars):', jsonMatch[0].substring(0, 1000));
              
              // Check if response was truncated
              const wasTruncated = response.usage?.output_tokens === 8000;
              if (wasTruncated) {
                console.warn('⚠️ Response may have been truncated due to token limit');
              }
              
              // Try to fix common JSON issues
              let fixedJson = jsonMatch[0];
              
              // Fix trailing commas in arrays and objects
              fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');
              
              // Fix unescaped quotes in strings
              fixedJson = fixedJson.replace(/([^\\])"([^",:}\]]*)"([^,:}\]\s])/g, '$1\\"$2\\"$3');
              
              // If JSON appears truncated, try to close it properly
              if (wasTruncated || !fixedJson.trim().endsWith('}')) {
                console.log('🔧 Attempting to fix truncated JSON...');
                
                // Count open braces and brackets to try to close them
                let openBraces = 0;
                let openBrackets = 0;
                let inString = false;
                let escaped = false;
                
                for (let i = 0; i < fixedJson.length; i++) {
                  const char = fixedJson[i];
                  
                  if (escaped) {
                    escaped = false;
                    continue;
                  }
                  
                  if (char === '\\') {
                    escaped = true;
                    continue;
                  }
                  
                  if (char === '"') {
                    inString = !inString;
                    continue;
                  }
                  
                  if (!inString) {
                    if (char === '{') openBraces++;
                    else if (char === '}') openBraces--;
                    else if (char === '[') openBrackets++;
                    else if (char === ']') openBrackets--;
                  }
                }
                
                // Close any unclosed brackets and braces
                while (openBrackets > 0) {
                  fixedJson += ']';
                  openBrackets--;
                }
                while (openBraces > 0) {
                  fixedJson += '}';
                  openBraces--;
                }
                
                console.log(`🔧 Added ${openBrackets} closing brackets and ${openBraces} closing braces`);
              }
              
              try {
                const result = JSON.parse(fixedJson) as WorkNotesParseResult;
                console.log('✅ Fixed JSON parsing succeeded');
                if (wasTruncated) {
                  result.warnings = result.warnings || [];
                  result.warnings.push('Response was truncated due to length. Some activities may be incomplete.');
                }
                return result;
              } catch (secondParseError) {
                console.error('❌ Second JSON parsing attempt failed:', secondParseError);
                console.error('📄 Fixed JSON string (first 1000 chars):', fixedJson.substring(0, 1000));
                
                // Return a fallback result
                return {
                  activities: [],
                  unparsedSections: [content.text],
                  warnings: [
                    'Failed to parse AI response as JSON. Raw response saved in unparsed sections.',
                    wasTruncated ? 'Response was truncated due to length limits.' : ''
                  ].filter(Boolean)
                };
              }
            }
          }
        }
      }

      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error parsing work notes:', error);
      throw new Error('Failed to parse work notes with AI');
    }
  }

  /**
   * Parse free-form work notes from PDF file into structured work activities
   */
  async parseWorkNotesFromPDF(pdfBuffer: Buffer, filename: string): Promise<WorkNotesParseResult> {
    if (!this.client) {
      throw new Error('Anthropic client not initialized');
    }

    const prompt = `You are an expert at parsing landscaping work logs into structured data. 

Parse the following work notes from a PDF document and extract individual work activities. Each activity should represent work done for a specific client on a specific date.

IMPORTANT PATTERNS TO RECOGNIZE:

TIME FORMATS:
- "8:45-3:10 w V inc 22x2 min drive" = start 8:45, end 3:10, with Virginia, including 44min drive
- "on site 9/9:25-11:45 inc lil break, add .5 drive" = on site 9:00-9:25 to 11:45, add 30min drive
- "R 8:30-4:15, Me 9:40-5" = Rebecca 8:30-4:15, Me 9:40-5:00

EMPLOYEE CODES:
- "w V" = with Virginia
- "w R" = with Rebecca  
- "w A" = with Anne
- "w M" = with Megan
- "solo" = solo work (Andrea Wilson working alone)
- "me" or "Me" = Andrea Wilson (the business owner)

BUSINESS CONTEXT:
- Andrea Wilson is the business owner of this landscaping company
- When notes mention "me", "Me", or "I", this refers to Andrea Wilson
- Andrea often works alongside her employees or solo on client sites

CLIENT NAMES:
- Direct client names like "Stoller", "Nadler", "Kurzweil", "Silver", etc.

CHARGES:
- "charge 1 debris bag" 
- "Charge: Sluggo, fert, 2-3 bags debris, 3 aspidistra (60 pdxn)"

WORK TYPES:
- maintenance (most common)
- installation/planting
- design/consultation
- pruning
- weeding
- cleanup

CRITICAL DATE PARSING RULES:
- The current year is 2025 (Pacific Time zone)
- For partial dates like "6/3", "5/13", "2/24", etc., ALWAYS assume the year 2025
- All dates should be interpreted as Pacific Time (US West Coast)
- Convert all dates to YYYY-MM-DD format using 2025 as the year unless explicitly specified otherwise
- Examples: "6/3" becomes "2025-06-03", "12/15" becomes "2025-12-15"

For each work activity found, extract:
1. Date (convert formats like "6/3", "5/13" to YYYY-MM-DD, assume 2025 as current year if not specified)
2. Client name
3. Employees involved (convert codes to full names: V=Virginia, R=Rebecca, A=Anne, M=Megan, me/Me=Andrea Wilson)
4. Start/end times if available
5. Total hours worked (calculate from times or extract from context)
6. Work type (categorize the main type of work)
7. Detailed tasks performed (bullet points of work done)
8. Notes (any client conversations, follow-ups, or observations)
9. Charges (materials, debris bags, plants, etc.)
10. Drive time if mentioned
11. Confidence score (0-1) based on how clear the parsing was

Return JSON in this exact format:
{
  "activities": [
    {
      "date": "2025-06-03",
      "clientName": "Stoller",
      "employees": ["Virginia"],
      "startTime": "08:45",
      "endTime": "15:10",
      "totalHours": 6.42,
      "workType": "maintenance",
      "tasks": [
        "Misc clean up/weeds",
        "Deadhead brunnera",
        "Deadhead / weeds / bulb clean up on east slope"
      ],
      "notes": "Stayed solo extra 15 min for design work. Take photos for design drawing + brainstorm ideas",
      "charges": [],
      "driveTime": 44,
      "lunchTime": 85,
      "confidence": 0.9
    }
  ],
  "unparsedSections": ["Any text sections that couldn't be parsed into activities"],
  "warnings": ["Any parsing concerns or ambiguities"]
}

CRITICAL: Return ONLY valid JSON. No trailing commas, no unescaped quotes, no extra text before or after the JSON.

Please analyze the PDF document and extract all work activities following these patterns.`;

    try {
      // Convert PDF buffer to base64
      const base64Pdf = pdfBuffer.toString('base64');

      console.log(`📄 Sending PDF to Claude for parsing (${base64Pdf.length} chars base64)...`);

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64Pdf
                }
              }
            ]
          }
        ]
      });

      console.log(`📊 Claude response: ${response.usage?.input_tokens} input tokens, ${response.usage?.output_tokens} output tokens`);

      if (response.content && response.content.length > 0) {
        const content = response.content[0];
        if (content && content.type === 'text') {
          console.log(`📝 Raw response length: ${content.text.length} characters`);
          console.log(`📝 Response preview: ${content.text.substring(0, 200)}...`);
          
          // Extract JSON from the response
          const jsonMatch = content.text.match(/\{[\s\S]*?\}/);
          if (jsonMatch) {
            console.log(`🔍 Found JSON block: ${jsonMatch[0].length} characters`);
            try {
              const result = JSON.parse(jsonMatch[0]) as WorkNotesParseResult;
              console.log(`✅ Successfully parsed ${result.activities.length} activities`);
              return result;
            } catch (parseError) {
              console.error('❌ JSON parsing failed:', parseError);
              console.error('📄 Raw JSON string (first 1000 chars):', jsonMatch[0].substring(0, 1000));
              
              // Check if response was truncated
              const wasTruncated = response.usage?.output_tokens === 8000;
              if (wasTruncated) {
                console.warn('⚠️ Response may have been truncated due to token limit');
              }
              
              // Try to fix common JSON issues
              let fixedJson = jsonMatch[0];
              
              // Fix trailing commas in arrays and objects
              fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');
              
              // Fix unescaped quotes in strings
              fixedJson = fixedJson.replace(/([^\\])"([^",:}\]]*)"([^,:}\]\s])/g, '$1\\"$2\\"$3');
              
              // If JSON appears truncated, try to close it properly
              if (wasTruncated || !fixedJson.trim().endsWith('}')) {
                console.log('🔧 Attempting to fix truncated JSON...');
                
                // Count open braces and brackets to try to close them
                let openBraces = 0;
                let openBrackets = 0;
                let inString = false;
                let escaped = false;
                
                for (let i = 0; i < fixedJson.length; i++) {
                  const char = fixedJson[i];
                  
                  if (escaped) {
                    escaped = false;
                    continue;
                  }
                  
                  if (char === '\\') {
                    escaped = true;
                    continue;
                  }
                  
                  if (char === '"') {
                    inString = !inString;
                    continue;
                  }
                  
                  if (!inString) {
                    if (char === '{') openBraces++;
                    else if (char === '}') openBraces--;
                    else if (char === '[') openBrackets++;
                    else if (char === ']') openBrackets--;
                  }
                }
                
                // Close any unclosed brackets and braces
                while (openBrackets > 0) {
                  fixedJson += ']';
                  openBrackets--;
                }
                while (openBraces > 0) {
                  fixedJson += '}';
                  openBraces--;
                }
                
                console.log(`🔧 Added ${openBrackets} closing brackets and ${openBraces} closing braces`);
              }
              
              try {
                const result = JSON.parse(fixedJson) as WorkNotesParseResult;
                console.log('✅ Fixed JSON parsing succeeded');
                if (wasTruncated) {
                  result.warnings = result.warnings || [];
                  result.warnings.push('Response was truncated due to length. Some activities may be incomplete.');
                }
                return result;
              } catch (secondParseError) {
                console.error('❌ Second JSON parsing attempt failed:', secondParseError);
                console.error('📄 Fixed JSON string (first 1000 chars):', fixedJson.substring(0, 1000));
                
                // Return a fallback result
                return {
                  activities: [],
                  unparsedSections: [content.text],
                  warnings: [
                    'Failed to parse AI response as JSON. Raw response saved in unparsed sections.',
                    wasTruncated ? 'Response was truncated due to length limits.' : ''
                  ].filter(Boolean)
                };
              }
            }
          } else {
            console.error('❌ No JSON block found in response');
            console.error('📄 Full response:', content.text);
          }
        }
      }

      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error parsing work notes from PDF:', error);
      throw new Error('Failed to parse work notes from PDF with AI');
    }
  }

  /**
   * Parse historical work data from Google Sheets
   */
  async parseHistoricalSheetData(
    clientName: string,
    headers: string[],
    dataRows: Array<{ cells: string[]; isEmpty: boolean }>,
    formatHints?: string,
    options?: {
      batchSize?: number;
      maxBatches?: number;
      startBatch?: number;
      onBatchComplete?: (batchIndex: number, activities: ParsedWorkActivity[], totalBatches: number) => Promise<boolean>;
      onProgress?: (message: string) => void;
    }
  ): Promise<ParsedWorkActivity[]> {
    if (!this.client) {
      throw new Error('Anthropic API client not initialized');
    }

    try {
      const { batchSize = 8, maxBatches, startBatch = 1, onBatchComplete, onProgress } = options || {};
      
      onProgress?.(`🤖 Starting batch parsing for ${clientName}...`);
      
      // Convert spreadsheet data to natural text format
      const naturalTextEntries = this.convertToNaturalTextEntries(headers, dataRows);
      
      onProgress?.(`📄 Converted ${dataRows.length} spreadsheet rows to ${naturalTextEntries.length} work entries`);
      onProgress?.(`📏 Sample entry: ${naturalTextEntries[0]?.substring(0, 100)}...`);
      
      // Split into batches
      const allBatches: string[][] = [];
      for (let i = 0; i < naturalTextEntries.length; i += batchSize) {
        allBatches.push(naturalTextEntries.slice(i, i + batchSize));
      }
      
      // Apply batch range filtering
      const startIndex = Math.max(0, startBatch - 1);
      const endIndex = maxBatches ? Math.min(allBatches.length, startIndex + maxBatches) : allBatches.length;
      const batches = allBatches.slice(startIndex, endIndex);
      
      onProgress?.(`📦 Split into ${allBatches.length} total batches, processing batches ${startIndex + 1}-${endIndex} (${batches.length} batches)`);
      
      let allActivities: ParsedWorkActivity[] = [];
      
      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchText = batch.join('\n\n');
        
        const absoluteBatchNumber = startIndex + batchIndex + 1;
        onProgress?.(`\n🔄 Processing batch ${absoluteBatchNumber}/${allBatches.length} (${batch.length} entries)...`);
        
        try {
          const batchActivities = await this.parseNaturalHistoricalTextBatch(
            clientName, 
            batchText, 
            formatHints,
            batchIndex + 1,
            batches.length
          );
          
          onProgress?.(`✅ Batch ${batchIndex + 1} complete: Found ${batchActivities.length} activities`);
          
          // Show sample activities from this batch
          if (batchActivities.length > 0) {
            onProgress?.(`📋 Sample activity: ${batchActivities[0].date} - ${batchActivities[0].tasks.slice(0, 2).join(', ')}`);
          }
          
          allActivities.push(...batchActivities);
          
          // Ask for confirmation if callback provided
          if (onBatchComplete) {
            const shouldContinue = await onBatchComplete(batchIndex, batchActivities, batches.length);
            if (!shouldContinue) {
              onProgress?.(`⏹️  Parsing stopped by user after batch ${batchIndex + 1}`);
              break;
            }
          }
          
        } catch (error) {
          onProgress?.(`❌ Batch ${batchIndex + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          
          // Ask if we should continue despite the error
          if (onBatchComplete) {
            const shouldContinue = await onBatchComplete(batchIndex, [], batches.length);
            if (!shouldContinue) {
              onProgress?.(`⏹️  Parsing stopped after batch error`);
              break;
            }
          }
        }
      }
      
      onProgress?.(`\n🎉 Parsing complete! Found ${allActivities.length} total activities from ${clientName}`);
      return allActivities;

    } catch (error) {
      console.error('Error parsing historical sheet data:', error);
      throw error;
    }
  }

  /**
   * Convert spreadsheet rows to individual natural text entries
   */
  private convertToNaturalTextEntries(
    headers: string[], 
    dataRows: Array<{ cells: string[]; isEmpty: boolean }>
  ): string[] {
    const entries: string[] = [];
    
    // Find date column index
    const dateColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('date') || h.toLowerCase() === 'd'
    );
    
    // Common date pattern
    const datePattern = /^(\d{1,2}\/\d{1,2})(\s|$)/;
    
    let currentEntry: string[] = [];
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (row.isEmpty) continue;
      
      const firstCell = row.cells[0]?.trim() || '';
      let isNewDate = false;
      
      // Check if this row starts with a date
      if (datePattern.test(firstCell)) {
        const match = firstCell.match(/^(\d{1,2})\/(\d{1,2})/);
        if (match) {
          const month = parseInt(match[1]);
          const day = parseInt(match[2]);
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            isNewDate = true;
          }
        }
      }
      
      // If we found a new date, save previous entry and start new one
      if (isNewDate && currentEntry.length > 0) {
        entries.push(currentEntry.join(' '));
        currentEntry = [];
      }
      
      // Build natural text for this row
      const rowText = this.buildRowText(headers, row.cells);
      if (rowText.trim()) {
        currentEntry.push(rowText);
      }
    }
    
    // Don't forget the last entry
    if (currentEntry.length > 0) {
      entries.push(currentEntry.join(' '));
    }
    
    return entries;
  }

  /**
   * Build natural text for a single row
   */
  private buildRowText(headers: string[], cells: string[]): string {
    const parts: string[] = [];
    
    for (let i = 0; i < headers.length && i < cells.length; i++) {
      const header = headers[i].toLowerCase();
      const value = cells[i]?.trim();
      
      if (!value) continue;
      
      // Format based on column type
      if (header.includes('date') || header === 'd') {
        parts.push(value);
      } else if (header.includes('hrs') || header.includes('hours')) {
        parts.push(`${value} hours`);
      } else if (header.includes('start')) {
        parts.push(`Start: ${value}`);
      } else if (header.includes('end')) {
        parts.push(`End: ${value}`);
      } else if (header.includes('task') || header.includes('work') || header.includes('note')) {
        parts.push(value);
      } else if (header.includes('crew') || header.includes('emp')) {
        parts.push(`w ${value}`);
      } else if (header.includes('plant') || header.includes('charge') || header.includes('cost')) {
        parts.push(value);
      } else {
        // Generic formatting
        parts.push(value);
      }
    }
    
    return parts.join(', ');
  }

  /**
   * Parse a single batch of natural text entries
   */
  private async parseNaturalHistoricalTextBatch(
    clientName: string, 
    batchText: string, 
    formatHints?: string,
    batchNumber?: number,
    totalBatches?: number
  ): Promise<ParsedWorkActivity[]> {
    if (!this.client) {
      throw new Error('Anthropic API client not initialized');
    }
    
    const currentYear = new Date().getFullYear();
    const systemPrompt = `You are an expert at parsing landscaping work records. You excel at extracting structured work activities from natural text descriptions.

Your task is to parse historical work data and return ALL activities found as a JSON array. This is batch ${batchNumber || 1} of ${totalBatches || 1}.

Key patterns to recognize:
- Employee codes: "w R" = with Rebecca, "w M" = with Megan, "w V" = with Virginia, "w A" = with Anne, "solo" or no crew mention = Andrea alone
- Date formats: "5/21", "4/23" (M/D format) - IMPORTANT: For dates without year, assume ${currentYear} unless the month is far in the future (then use ${currentYear - 1})
- Task markers: [x] = completed, [-] or [ ] = pending
- Plant/material charges: Look for plant names, costs, vendor references
- Time: Start/End times or total hours
- Continuation entries: Text that continues previous dated work

Return complete, detailed work activities with high confidence scores.`;

    const userPrompt = `Parse this batch of historical work data for "${clientName}". 

${formatHints ? `Format notes: ${formatHints}\n\n` : ''}

Work data entries to parse:

${batchText}

Extract ALL work activities from this batch. For each activity, return this exact JSON structure:
{
  "date": "YYYY-MM-DD",
  "clientName": "${clientName}",
  "employees": ["full name"],
  "startTime": "HH:MM AM/PM" (if available),
  "endTime": "HH:MM AM/PM" (if available), 
  "totalHours": 0.0,
  "workType": "maintenance",
  "tasks": ["detailed task descriptions"],
  "notes": "additional context",
  "charges": [
    {
      "description": "item description",
      "type": "material",
      "cost": 0.0
    }
  ],
  "driveTime": 0,
  "lunchTime": 0,
  "confidence": 0.9
}

CRITICAL DATE FORMATTING: 
- For dates like "5/21" or "4/23", convert to "${currentYear}-05-21" or "${currentYear}-04-23" format
- Only use ${currentYear - 1} if the month seems far in the future relative to current date
- Always return dates in YYYY-MM-DD format with proper zero-padding

CRITICAL: Return ONLY a valid JSON array starting with [ and ending with ]. Extract ALL activities from this batch - do not truncate.`;

    console.log(`🤖 Calling Claude Sonnet 4 for batch ${batchNumber}...`);
    
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000, // Smaller batches = less tokens needed
      temperature: 0.1,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    // Extract and parse the JSON response
    const textContent = response.content.find((c: any) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    const responseText = (textContent as any).text;
    console.log(`📝 Claude batch ${batchNumber} response: ${responseText.length} characters`);
    
    // Extract JSON from response
    let activities: ParsedWorkActivity[] = [];
    
    try {
      // Look for JSON array in the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        activities = JSON.parse(jsonMatch[0]);
        console.log(`✅ Batch ${batchNumber}: Successfully parsed ${activities.length} activities`);
      } else {
        // Try to extract from code blocks
        const codeBlockMatch = responseText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
        if (codeBlockMatch) {
          activities = JSON.parse(codeBlockMatch[1]);
          console.log(`✅ Batch ${batchNumber}: Parsed ${activities.length} activities from code block`);
                  } else {
            console.error(`❌ Batch ${batchNumber}: No JSON found in response:`, responseText.substring(0, 500));
            throw new Error('No JSON array found in response');
          }
        }
      } catch (parseError) {
        console.error(`❌ Batch ${batchNumber}: Failed to parse JSON:`, parseError);
        console.log('Response text (first 500 chars):', responseText.substring(0, 500));
        throw new Error(`Failed to parse activities from batch ${batchNumber}`);
      }

      // Validate and normalize the activities
      activities = activities.map((activity: any) => ({
        ...activity,
        clientName: clientName,
        date: this.normalizeDate(activity.date || ''),
        employees: this.normalizeEmployeeNames(activity.employees || []),
        totalHours: parseFloat(activity.totalHours?.toString() || '0') || 0,
        driveTime: activity.driveTime ? parseInt(activity.driveTime.toString()) : undefined,
        lunchTime: activity.lunchTime ? parseInt(activity.lunchTime.toString()) : undefined,
        confidence: activity.confidence || 0.8,
        charges: Array.isArray(activity.charges) ? activity.charges : [],
        tasks: Array.isArray(activity.tasks) ? activity.tasks : (activity.tasks ? [activity.tasks] : [])
      }));

      return activities;
    }

    /**
     * Normalize date string to YYYY-MM-DD format
     */
    private normalizeDate(dateStr: string): string {
      if (!dateStr) return '';
      
      // Already in correct format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
      }
      
      // Try to parse various date formats
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
      
      // Handle M/D format (assume current year unless month is in future)
      const mdMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})$/);
      if (mdMatch) {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        
        const month = parseInt(mdMatch[1]);
        const day = parseInt(mdMatch[2]);
        
        // Use current year by default
        // Only use previous year if the month is significantly in the future
        // (more than 3 months ahead, which likely indicates it's from last year)
        let year = currentYear;
        if (month > currentMonth + 3) {
          year = currentYear - 1;
        }
        
        const monthStr = month.toString().padStart(2, '0');
        const dayStr = day.toString().padStart(2, '0');
        return `${year}-${monthStr}-${dayStr}`;
      }
      
      return dateStr; // Return as-is if can't parse
    }

    /**
     * Normalize employee names from abbreviations
     */
    private normalizeEmployeeNames(employees: string[]): string[] {
      const nameMap: Record<string, string> = {
        'R': 'Rebecca',
        'M': 'Megan',
        'V': 'Virginia',
        'A': 'Anne',
        'Andrea': 'Andrea',
        'solo': 'Andrea',
        'me': 'Andrea'
      };
      
      return employees.map(emp => {
        const trimmed = emp.trim();
        return nameMap[trimmed] || trimmed;
      });
    }
  }