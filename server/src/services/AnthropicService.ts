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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        temperature: 0.3,
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
          reasoning: 'AI analysis using Claude 3.5 Sonnet v2 with enhanced scheduling intelligence',
          suggestions: []
        };
      }

      return this.getMockResponse(query);
    } catch (error) {
      console.error('Error calling Anthropic API:', error);
      return this.getMockResponse(query);
    }
  }

  private buildSystemPrompt(context: SchedulingContext): string {
    const projectsSection = context.projects && context.projects.length > 0 
      ? `PROJECTS:
${JSON.stringify(context.projects, null, 2)}`
      : `PROJECTS:
No active projects currently in the system.`;

    return `You are Andrea's AI scheduling assistant for her landscaping business. You help optimize schedules considering geographic efficiency, helper capabilities, and client preferences.

CURRENT CONTEXT:

HELPERS:
${JSON.stringify(context.helpers, null, 2)}

CLIENTS:
${JSON.stringify(context.clients, null, 2)}

${projectsSection}

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

  private getMockResponse(query: string): SchedulingResponse {
    return {
      response: `## Analysis for: "${query}"

### Current Situation
I've analyzed your current schedule and constraints:

- **Helper Availability**: Sarah (Mon/Wed/Fri), Mike (Tue/Thu)
- **Geographic Coverage**: Downtown, Southeast areas  
- **Daily Requirements**: Both helpers need 7-8 hours on their workdays

### 📋 Scheduling Recommendations

#### 1. **Maintenance Work Priority**
- Schedule **Smith Property** with Sarah on **Monday morning** (4 hours)
- ✅ Matches their preference and Sarah's expertise
- 🕐 Suggested time: 8:00 AM - 12:00 PM

#### 2. **Installation Projects**  
- Assign to Mike on **Tuesday/Thursday** when skills align
- Consider grouping installations in same geographic zone
- 🛠️ Mike's installation expertise is ideal for these projects

#### 3. **Travel Optimization Strategy**
> Group clients in same zones on the same day to minimize driving time

**Zone Grouping Suggestions:**
- **Southeast Zone**: Schedule 2-3 clients consecutively  
- **Downtown Area**: Reserve for afternoon slots when traffic is lighter

### 🎯 Key Benefits
- ⏱️ **Minimizes travel time** between locations
- 👥 **Respects helper availability** and skill requirements  
- 📅 **Maintains regular schedules** for ongoing clients
- ⚖️ **Balances workload** to meet 7-8 hour daily requirements

### ❓ Questions for You
- Are there any **urgent projects** that need immediate scheduling?
- Do you have **weather concerns** for any outdoor work this week?
- Are there **client communication preferences** I should consider?

---
*Would you like me to analyze any specific scenarios or provide more detailed timing suggestions?*`,
      reasoning: 'Enhanced mock response with markdown formatting for better readability',
      suggestions: []
    };
  }
} 