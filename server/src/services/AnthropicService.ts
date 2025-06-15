import Anthropic from '@anthropic-ai/sdk';
import { SchedulingContext, SchedulingResponse } from '../types';

export class AnthropicService {
  private client: Anthropic | null = null;
  private schedulingService: any = null; // Will be injected to avoid circular dependency
  private useCondensedPrompt: boolean = true; // Flag to control prompt type

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      console.log('🤖 AnthropicService initialized with API key');
      console.log(`🔧 Using ${this.useCondensedPrompt ? 'CONDENSED' : 'FULL'} system prompts to avoid rate limits`);
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

  // Method to toggle prompt type
  setPromptType(useCondensed: boolean) {
    this.useCondensedPrompt = useCondensed;
    console.log(`🔧 Switched to ${useCondensed ? 'CONDENSED' : 'FULL'} system prompts`);
  }

  // Temporary method to test with full prompt
  async getSchedulingRecommendationWithFullPrompt(query: string, context: SchedulingContext): Promise<SchedulingResponse> {
    const originalSetting = this.useCondensedPrompt;
    this.useCondensedPrompt = false;
    console.log('🔄 Temporarily using FULL prompt for this request');
    
    try {
      const result = await this.getSchedulingRecommendation(query, context);
      return result;
    } finally {
      this.useCondensedPrompt = originalSetting;
      console.log(`🔄 Restored to ${originalSetting ? 'CONDENSED' : 'FULL'} prompt setting`);
    }
  }

  async getSchedulingRecommendation(
    query: string, 
    context: SchedulingContext
  ): Promise<SchedulingResponse> {
    const startTime = Date.now();
    console.log('\n🚀 === ANTHROPIC API CALL START ===');
    console.log(`📝 Query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
    console.log(`📊 Context size: ${JSON.stringify(context).length} characters`);

    if (!this.client) {
      const error = new Error('Anthropic API client not initialized. Please check your ANTHROPIC_API_KEY environment variable.');
      console.error('❌ API client not available:', error.message);
      throw error;
    }

    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const fullSystemPrompt = this.buildFullSystemPrompt(context);
      const tools = this.getSchedulingTools();
      
      console.log(`📋 System prompt length: ${systemPrompt.length} characters (${this.useCondensedPrompt ? 'condensed' : 'full'})`);
      if (this.useCondensedPrompt) {
        console.log(`📋 Full prompt would be: ${fullSystemPrompt.length} characters`);
        console.log(`💾 Token savings: ~${Math.round((fullSystemPrompt.length - systemPrompt.length) / 4)} tokens (~${Math.round(((fullSystemPrompt.length - systemPrompt.length) / fullSystemPrompt.length) * 100)}% reduction)`);
      }
      console.log(`🛠️ Available tools: ${tools.map(t => t.name).join(', ')}`);
      
      const requestPayload = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        temperature: 0.3,
        system: systemPrompt,
        tools: tools,
        messages: [
          {
            role: 'user' as const,
            content: query
          }
        ]
      };

      console.log(`🎯 Request details:`, {
        model: requestPayload.model,
        max_tokens: requestPayload.max_tokens,
        temperature: requestPayload.temperature,
        system_prompt_length: systemPrompt.length,
        tools_count: tools.length,
        message_length: query.length,
        estimated_input_tokens: Math.round(systemPrompt.length / 4) + Math.round(query.length / 4)
      });

      const message = await this.client.messages.create(requestPayload);

      const apiCallTime = Date.now() - startTime;
      console.log(`⏱️ Initial API call completed in ${apiCallTime}ms`);
      console.log(`📈 Usage:`, {
        input_tokens: message.usage?.input_tokens || 'unknown',
        output_tokens: message.usage?.output_tokens || 'unknown',
        total_tokens: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)
      });

      // Handle tool calls if present
      const toolUseContent = message.content.filter(content => content.type === 'tool_use');
      if (toolUseContent.length > 0) {
        console.log(`🔧 Tool calls detected: ${toolUseContent.length} tools to execute`);
        toolUseContent.forEach((tool: any, index) => {
          console.log(`  ${index + 1}. ${tool.name}(${JSON.stringify(tool.input).substring(0, 100)}${JSON.stringify(tool.input).length > 100 ? '...' : ''})`);
        });
        
        const result = await this.handleToolCalls(message, query, context);
        const totalTime = Date.now() - startTime;
        console.log(`✅ === ANTHROPIC API CALL COMPLETE (with tools) === Total time: ${totalTime}ms\n`);
        return result;
      }

      // Regular text response
      const response = message.content[0];
      if (response.type === 'text') {
        console.log(`💬 Text response length: ${response.text.length} characters`);
        console.log(`📝 Response preview: "${response.text.substring(0, 150)}${response.text.length > 150 ? '...' : ''}"`);
        
        const totalTime = Date.now() - startTime;
        console.log(`✅ === ANTHROPIC API CALL COMPLETE === Total time: ${totalTime}ms\n`);
        
        // Check if the response looks incomplete (ends with a colon or seems to be asking for more data)
        if (response.text.trim().endsWith(':') || 
            response.text.includes('let me check') || 
            response.text.includes('Now let me') ||
            response.text.includes('Let me also') ||
            response.text.includes('I should also') ||
            response.text.includes('Next, I') ||
            response.text.includes('maintenance scheduling issues') ||
            response.text.includes('client details and maintenance') ||
            (response.text.length < 200 && response.text.includes('maintenance'))) {
          console.log(`⚠️ Response appears incomplete - likely needs more tool calls`);
          console.log(`📝 Incomplete response: "${response.text}"`);
          
          // For regular text responses, we can't easily continue the conversation
          // So provide a helpful fallback response
          return {
            response: `I started analyzing your schedule but my response was cut short. This often happens with complex queries that need multiple data sources.

Please try asking a more focused question like:
• "What maintenance clients are overdue this week?"
• "Show me conflicts in my schedule for next Monday"  
• "Which helpers are available on Friday?"

Or try rephrasing your question to be more specific about what you'd like me to analyze.`,
            reasoning: 'Response was incomplete - suggesting more specific queries',
            suggestions: []
          };
        }
        
        return {
          response: response.text,
          reasoning: 'AI analysis using Claude 3.5 Sonnet v2 with enhanced scheduling intelligence',
          suggestions: []
        };
      }

      // If we get here, the response format was unexpected
      const error = new Error('Unexpected response format from Anthropic API');
      console.error('❌ Unexpected response format:', message.content);
      throw error;
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ === ANTHROPIC API CALL FAILED === Time: ${totalTime}ms`);
      console.error('🔥 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3).join('\n') : undefined
      });
      
      if (error instanceof Error && 'status' in error) {
        console.error('🌐 HTTP Status:', (error as any).status);
        if ((error as any).status === 429) {
          console.error('⚠️ RATE LIMIT HIT - Consider further reducing prompt size or implementing request queuing');
          const rateLimitError = new Error('Rate limit exceeded. Please try again later or contact support if this persists.');
          rateLimitError.name = 'RateLimitError';
          throw rateLimitError;
        }
      }
      
      // Re-throw the original error instead of falling back to mock
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

  private async handleToolCalls(message: any, originalQuery: string, context: SchedulingContext): Promise<SchedulingResponse> {
    const toolStartTime = Date.now();
    console.log('🔧 === TOOL EXECUTION PHASE START ===');
    
    let currentMessage = message;
    let conversationHistory: Array<{
      role: 'user' | 'assistant';
      content: any;
    }> = [
      {
        role: 'user' as const,
        content: originalQuery
      },
      {
        role: 'assistant' as const,
        content: message.content
      }
    ];
    
    let toolCallRound = 1;
    const maxToolRounds = 5; // Prevent infinite loops
    
    while (toolCallRound <= maxToolRounds) {
      // Check if current message has tool calls
      const toolUseContent = currentMessage.content.filter((content: any) => content.type === 'tool_use');
      
      console.log(`🔍 Round ${toolCallRound} - Message content types:`, currentMessage.content.map((c: any) => c.type));
      console.log(`🔍 Round ${toolCallRound} - Found ${toolUseContent.length} tool_use items`);
      
      // Handle empty content array from API
      if (!currentMessage.content || currentMessage.content.length === 0) {
        console.log(`⚠️ Round ${toolCallRound} - Received empty content from API`);
        console.log(`📊 Token usage in previous call may have caused truncation`);
        
        // Return a helpful response explaining the issue
        return {
          response: `I started analyzing your schedule but encountered an issue with the AI response. This sometimes happens with complex queries that require multiple data lookups. 

Please try asking a more focused question like:
• "What maintenance clients are overdue this week?"
• "Show me conflicts in my schedule for next Monday"
• "Which helpers are available on Friday?"

This will help me provide a complete analysis without running into processing limits.`,
          reasoning: 'Empty response received from AI - likely due to token limits or context size',
          suggestions: []
        };
      }
      
      if (toolUseContent.length === 0) {
        // No more tool calls, we have the final response
        const response = currentMessage.content.find((content: any) => content.type === 'text');
        if (response && response.type === 'text') {
          const textResponse = response as any; // Cast to access text property
          const totalTime = Date.now() - toolStartTime;
          console.log(`💬 Final response after ${toolCallRound - 1} tool rounds (${totalTime}ms): ${textResponse.text.length} characters`);
          console.log(`📝 Final response preview: "${textResponse.text.substring(0, 150)}${textResponse.text.length > 150 ? '...' : ''}"`);
          
          // Check if the response looks incomplete (ends with a colon or seems to be asking for more data)
          if (textResponse.text.trim().endsWith(':') || 
              textResponse.text.includes('let me check') || 
              textResponse.text.includes('Now let me') ||
              textResponse.text.includes('Let me also') ||
              textResponse.text.includes('I should also') ||
              textResponse.text.includes('Next, I') ||
              textResponse.text.includes('maintenance scheduling issues') ||
              textResponse.text.includes('client details and maintenance') ||
              (textResponse.text.length < 200 && textResponse.text.includes('maintenance'))) {
            console.log(`⚠️ Response appears incomplete - likely needs more tool calls`);
            console.log(`📝 Incomplete response: "${textResponse.text}"`);
            
            // Check if this looks like the AI is about to make another tool call
            // If so, we should force continuation rather than giving up
            if (textResponse.text.includes('maintenance schedule') || 
                textResponse.text.includes('get the maintenance') ||
                textResponse.text.includes('Now let me get') ||
                textResponse.text.includes('maintenance scheduling issues') ||
                textResponse.text.includes('client details and maintenance') ||
                textResponse.text.includes('let me check')) {
              console.log(`🔄 Attempting to force tool continuation - looks like AI wants to call more tools`);
              
              // Add a more directive follow-up message
              conversationHistory.push({
                role: 'user' as const,
                content: 'COMPLETE YOUR ANALYSIS NOW. Do not narrate what you plan to do - execute the tools you need (get_client_info, get_maintenance_schedule, etc.) and provide your final comprehensive response.'
              });
              
              // Make another API call to continue
              try {
                const continuationStart = Date.now();
                const continuationMessage = await this.client!.messages.create({
                  model: 'claude-sonnet-4-20250514',
                  max_tokens: 2000,
                  temperature: 0.3,
                  system: this.buildSystemPrompt(context),
                  messages: conversationHistory
                });

                const continuationTime = Date.now() - continuationStart;
                console.log(`⏱️ Forced continuation API call completed in ${continuationTime}ms`);
                
                // Update current message for next iteration
                currentMessage = continuationMessage;
                
                // Add the continuation to conversation history
                conversationHistory.push({
                  role: 'assistant' as const,
                  content: continuationMessage.content
                });
                
                // Continue the loop to process any tool calls in the continuation
                continue;
              } catch (continuationError) {
                console.error('❌ Error in forced continuation call:', continuationError);
                // Fall through to the fallback response
              }
            }
            
            // Fallback response for other types of incomplete responses
            return {
              response: `I started analyzing your schedule but my response was cut short. Let me try a more direct approach - please ask me something more specific like:

• "What maintenance clients are overdue?"
• "Show me my schedule conflicts for next week"
• "Which helpers are available this Thursday?"

This will help me give you a complete analysis without getting interrupted.`,
              reasoning: 'Response was incomplete - suggesting more specific queries',
              suggestions: []
            };
          }
          
          return {
            response: textResponse.text,
            reasoning: `AI analysis with dynamic data access using ${toolCallRound - 1} rounds of function calling`,
            suggestions: []
          };
        }
        break;
      }
      
      console.log(`🔄 Tool call round ${toolCallRound}: ${toolUseContent.length} tools to execute`);
      
      // Execute all tool calls in this round
      const toolResults = [];
      
      for (const content of toolUseContent) {
        const toolExecStart = Date.now();
        console.log(`🛠️ Executing tool: ${content.name}`);
        console.log(`📥 Input: ${JSON.stringify(content.input, null, 2)}`);
        
        const toolResult = await this.executeToolCall(content.name, content.input);
        const toolExecTime = Date.now() - toolExecStart;
        
        // Summarize large results to prevent token overflow
        let processedResult = toolResult;
        const resultString = JSON.stringify(toolResult);
        
        if (resultString.length > 15000) {
          console.log(`📊 Large tool result (${resultString.length} chars) - creating summary`);
          
          if (content.name === 'get_calendar_events' && toolResult.events) {
            // Summarize calendar events for broad analysis
            const events = toolResult.events;
            const summary = {
              total_events: events.length,
              date_range: events.length > 0 ? {
                start: events[0].start,
                end: events[events.length - 1].start
              } : null,
              by_type: {} as { [key: string]: number },
              by_week: {} as { [key: string]: number },
              key_events: events.slice(0, 10), // First 10 events for detail
              maintenance_count: events.filter((e: any) => e.eventType === 'maintenance').length,
              office_work_count: events.filter((e: any) => e.eventType === 'office_work').length,
              client_visit_count: events.filter((e: any) => e.eventType === 'client_visit').length
            };
            
            // Group by week
            events.forEach((event: any) => {
              const week = new Date(event.start).toISOString().slice(0, 10); // YYYY-MM-DD
              if (!summary.by_week[week]) summary.by_week[week] = 0;
              summary.by_week[week]++;
            });
            
            processedResult = {
              summary: summary,
              note: `Showing summary of ${events.length} events to prevent token overflow. Key patterns and first 10 events included.`
            };
          }
        }
        
        console.log(`📤 Result (${toolExecTime}ms):`, JSON.stringify(processedResult, null, 2).substring(0, 300) + '...');
        
        toolResults.push({
          type: 'tool_result' as const,
          tool_use_id: content.id,
          content: JSON.stringify(processedResult)
        });
      }
      
      // Add tool results to conversation
      conversationHistory.push({
        role: 'user' as const,
        content: toolResults
      });
      
      console.log(`🔄 Making follow-up API call (round ${toolCallRound})...`);
      
      // Limit conversation history to prevent token overflow - be more aggressive with large tool results
      const toolResultSize = JSON.stringify(toolResults).length;
      const maxHistoryLength = toolResultSize > 10000 ? 4 : 8; // Fewer messages if large tool results
      
      const trimmedHistory = conversationHistory.length > maxHistoryLength 
        ? [
            conversationHistory[0], // Keep original user query
            ...conversationHistory.slice(-maxHistoryLength + 1) // Keep recent messages
          ]
        : conversationHistory;
      
      console.log(`📊 Tool results size: ${toolResultSize} chars, conversation history: ${conversationHistory.length} messages, using ${trimmedHistory.length} for API call`);
      
      // Continue conversation with tool results
      const followUpStart = Date.now();
      const followUpMessage = await this.client!.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        temperature: 0.3,
        system: this.buildSystemPrompt(context),
        messages: trimmedHistory
      });

      const followUpTime = Date.now() - followUpStart;
      console.log(`⏱️ Follow-up API call ${toolCallRound} completed in ${followUpTime}ms`);
      console.log(`📈 Follow-up usage:`, {
        input_tokens: followUpMessage.usage?.input_tokens || 'unknown',
        output_tokens: followUpMessage.usage?.output_tokens || 'unknown',
        total_tokens: (followUpMessage.usage?.input_tokens || 0) + (followUpMessage.usage?.output_tokens || 0)
      });
      console.log(`📋 Follow-up response content length:`, followUpMessage.content?.length || 0);
      console.log(`📋 Follow-up response content preview:`, JSON.stringify(followUpMessage.content).substring(0, 200) + '...');

      // Add AI response to conversation history
      conversationHistory.push({
        role: 'assistant' as const,
        content: followUpMessage.content
      });
      
      // Update current message for next iteration
      currentMessage = followUpMessage;
      toolCallRound++;
    }
    
    // If we get here, we hit the max rounds or something went wrong
    if (toolCallRound > maxToolRounds) {
      console.error(`❌ Hit maximum tool call rounds (${maxToolRounds})`);
      return {
        response: "I apologize, but I'm having trouble completing your request due to too many data lookups. Please try asking a more specific question.",
        reasoning: 'Tool call limit exceeded',
        suggestions: []
      };
    }

    // Fallback error
    const error = new Error('Unexpected response format from Anthropic API after tool execution');
    console.error('❌ Unexpected follow-up response format:', currentMessage.content);
    throw error;
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

  private buildSystemPrompt(context: SchedulingContext): string {
    // Use condensed prompt by default to avoid rate limits
    if (this.useCondensedPrompt) {
      return this.buildCondensedSystemPrompt(context);
    } else {
      return this.buildFullSystemPrompt(context);
    }
  }

  private buildCondensedSystemPrompt(context: SchedulingContext): string {
    try {
      // Add extensive null checks and logging
      console.log('🔍 Building condensed system prompt...');
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

      console.log('✅ Condensed system prompt built successfully');
      return prompt;
      
    } catch (error) {
      console.error('❌ Error in buildCondensedSystemPrompt:', error);
      return 'Error building system prompt. Using fallback.';
    }
  }

  private buildFullSystemPrompt(context: SchedulingContext): string {
    // Keep the original full prompt as backup
    const projectsSection = context.projects && context.projects.length > 0 
      ? `PROJECTS:
${JSON.stringify(context.projects, null, 2)}`
      : `PROJECTS:
No active projects currently in the system.`;

    const maintenanceSection = context.maintenanceSchedule 
      ? `MAINTENANCE SCHEDULE (Next 3 months):
${JSON.stringify(context.maintenanceSchedule, null, 2)}`
      : '';

    const availabilitySection = context.helperAvailability 
      ? `HELPER AVAILABILITY SUMMARY (Next 8 weeks):
${JSON.stringify(context.helperAvailability, null, 2)}`
      : '';

    const metricsSection = context.businessMetrics 
      ? `BUSINESS METRICS & WORKLOAD ANALYSIS:
${JSON.stringify(context.businessMetrics, null, 2)}`
      : '';

    return `You are Andrea's AI scheduling assistant for her landscaping business. You help optimize schedules considering geographic efficiency, helper capabilities, and client preferences.

**CRITICAL INSTRUCTION: Always complete your full analysis in one response. Never say "Now let me check..." or "Let me also..." - if you need multiple tools, use them all immediately. Provide complete recommendations, not partial analysis.**

CURRENT CONTEXT (Optimized for 1-2 Month Planning):

HELPERS (with notes):
${JSON.stringify(context.helpers, null, 2)}

CLIENTS:
${JSON.stringify(context.clients, null, 2)}

${projectsSection}

CALENDAR EVENTS (Next 60 days):
${JSON.stringify(context.calendarEvents, null, 2)}

${maintenanceSection}

${availabilitySection}

${metricsSection}

AVAILABLE TOOLS (for edge cases beyond the provided context):
You have access to several tools for specific deep-dive analysis:
- get_calendar_events: Get events for specific date ranges beyond 60 days
- check_helper_availability: Detailed day-by-day availability analysis
- get_maintenance_schedule: Extended maintenance planning beyond 3 months
- calculate_travel_time: Real-time travel calculations between locations
- find_scheduling_conflicts: Conflict detection for proposed schedules

Use these tools ONLY when you need information beyond what's provided in the rich context above.

BUSINESS RULES:
- Each helper needs 7-8 hours on their designated workdays
- Minimize travel time between client locations - group nearby clients together
- Consider helper capability requirements for different projects
- Emergency/urgent work takes priority over routine maintenance
- Maintenance work should be scheduled regularly according to client intervals
- Weather-sensitive work should consider forecasts
- Respect client preferences for days/times when possible

RESPONSE FORMAT:
1. Acknowledge the specific request
2. Analyze the rich context provided (60-day calendar, maintenance schedule, availability summaries)
3. Use tools only if you need information beyond the provided context
4. Provide specific, actionable scheduling recommendations with times and assignments
5. Explain the reasoning behind suggestions (travel efficiency, helper skills, client preferences)
6. Mention any trade-offs or alternative approaches
7. Ask clarifying questions if the request is ambiguous

**FORMATTING GUIDELINES:**
- Use markdown formatting for better readability
- Use headers (##, ###) to organize sections
- Use **bold** for important information like names, times, and key points
- Use bullet points and numbered lists for recommendations
- Use > blockquotes for important tips or warnings
- Use emojis sparingly but effectively (📅 🕐 ✅ ⚠️ 💡) to highlight key information
- Format times clearly (e.g., "8:00 AM - 12:00 PM")
- Use tables when comparing multiple options

Be practical, specific, and collaborative. Focus on solutions that Andrea can realistically implement.`;
  }

  // Public methods for debugging
  public getCondensedSystemPrompt(context: SchedulingContext): string {
    return this.buildCondensedSystemPrompt(context);
  }

  public getFullSystemPrompt(context: SchedulingContext): string {
    return this.buildFullSystemPrompt(context);
  }

  public getCurrentSystemPrompt(context: SchedulingContext): string {
    return this.buildSystemPrompt(context);
  }
} 