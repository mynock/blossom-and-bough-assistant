import Anthropic from '@anthropic-ai/sdk';
import { SchedulingContext, SchedulingResponse } from '../types';
import { debugLog } from '../utils/logger';

export class AnthropicService {
  private client: Anthropic | null = null;
  private schedulingService: any = null; // Will be injected to avoid circular dependency
  private useCondensedPrompt: boolean = true; // Flag to control prompt type
  private useNaturalMode: boolean = true; // Flag to enable natural Claude behavior

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

  // Method to toggle natural mode
  setNaturalMode(useNatural: boolean) {
    this.useNaturalMode = useNatural;
    console.log(`🧠 Switched to ${useNatural ? 'NATURAL' : 'MANAGED'} Claude behavior`);
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
    console.log(`🧠 Mode: ${this.useNaturalMode ? 'NATURAL' : 'MANAGED'}`);

    if (!this.client) {
      const error = new Error('Anthropic API client not initialized. Please check your ANTHROPIC_API_KEY environment variable.');
      console.error('❌ API client not available:', error.message);
      throw error;
    }

    // Use natural mode if enabled
    if (this.useNaturalMode) {
      return this.handleNaturalMode(query, context, startTime);
    }

    // Original managed mode (existing implementation)
    return this.handleManagedMode(query, context, startTime);
  }

  private async handleNaturalMode(
    query: string, 
    context: SchedulingContext, 
    startTime: number
  ): Promise<SchedulingResponse> {
    console.log('🧠 Using NATURAL mode - letting Claude work without interference');
    
    try {
      // Use full system prompt for natural mode - no condensing
      const systemPrompt = this.buildFullSystemPrompt(context);
      const tools = this.getSchedulingTools();
      
      console.log(`📋 System prompt: ${systemPrompt.length} characters (FULL)`);
      console.log(`🛠️ Available tools: ${tools.map(t => t.name).join(', ')}`);
      
      // Simple, clean conversation with Claude
      let messages: Array<{role: 'user' | 'assistant', content: any}> = [
        { role: 'user' as const, content: query }
      ];
      
      let currentMessage = await this.client!.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000, // Increased for comprehensive responses
        temperature: 0.3,
        system: systemPrompt,
        tools: tools,
        messages: messages
      });

      console.log(`⏱️ Initial response: ${Date.now() - startTime}ms`);
      console.log(`📈 Usage: ${currentMessage.usage?.input_tokens} in, ${currentMessage.usage?.output_tokens} out`);
      
      // Handle tool calls naturally - no interference
      let toolRound = 1;
      const maxRounds = 10; // Allow more rounds for complex analysis
      
      while (toolRound <= maxRounds) {
        const toolUseContent = currentMessage.content.filter((content: any) => content.type === 'tool_use');
        
        if (toolUseContent.length === 0) {
          // No more tools needed - Claude is done
          const textResponse = currentMessage.content.find((content: any) => content.type === 'text');
          if (textResponse && textResponse.type === 'text') {
            const totalTime = Date.now() - startTime;
            console.log(`✅ Natural mode complete: ${totalTime}ms, ${toolRound - 1} tool rounds`);
            console.log(`📝 Response: ${(textResponse as any).text.length} characters`);
            
            return {
              response: (textResponse as any).text,
              reasoning: `Natural Claude analysis with ${toolRound - 1} rounds of tool usage`,
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
          
          // NO SUMMARIZATION - give Claude the full data
          toolResults.push({
            type: 'tool_result' as const,
            tool_use_id: (toolUse as any).id,
            content: JSON.stringify(result)
          });
        }
        
        messages.push({ role: 'user' as const, content: toolResults });
        
        // Continue conversation - NO conversation trimming
        currentMessage = await this.client!.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          temperature: 0.3,
          system: systemPrompt, // Always use full prompt
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
          reasoning: `Natural Claude analysis (hit ${maxRounds} round limit)`,
          suggestions: []
        };
      }
      
      throw new Error('No text response found after tool execution');
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ Natural mode failed: ${totalTime}ms`);
      console.error('Error:', error);
      throw error;
    }
  }

  private async handleManagedMode(
    query: string, 
    context: SchedulingContext, 
    startTime: number
  ): Promise<SchedulingResponse> {
    console.log('🔧 Using MANAGED mode - original implementation with optimizations');
    
    // Preprocess broad queries to make them more specific
    const processedQuery = this.preprocessBroadQuery(query);
    if (processedQuery !== query) {
      console.log(`🔄 Preprocessed broad query: "${processedQuery}"`);
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
            content: processedQuery
          }
        ]
      };

      console.log(`🎯 Request details:`, {
        model: requestPayload.model,
        max_tokens: requestPayload.max_tokens,
        temperature: requestPayload.temperature,
        system_prompt_length: systemPrompt.length,
        tools_count: tools.length,
        message_length: processedQuery.length,
        estimated_input_tokens: Math.round(systemPrompt.length / 4) + Math.round(processedQuery.length / 4)
      });

      const message = await this.client!.messages.create(requestPayload);

      const apiCallTime = Date.now() - startTime;
      console.log(`⏱️ Initial API call completed in ${apiCallTime}ms`);
      console.log(`📈 Usage:`, {
        input_tokens: message.usage?.input_tokens || 'unknown',
        output_tokens: message.usage?.output_tokens || 'unknown',
        total_tokens: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)
      });

      // Add detailed analysis of the initial response
      console.log(`🔍 INITIAL RESPONSE ANALYSIS:`);
      console.log(`   - Model: ${message.model}`);
      console.log(`   - Stop reason: ${message.stop_reason}`);
      console.log(`   - Content array length: ${message.content?.length || 0}`);
      
      // Log detailed analysis to file for review
      debugLog.log('🔍 INITIAL RESPONSE ANALYSIS', {
        model: message.model,
        stopReason: message.stop_reason,
        contentLength: message.content?.length || 0,
        usage: message.usage,
        query: processedQuery.substring(0, 200),
        timestamp: new Date().toISOString()
      });
      
      if (message.content && message.content.length > 0) {
        message.content.forEach((content: any, index: number) => {
          console.log(`   - Content[${index}] type: ${content.type}`);
          if (content.type === 'text') {
            console.log(`   - Content[${index}] text length: ${content.text?.length || 0}`);
            console.log(`   - Content[${index}] text preview: "${content.text?.substring(0, 100)}${content.text?.length > 100 ? '...' : ''}"`);
            
            // Log full text to file
            debugLog.log(`INITIAL RESPONSE Content[${index}] full text`, {
              type: content.type,
              textLength: content.text?.length || 0,
              fullText: content.text,
              timestamp: new Date().toISOString()
            });
          } else if (content.type === 'tool_use') {
            console.log(`   - Content[${index}] tool: ${content.name}`);
            console.log(`   - Content[${index}] input: ${JSON.stringify(content.input)}`);
            
            // Log tool details to file
            debugLog.log(`INITIAL RESPONSE Content[${index}] tool use`, {
              type: content.type,
              toolName: content.name,
              toolInput: content.input,
              toolId: content.id,
              timestamp: new Date().toISOString()
            });
          }
        });
      } else {
        console.log(`   - EMPTY CONTENT ARRAY!`);
        debugLog.error('INITIAL RESPONSE - EMPTY CONTENT ARRAY', {
          model: message.model,
          stopReason: message.stop_reason,
          usage: message.usage,
          fullResponse: message,
          timestamp: new Date().toISOString()
        });
      }

      // Handle tool calls if present
      const toolUseContent = message.content.filter(content => content.type === 'tool_use');
      if (toolUseContent.length > 0) {
        console.log(`🔧 Tool calls detected: ${toolUseContent.length} tools to execute`);
        toolUseContent.forEach((tool: any, index) => {
          console.log(`  ${index + 1}. ${tool.name}(${JSON.stringify(tool.input).substring(0, 100)}${JSON.stringify(tool.input).length > 100 ? '...' : ''})`);
        });
        
        const result = await this.handleToolCalls(message, processedQuery, context);
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
          
          // Add detailed analysis of why the response ended
          console.log(`🔍 FINAL RESPONSE ANALYSIS:`);
          console.log(`   - Stop reason: ${currentMessage.stop_reason}`);
          console.log(`   - Content array length: ${currentMessage.content?.length || 0}`);
          console.log(`   - Text content length: ${textResponse.text.length}`);
          console.log(`   - Full text: "${textResponse.text}"`);
          
          // Check for various incomplete response patterns
          const incompletePatterns = [
            { pattern: /:\s*$/, name: 'ends with colon' },
            { pattern: /let me check/i, name: 'contains "let me check"' },
            { pattern: /Now let me/i, name: 'contains "Now let me"' },
            { pattern: /Let me also/i, name: 'contains "Let me also"' },
            { pattern: /I should also/i, name: 'contains "I should also"' },
            { pattern: /Next, I/i, name: 'contains "Next, I"' },
            { pattern: /maintenance scheduling issues/i, name: 'contains "maintenance scheduling issues"' },
            { pattern: /client details and maintenance/i, name: 'contains "client details and maintenance"' }
          ];
          
          const matchedPatterns = incompletePatterns.filter(p => p.pattern.test(textResponse.text));
          if (matchedPatterns.length > 0) {
            console.log(`⚠️ INCOMPLETE RESPONSE PATTERNS DETECTED:`);
            matchedPatterns.forEach(p => console.log(`   - ${p.name}`));
          }
          
          // Check if response looks incomplete (ends with a colon or seems to be asking for more data)
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
      
      // Use minimal system prompt for large tool results to save tokens
      const systemPromptForFollowUp = toolResultSize > 10000 
        ? this.buildMinimalSystemPrompt(context)
        : this.buildSystemPrompt(context);
      
      console.log(`🔧 Using ${toolResultSize > 10000 ? 'MINIMAL' : 'FULL'} system prompt for follow-up (${systemPromptForFollowUp.length} chars)`);
      
      // Continue conversation with tool results
      const followUpStart = Date.now();
      const followUpMessage = await this.client!.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        temperature: 0.3,
        system: systemPromptForFollowUp,
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
      
      // Add detailed analysis of the response
      console.log(`🔍 DETAILED FOLLOW-UP RESPONSE ANALYSIS:`);
      console.log(`   - Model: ${followUpMessage.model}`);
      console.log(`   - Stop reason: ${followUpMessage.stop_reason}`);
      console.log(`   - Content array length: ${followUpMessage.content?.length || 0}`);
      
      // Log detailed follow-up analysis to file
      debugLog.log('🔍 DETAILED FOLLOW-UP RESPONSE ANALYSIS', {
        round: toolCallRound,
        model: followUpMessage.model,
        stopReason: followUpMessage.stop_reason,
        contentLength: followUpMessage.content?.length || 0,
        usage: followUpMessage.usage,
        systemPromptLength: systemPromptForFollowUp.length,
        conversationHistoryLength: trimmedHistory.length,
        timestamp: new Date().toISOString()
      });
      
      if (followUpMessage.content && followUpMessage.content.length > 0) {
        followUpMessage.content.forEach((content: any, index: number) => {
          console.log(`   - Content[${index}] type: ${content.type}`);
          if (content.type === 'text') {
            console.log(`   - Content[${index}] text length: ${content.text?.length || 0}`);
            console.log(`   - Content[${index}] text: "${content.text}"`);
            
            // Log full follow-up text to file
            debugLog.log(`FOLLOW-UP RESPONSE Round ${toolCallRound} Content[${index}] full text`, {
              round: toolCallRound,
              type: content.type,
              textLength: content.text?.length || 0,
              fullText: content.text,
              timestamp: new Date().toISOString()
            });
          } else if (content.type === 'tool_use') {
            console.log(`   - Content[${index}] tool: ${content.name}`);
            console.log(`   - Content[${index}] input: ${JSON.stringify(content.input)}`);
            
            // Log follow-up tool details to file
            debugLog.log(`FOLLOW-UP RESPONSE Round ${toolCallRound} Content[${index}] tool use`, {
              round: toolCallRound,
              type: content.type,
              toolName: content.name,
              toolInput: content.input,
              toolId: content.id,
              timestamp: new Date().toISOString()
            });
          }
        });
      } else {
        console.log(`   - EMPTY CONTENT ARRAY!`);
        debugLog.error(`FOLLOW-UP RESPONSE Round ${toolCallRound} - EMPTY CONTENT ARRAY`, {
          round: toolCallRound,
          model: followUpMessage.model,
          stopReason: followUpMessage.stop_reason,
          usage: followUpMessage.usage,
          fullResponse: followUpMessage,
          timestamp: new Date().toISOString()
        });
      }

      // Log the full request that was sent for debugging
      console.log(`🔍 FOLLOW-UP REQUEST DETAILS:`);
      console.log(`   - System prompt length: ${systemPromptForFollowUp.length}`);
      console.log(`   - Messages count: ${trimmedHistory.length}`);
      console.log(`   - Last message type: ${trimmedHistory[trimmedHistory.length - 1]?.role}`);
      console.log(`   - Last message content type: ${Array.isArray(trimmedHistory[trimmedHistory.length - 1]?.content) ? 'array' : typeof trimmedHistory[trimmedHistory.length - 1]?.content}`);
      
      // Log request details to file
      debugLog.log(`FOLLOW-UP REQUEST DETAILS Round ${toolCallRound}`, {
        round: toolCallRound,
        systemPromptLength: systemPromptForFollowUp.length,
        messagesCount: trimmedHistory.length,
        lastMessageType: trimmedHistory[trimmedHistory.length - 1]?.role,
        lastMessageContentType: Array.isArray(trimmedHistory[trimmedHistory.length - 1]?.content) ? 'array' : typeof trimmedHistory[trimmedHistory.length - 1]?.content,
        fullConversationHistory: trimmedHistory,
        systemPromptPreview: systemPromptForFollowUp.substring(0, 500),
        timestamp: new Date().toISOString()
      });
      
      if (!followUpMessage.content || followUpMessage.content.length === 0) {
        console.log(`🚨 EMPTY RESPONSE ANALYSIS:`);
        console.log(`   - Input tokens: ${followUpMessage.usage?.input_tokens}`);
        console.log(`   - Output tokens: ${followUpMessage.usage?.output_tokens}`);
        console.log(`   - Model: ${followUpMessage.model}`);
        console.log(`   - Stop reason: ${followUpMessage.stop_reason}`);
        console.log(`   - Full response object:`, JSON.stringify(followUpMessage, null, 2));
        
        // Also log the request that caused this
        console.log(`🚨 REQUEST THAT CAUSED EMPTY RESPONSE:`);
        console.log(`   - System prompt (first 500 chars): ${systemPromptForFollowUp.substring(0, 500)}...`);
        console.log(`   - Messages:`, JSON.stringify(trimmedHistory, null, 2));
        
        // Log comprehensive empty response analysis to file
        debugLog.error(`EMPTY RESPONSE ANALYSIS Round ${toolCallRound}`, {
          round: toolCallRound,
          inputTokens: followUpMessage.usage?.input_tokens,
          outputTokens: followUpMessage.usage?.output_tokens,
          model: followUpMessage.model,
          stopReason: followUpMessage.stop_reason,
          fullResponse: followUpMessage,
          systemPrompt: systemPromptForFollowUp,
          conversationHistory: trimmedHistory,
          timestamp: new Date().toISOString()
        });
      }

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

  private preprocessBroadQuery(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    // Detect broad analysis queries and make them more specific
    if (lowerQuery.includes('review') && (lowerQuery.includes('next') || lowerQuery.includes('upcoming')) && 
        (lowerQuery.includes('weeks') || lowerQuery.includes('month') || lowerQuery.includes('days'))) {
      
      // Extract time period
      let timePeriod = '4 weeks';
      if (lowerQuery.includes('30 days') || lowerQuery.includes('month')) {
        timePeriod = '30 days';
      } else if (lowerQuery.includes('2 weeks')) {
        timePeriod = '2 weeks';
      } else if (lowerQuery.includes('3 weeks')) {
        timePeriod = '3 weeks';
      }
      
      return `Show me my calendar for the next ${timePeriod} and analyze it for: workload balance, scheduling conflicts, geographic efficiency, maintenance timing, and any concerns or recommendations you have.`;
    }
    
    // Handle "look at" or "take a look" queries
    if ((lowerQuery.includes('look at') || lowerQuery.includes('take a look')) && 
        (lowerQuery.includes('schedule') || lowerQuery.includes('calendar'))) {
      
      let timePeriod = '4 weeks';
      if (lowerQuery.includes('30 days') || lowerQuery.includes('month')) {
        timePeriod = '30 days';
      } else if (lowerQuery.includes('2 weeks')) {
        timePeriod = '2 weeks';
      }
      
      return `Show me my calendar for the next ${timePeriod} and provide analysis on workload distribution, potential conflicts, and any scheduling recommendations.`;
    }
    
    // Handle "questions, concerns, suggestions" type queries
    if (lowerQuery.includes('questions') && lowerQuery.includes('concerns') && lowerQuery.includes('suggestions')) {
      let timePeriod = '4 weeks';
      if (lowerQuery.includes('30 days') || lowerQuery.includes('month')) {
        timePeriod = '30 days';
      }
      
      return `Analyze my schedule for the next ${timePeriod}. Look for: scheduling conflicts, workload balance issues, geographic inefficiencies, maintenance timing problems, and provide specific recommendations for improvements.`;
    }
    
    // Return original query if no preprocessing needed
    return query;
  }

  private buildMinimalSystemPrompt(context: SchedulingContext): string {
    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    return `# Andrea's AI Scheduling Assistant

You are analyzing scheduling data for Andrea's landscaping business. Current date: ${currentDate}

## Key Business Rules
- Andrea targets 3 field days/week
- Most work requires 2+ people (team jobs)
- 4-week maintenance cycles for most clients
- Group nearby clients to minimize travel

## Your Task
Analyze the provided calendar and tool data to give comprehensive insights on:
- Workload balance and field day distribution
- Scheduling conflicts or timing issues  
- Geographic efficiency and travel optimization
- Maintenance timing and overdue clients
- Specific recommendations for improvements

Provide detailed, actionable analysis based on the data you've received.`;
  }
} 