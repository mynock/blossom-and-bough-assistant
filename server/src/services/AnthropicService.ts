import Anthropic from '@anthropic-ai/sdk';
import { SchedulingContext, SchedulingResponse } from '../types';

export class AnthropicService {
  private client: Anthropic | null = null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  async getSchedulingRecommendation(
    query: string, 
    context: SchedulingContext
  ): Promise<SchedulingResponse> {
    if (!this.client) {
      return this.getMockResponse(query);
    }

    try {
      const systemPrompt = this.buildSystemPrompt(context);
      
      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: query
          }
        ]
      });

      const response = message.content[0];
      if (response.type === 'text') {
        return {
          response: response.text,
          reasoning: 'AI analysis based on current scheduling context',
          suggestions: [] // Could parse structured suggestions from response
        };
      }

      return this.getMockResponse(query);
    } catch (error) {
      console.error('Error calling Anthropic API:', error);
      return this.getMockResponse(query);
    }
  }

  private buildSystemPrompt(context: SchedulingContext): string {
    return `You are Andrea's AI scheduling assistant for her landscaping business. You help optimize schedules considering geographic efficiency, helper capabilities, and client preferences.

CURRENT CONTEXT:

HELPERS:
${JSON.stringify(context.helpers, null, 2)}

CLIENTS:
${JSON.stringify(context.clients, null, 2)}

PROJECTS:
${JSON.stringify(context.projects, null, 2)}

CURRENT SCHEDULE:
${JSON.stringify(context.calendarEvents, null, 2)}

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
2. Analyze current constraints and opportunities
3. Provide specific, actionable scheduling recommendations with times and assignments
4. Explain the reasoning behind suggestions (travel efficiency, helper skills, client preferences)
5. Mention any trade-offs or alternative approaches
6. Ask clarifying questions if the request is ambiguous

Be practical, specific, and collaborative. Focus on solutions that Andrea can realistically implement.`;
  }

  private getMockResponse(query: string): SchedulingResponse {
    return {
      response: `Based on your query: "${query}"

I've analyzed your current schedule and constraints. Here are my recommendations:

**Current Situation Analysis:**
- Helper availability: Sarah (Mon/Wed/Fri), Mike (Tue/Thu)
- Geographic zones: Downtown, Southeast areas
- Hour requirements: Both helpers need 7-8 hours on their workdays

**Scheduling Recommendations:**
1. **For maintenance work**: Schedule Smith Property with Sarah on Monday morning (4 hours) - matches their preference and Sarah's expertise
2. **For installation projects**: Assign to Mike on Tuesday/Thursday when his skills align with requirements
3. **Travel optimization**: Group clients in same zones on the same day to minimize driving time

**Reasoning:**
- This approach minimizes travel time between locations
- Respects helper availability and skill requirements  
- Maintains regular maintenance schedules for ongoing clients
- Balances workload to meet 7-8 hour daily requirements

**Questions for you:**
- Are there any urgent projects that need immediate scheduling?
- Do you have weather concerns for any outdoor work this week?
- Are there client communication preferences I should consider?

Would you like me to analyze any specific scenarios or provide more detailed timing suggestions?`,
      reasoning: 'Mock response providing general scheduling guidance based on typical constraints',
      suggestions: []
    };
  }
} 