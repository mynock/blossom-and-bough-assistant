import { 
  Helper, 
  Client, 
  Project, 
  CalendarEvent, 
  SchedulingContext, 
  SchedulingResponse 
} from '../types';
import { GoogleSheetsService } from './GoogleSheetsService';
import { GoogleCalendarService } from './GoogleCalendarService';
import { AnthropicService } from './AnthropicService';
import { TravelTimeService } from './TravelTimeService';

export class SchedulingService {
  constructor(
    private googleSheetsService: GoogleSheetsService,
    private googleCalendarService: GoogleCalendarService,
    private anthropicService: AnthropicService,
    private travelTimeService: TravelTimeService
  ) {}

  async getHelpers(): Promise<Helper[]> {
    return await this.googleSheetsService.getHelpers();
  }

  async getClients(): Promise<Client[]> {
    return await this.googleSheetsService.getClients();
  }

  async getProjects(): Promise<Project[]> {
    return await this.googleSheetsService.getProjects();
  }

  async getCalendarEvents(daysAhead: number = 7): Promise<CalendarEvent[]> {
    return await this.googleCalendarService.getEvents(daysAhead);
  }

  async getSchedulingContext(): Promise<SchedulingContext> {
    const [helpers, clients, projects, calendarEvents] = await Promise.all([
      this.getHelpers(),
      this.getClients(),
      this.getProjects(),
      this.getCalendarEvents()
    ]);

    return {
      helpers,
      clients,
      projects,
      calendarEvents,
      zones: [] // TODO: Add zones support
    };
  }

  async getSchedulingRecommendation(query: string): Promise<SchedulingResponse> {
    try {
      // Get current context
      const context = await this.getSchedulingContext();
      
      // Call Anthropic for AI recommendation
      const aiResponse = await this.anthropicService.getSchedulingRecommendation(
        query, 
        context
      );

      return aiResponse;
    } catch (error) {
      console.error('Error getting scheduling recommendation:', error);
      
      // Return mock response as fallback
      return {
        response: `I understand you're asking about: "${query}". I'm currently having trouble accessing the AI service, but I can still help with basic scheduling questions. Here's what I can see from your current setup:

**Current Helper Availability:**
- Your helpers are available on their designated days
- Each helper needs 7-8 hours per workday

**General Recommendations:**
- Group nearby clients together to minimize travel time
- Schedule maintenance work during preferred time slots
- Consider helper skill requirements for different projects

Would you like me to provide more specific guidance based on your available data?`,
        reasoning: 'Fallback response due to AI service unavailability',
        suggestions: []
      };
    }
  }
} 