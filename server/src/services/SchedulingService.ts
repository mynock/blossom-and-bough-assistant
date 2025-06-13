import { 
  Helper, 
  Client, 
  Project, 
  CalendarEvent, 
  SchedulingContext, 
  SchedulingResponse,
  ServiceZone
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
      
      // Return simple error response
      return {
        response: "I'm currently unable to connect to the AI service. Please try again later or check your API configuration.",
        reasoning: 'AI service unavailable',
        suggestions: []
      };
    }
  }

  private getServiceZones(): ServiceZone[] {
    // Portland area service zones with estimated travel times
    return [
      {
        id: 'downtown',
        name: 'Downtown',
        description: 'Downtown Portland and Pearl District',
        typicalTravelTimes: {
          'southwest': 20,
          'southeast': 15,
          'northeast': 20,
          'northwest': 10,
          'lake_oswego': 25,
        },
      },
      {
        id: 'southwest',
        name: 'Southwest',
        description: 'SW Portland including Capitol Highway area',
        typicalTravelTimes: {
          'downtown': 20,
          'southeast': 25,
          'northeast': 35,
          'northwest': 30,
          'lake_oswego': 15,
        },
      },
      {
        id: 'southeast',
        name: 'Southeast',
        description: 'SE Portland residential areas',
        typicalTravelTimes: {
          'downtown': 15,
          'southwest': 25,
          'northeast': 30,
          'northwest': 25,
          'lake_oswego': 20,
        },
      },
      {
        id: 'northeast',
        name: 'Northeast',
        description: 'NE Portland residential areas',
        typicalTravelTimes: {
          'downtown': 20,
          'southwest': 35,
          'southeast': 30,
          'northwest': 15,
          'lake_oswego': 30,
        },
      },
      {
        id: 'northwest',
        name: 'Northwest',
        description: 'NW Portland and surrounding areas',
        typicalTravelTimes: {
          'downtown': 10,
          'southwest': 30,
          'southeast': 25,
          'northeast': 15,
          'lake_oswego': 35,
        },
      },
      {
        id: 'lake_oswego',
        name: 'Lake Oswego',
        description: 'Lake Oswego and surrounding areas',
        typicalTravelTimes: {
          'downtown': 25,
          'southwest': 15,
          'southeast': 20,
          'northeast': 30,
          'northwest': 35,
        },
      },
    ];
  }

  async optimizeSchedule(
    requestType: string,
    constraints: any,
    preferences: any
  ): Promise<any> {
    try {
      // Get current data
      const [helpers, clients, projects, settings] = await Promise.all([
        this.googleSheetsService.getHelpers(),
        this.googleSheetsService.getClients(),
        this.googleSheetsService.getProjects(),
        this.googleSheetsService.getBusinessSettings(),
      ]);

      // Build context for AI optimization
      const context = {
        requestType,
        constraints,
        preferences,
        helpers,
        clients,
        projects,
        settings,
        calendarEvents: [], // Empty for now, could be fetched from calendar service
        zones: this.getServiceZones(), // Add zones for travel optimization
      };

      // Build query string for AI
      const query = `${requestType} request with constraints: ${JSON.stringify(constraints)} and preferences: ${JSON.stringify(preferences)}`;

      // Get AI recommendations
      const recommendations = await this.anthropicService.getSchedulingRecommendation(query, context);

      // For now, we'll work with the text response since the API returns natural language
      // In the future, you could enhance this to parse structured data from the AI response

      return {
        success: true,
        recommendations,
        context: {
          helpersAvailable: helpers.length,
          clientsActive: clients.filter(c => c.status === 'active').length,
          projectsPending: projects.filter(p => p.status !== 'Completed').length,
        },
      };
    } catch (error) {
      console.error('Schedule optimization failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fallback: {
          message: 'Using basic scheduling logic as fallback',
          suggestions: this.getBasicSchedulingSuggestions(constraints, preferences),
        },
      };
    }
  }

  private getBasicSchedulingSuggestions(constraints: any, preferences: any): any {
    return {
      message: 'Consider these basic scheduling principles:',
      suggestions: [
        'Group clients by geographic zones to minimize travel time',
        'Schedule maintenance clients based on their interval requirements',
        'Match helper capabilities with job requirements',
        'Consider helper availability and preferred working days',
        'Leave buffer time between jobs for travel and setup',
      ],
      nextSteps: [
        'Review helper schedules for the requested time period',
        'Check client maintenance schedules and priorities',
        'Consider weather sensitivity for outdoor work',
        'Verify helper skill requirements match job needs',
      ],
    };
  }

  async generateScheduleReport(startDate: string, endDate: string): Promise<any> {
    return {
      message: 'Schedule report generation is not yet implemented',
      dateRange: { startDate, endDate },
    };
  }

  async getScheduleConflicts(scheduleData: CalendarEvent[]): Promise<any[]> {
    return []; // No conflicts detected for now
  }
} 