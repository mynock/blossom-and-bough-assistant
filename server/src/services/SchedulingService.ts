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
  ) {
    // Inject this service into AnthropicService to avoid circular dependency
    this.anthropicService.setSchedulingService(this);
  }

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

  // New method for agentic tool calling
  async getCalendarEventsInRange(
    startDate: string, 
    endDate: string, 
    filters?: { helperId?: string; eventType?: string }
  ): Promise<CalendarEvent[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    // Get events for the calculated range
    const events = await this.googleCalendarService.getEvents(daysDiff);
    
    // Filter events to the exact date range and apply filters
    return events.filter(event => {
      const eventStart = new Date(event.start);
      const inRange = eventStart >= start && eventStart <= end;
      
      if (!inRange) return false;
      
      if (filters?.helperId && event.linkedRecords?.helperId !== filters.helperId) {
        return false;
      }
      
      if (filters?.eventType && event.eventType !== filters.eventType) {
        return false;
      }
      
      return true;
    });
  }

  // New method for checking helper availability
  async checkHelperAvailability(
    helperId: string,
    startDate: string,
    endDate: string,
    minHoursNeeded?: number
  ): Promise<any> {
    const helpers = await this.getHelpers();
    const helper = helpers.find(h => h.id === helperId);
    
    if (!helper) {
      return { available: false, reason: 'Helper not found' };
    }

    const events = await this.getCalendarEventsInRange(startDate, endDate, { helperId });
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Calculate availability by day
    const availability = [];
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
      const isWorkday = helper.workdays.includes(dayName);
      
      if (isWorkday) {
        const dayEvents = events.filter(event => {
          const eventDate = new Date(event.start).toDateString();
          return eventDate === currentDate.toDateString();
        });
        
        const bookedHours = dayEvents.reduce((total, event) => {
          const start = new Date(event.start);
          const end = new Date(event.end);
          return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }, 0);
        
        const availableHours = helper.maxHours - bookedHours;
        
        availability.push({
          date: currentDate.toISOString().split('T')[0],
          dayName,
          isWorkday: true,
          bookedHours,
          availableHours,
          canFit: minHoursNeeded ? availableHours >= minHoursNeeded : availableHours > 0
        });
      } else {
        availability.push({
          date: currentDate.toISOString().split('T')[0],
          dayName,
          isWorkday: false,
          bookedHours: 0,
          availableHours: 0,
          canFit: false
        });
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return {
      helper: { id: helper.id, name: helper.name, workdays: helper.workdays },
      availability,
      summary: {
        totalWorkdays: availability.filter(d => d.isWorkday).length,
        availableDays: availability.filter(d => d.canFit).length,
        canAccommodateRequest: minHoursNeeded ? availability.some(d => d.canFit) : true
      }
    };
  }

  // New method for maintenance schedule
  async getMaintenanceSchedule(clientId?: string, weeksAhead: number = 8): Promise<any> {
    const clients = await this.getClients();
    
    let maintenanceClients = clients.filter(c => c.maintenanceSchedule.isMaintenance);
    
    // Filter by client if specified
    if (clientId) {
      // Try to find by ID first, then by name (case insensitive)
      const targetClient = clients.find(c => 
        c.id === clientId || 
        c.name.toLowerCase() === clientId.toLowerCase()
      );
      
      if (targetClient) {
        maintenanceClients = maintenanceClients.filter(c => c.id === targetClient.id);
      } else {
        // No client found, return empty but informative result
        return {
          maintenanceSchedule: [],
          summary: {
            totalClients: 0,
            overdueClients: 0,
            upcomingThisWeek: 0
          },
          error: `No client found with ID or name: ${clientId}`
        };
      }
    }
    
    const schedule = [];
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(now.getDate() + (weeksAhead * 7));
    
    for (const client of maintenanceClients) {
      if (client.maintenanceSchedule.nextTarget) {
        const nextDate = new Date(client.maintenanceSchedule.nextTarget);
        if (nextDate <= endDate) {
          schedule.push({
            clientId: client.id,
            clientName: client.name,
            nextMaintenanceDate: client.maintenanceSchedule.nextTarget,
            intervalWeeks: client.maintenanceSchedule.intervalWeeks,
            hoursPerVisit: client.maintenanceSchedule.hoursPerVisit,
            priority: client.priority,
            zone: client.zone,
            address: client.address,
            isOverdue: nextDate < now
          });
        }
      }
    }
    
    return {
      maintenanceSchedule: schedule.sort((a, b) => 
        new Date(a.nextMaintenanceDate).getTime() - new Date(b.nextMaintenanceDate).getTime()
      ),
      summary: {
        totalClients: schedule.length,
        overdueClients: schedule.filter(s => s.isOverdue).length,
        upcomingThisWeek: schedule.filter(s => {
          const nextWeek = new Date();
          nextWeek.setDate(now.getDate() + 7);
          const maintenanceDate = new Date(s.nextMaintenanceDate);
          return maintenanceDate >= now && maintenanceDate <= nextWeek;
        }).length
      }
    };
  }

  // New method for querying client information
  async getClientInfo(
    clientName?: string,
    clientId?: string,
    zone?: string,
    maintenanceOnly?: boolean
  ): Promise<any[]> {
    const clients = await this.getClients();
    
    let filteredClients = clients;
    
    // Filter by client ID if provided
    if (clientId) {
      filteredClients = filteredClients.filter(c => c.id === clientId);
    }
    
    // Filter by client name if provided (partial match, case insensitive)
    if (clientName) {
      const searchName = clientName.toLowerCase();
      filteredClients = filteredClients.filter(c => 
        c.name.toLowerCase().includes(searchName)
      );
    }
    
    // Filter by zone if provided
    if (zone) {
      filteredClients = filteredClients.filter(c => c.zone === zone);
    }
    
    // Filter by maintenance status if requested
    if (maintenanceOnly) {
      filteredClients = filteredClients.filter(c => c.maintenanceSchedule.isMaintenance);
    }
    
    // Return detailed client information
    return filteredClients.map(client => ({
      id: client.id,
      name: client.name,
      zone: client.zone,
      address: client.address,
      priority: client.priority,
      status: client.status,
      notes: client.notes,
      maintenanceSchedule: client.maintenanceSchedule.isMaintenance ? {
        isMaintenance: true,
        intervalWeeks: client.maintenanceSchedule.intervalWeeks,
        hoursPerVisit: client.maintenanceSchedule.hoursPerVisit,
        rate: client.maintenanceSchedule.rate,
        lastVisit: client.maintenanceSchedule.lastVisit,
        nextTarget: client.maintenanceSchedule.nextTarget
      } : {
        isMaintenance: false
      }
    }));
  }

  // New method for travel time calculation
  async calculateTravelTime(origin: string, destination: string): Promise<any> {
    return await this.travelTimeService.calculateTravelTime(origin, destination);
  }

  // New method for conflict detection
  async findSchedulingConflicts(proposedEvent: {
    helperId: string;
    startTime: string;
    durationHours: number;
    location?: string;
  }): Promise<any> {
    const startTime = new Date(proposedEvent.startTime);
    const endTime = new Date(startTime.getTime() + (proposedEvent.durationHours * 60 * 60 * 1000));
    
    // Get events for the day
    const dayStart = new Date(startTime);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(startTime);
    dayEnd.setHours(23, 59, 59, 999);
    
    const existingEvents = await this.getCalendarEventsInRange(
      dayStart.toISOString().split('T')[0],
      dayEnd.toISOString().split('T')[0],
      { helperId: proposedEvent.helperId }
    );
    
    const conflicts = [];
    
    for (const event of existingEvents) {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      
      // Check for time overlap
      if (startTime < eventEnd && endTime > eventStart) {
        conflicts.push({
          conflictType: 'time_overlap',
          existingEvent: {
            id: event.id,
            title: event.title,
            start: event.start,
            end: event.end,
            location: event.location
          },
          overlapMinutes: Math.min(endTime.getTime(), eventEnd.getTime()) - 
                         Math.max(startTime.getTime(), eventStart.getTime())
        });
      }
    }
    
    // Check helper daily hour limits
    const helper = (await this.getHelpers()).find(h => h.id === proposedEvent.helperId);
    if (helper) {
      const totalHours = existingEvents.reduce((total, event) => {
        const start = new Date(event.start);
        const end = new Date(event.end);
        return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }, 0) + proposedEvent.durationHours;
      
      if (totalHours > helper.maxHours) {
        conflicts.push({
          conflictType: 'daily_hour_limit',
          helperMaxHours: helper.maxHours,
          currentHours: totalHours - proposedEvent.durationHours,
          proposedHours: proposedEvent.durationHours,
          totalHours,
          excessHours: totalHours - helper.maxHours
        });
      }
    }
    
    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      proposedEvent: {
        helperId: proposedEvent.helperId,
        startTime: proposedEvent.startTime,
        endTime: endTime.toISOString(),
        durationHours: proposedEvent.durationHours
      }
    };
  }

  async getSchedulingContext(): Promise<SchedulingContext> {
    const [helpers, clients, projects, calendarEvents, maintenanceSchedule] = await Promise.all([
      this.getHelpers(),
      this.getClients(),
      this.getProjects(),
      this.getCalendarEvents(60), // 60 days for 1-2 month planning
      this.getMaintenanceSchedule(undefined, 12) // 3 months of maintenance data
    ]);

    // Add helper availability summaries for next 8 weeks
    const helperAvailability = await this.generateHelperAvailabilitySummary(helpers, 56); // 8 weeks

    return {
      helpers,
      clients,
      projects,
      calendarEvents,
      zones: [], // TODO: Add zones support
      // Add rich context for planning
      maintenanceSchedule,
      helperAvailability,
      businessMetrics: await this.generateBusinessMetrics(calendarEvents, helpers, clients)
    };
  }

  // Generate helper availability summary for planning
  private async generateHelperAvailabilitySummary(helpers: Helper[], days: number): Promise<any> {
    const summary = [];
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + days);

    for (const helper of helpers) {
      const availability = await this.checkHelperAvailability(
        helper.id,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      // Summarize by week for easier planning
      const weeklyAvailability = [];
      const currentWeek = new Date(startDate);
      
      for (let week = 0; week < Math.ceil(days / 7); week++) {
        const weekStart = new Date(currentWeek);
        const weekEnd = new Date(currentWeek);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        const weekDays = availability.availability.filter((day: any) => {
          const dayDate = new Date(day.date);
          return dayDate >= weekStart && dayDate <= weekEnd;
        });

        const totalAvailableHours = weekDays.reduce((sum: number, day: any) => 
          sum + (day.availableHours || 0), 0);
        const totalWorkdays = weekDays.filter((day: any) => day.isWorkday).length;

        weeklyAvailability.push({
          weekStart: weekStart.toISOString().split('T')[0],
          weekEnd: weekEnd.toISOString().split('T')[0],
          totalWorkdays,
          totalAvailableHours,
          averageAvailableHoursPerDay: totalWorkdays > 0 ? totalAvailableHours / totalWorkdays : 0,
          fullyAvailableDays: weekDays.filter((day: any) => day.availableHours >= helper.maxHours - 1).length
        });

        currentWeek.setDate(currentWeek.getDate() + 7);
      }

      summary.push({
        helperId: helper.id,
        helperName: helper.name,
        workdays: helper.workdays,
        maxHoursPerDay: helper.maxHours,
        weeklyAvailability,
        notes: helper.notes
      });
    }

    return summary;
  }

  // Generate business metrics for context
  private async generateBusinessMetrics(events: CalendarEvent[], helpers: Helper[], clients: Client[]): Promise<any> {
    const now = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(now.getMonth() + 1);
    
    // Analyze current workload distribution
    const helperWorkload = helpers.map(helper => {
      const helperEvents = events.filter(event => 
        event.linkedRecords?.helperId === helper.id &&
        new Date(event.start) >= now &&
        new Date(event.start) <= nextMonth
      );

      const totalHours = helperEvents.reduce((sum, event) => {
        const start = new Date(event.start);
        const end = new Date(event.end);
        return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }, 0);

      return {
        helperId: helper.id,
        helperName: helper.name,
        upcomingHours: totalHours,
        upcomingEvents: helperEvents.length,
        utilizationRate: totalHours / (helper.maxHours * helper.workdays.length * 4) // Rough monthly capacity
      };
    });

    // Zone distribution analysis
    const zoneDistribution = clients.reduce((zones: any, client) => {
      zones[client.zone] = (zones[client.zone] || 0) + 1;
      return zones;
    }, {});

    return {
      helperWorkload,
      zoneDistribution,
      maintenanceClientCount: clients.filter(c => c.maintenanceSchedule.isMaintenance).length,
      activeClientCount: clients.filter(c => c.status === 'active').length,
      upcomingEventsCount: events.filter(e => new Date(e.start) >= now).length
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