import { google } from 'googleapis';
import { CalendarEvent } from '../types';

export class GoogleCalendarService {
  private auth: any = null;
  private calendar: any = null;

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      this.auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      });

      this.calendar = google.calendar({ version: 'v3', auth: this.auth });
    } catch (error) {
      console.error('Failed to initialize Google Calendar auth:', error);
    }
  }

  async getEvents(daysAhead: number = 7): Promise<CalendarEvent[]> {
    if (!this.calendar) {
      return this.getMockEvents();
    }

    try {
      const now = new Date();
      const endTime = new Date();
      endTime.setDate(now.getDate() + daysAhead);

      // Use the calendar ID from environment variables, fallback to 'primary'
      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

      const response = await this.calendar.events.list({
        calendarId: calendarId,
        timeMin: now.toISOString(),
        timeMax: endTime.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      return events.map((event: any) => this.parseGoogleEvent(event)).filter(Boolean);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      console.error('Calendar ID used:', process.env.GOOGLE_CALENDAR_ID || 'primary');
      return this.getMockEvents();
    }
  }

  private parseGoogleEvent(googleEvent: any): CalendarEvent | null {
    if (!googleEvent.id || !googleEvent.summary) return null;

    const start = googleEvent.start?.dateTime || googleEvent.start?.date;
    const end = googleEvent.end?.dateTime || googleEvent.end?.date;

    if (!start || !end) return null;

    // Filter out all-day events (they represent todo items or helper schedules, not client visits)
    const isAllDay = !googleEvent.start?.dateTime && googleEvent.start?.date;
    if (isAllDay) {
      return null; // Skip all-day events
    }

    // Parse structured data from title and description
    const parsedData = this.parseEventData(googleEvent.summary, googleEvent.description || '');

    return {
      id: googleEvent.id,
      title: googleEvent.summary,
      start: start,
      end: end,
      location: googleEvent.location || parsedData.location,
      description: googleEvent.description,
      eventType: this.inferEventType(googleEvent.summary, googleEvent.description),
      linkedRecords: {
        clientId: parsedData.clientId,
        helperId: parsedData.helperId,
        projectId: parsedData.projectId,
      },
      status: {
        confirmed: googleEvent.status === 'confirmed',
        clientNotified: parsedData.clientNotified || false,
        flexibility: parsedData.flexibility || 'Fixed',
      },
      logistics: {
        travelTimeBuffer: parsedData.travelTimeBuffer || 15,
        materialsNeeded: parsedData.materialsNeeded,
        specialNotes: parsedData.specialNotes,
      },
    };
  }

  private parseEventData(title: string, description: string) {
    const data: any = {};
    
    // Parse title for client and helper names
    // Format: "Client Name - Service Type - Helper Name"
    const titleParts = title.split(' - ');
    if (titleParts.length >= 3) {
      data.clientName = titleParts[0].trim();
      data.serviceType = titleParts[1].trim();
      data.helperName = titleParts[2].trim();
    }

    // Parse description for structured data
    const lines = description.split('\n');
    for (const line of lines) {
      const [key, value] = line.split(':').map(s => s.trim());
      if (!key || !value) continue;

      switch (key.toUpperCase()) {
        case 'CLIENT':
          // Extract client ID from format "Thomas (C001)"
          const clientMatch = value.match(/\(([^)]+)\)/);
          if (clientMatch) {
            data.clientId = clientMatch[1];
          }
          break;
        case 'HELPER':
          // Extract helper ID from format "Sarah Martinez (H001)"
          const helperMatch = value.match(/\(([^)]+)\)/);
          if (helperMatch) {
            data.helperId = helperMatch[1];
          }
          break;
        case 'PROJECT':
          const projectMatch = value.match(/\(([^)]+)\)/);
          if (projectMatch) {
            data.projectId = projectMatch[1];
          }
          break;
        case 'LOCATION':
          data.location = value;
          break;
        case 'ZONE':
          data.zone = value;
          break;
        case 'HOURS':
          data.estimatedHours = parseFloat(value);
          break;
        case 'RATE':
          data.rate = value;
          break;
        case 'PRIORITY':
          data.priority = value;
          break;
        case 'GATE CODE':
        case 'ACCESS CODE':
          data.accessCode = value;
          break;
        case 'WEATHER SENSITIVE':
          data.weatherSensitive = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
          break;
        case 'FLEXIBILITY':
          data.flexibility = value as 'Fixed' | 'Preferred' | 'Flexible';
          break;
        case 'TRAVEL BUFFER':
          data.travelTimeBuffer = parseInt(value);
          break;
        case 'MATERIALS':
          data.materialsNeeded = value.split(',').map(s => s.trim());
          break;
        case 'NOTES':
          data.specialNotes = value;
          break;
        case 'CLIENT NOTIFIED':
          data.clientNotified = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
          break;
      }
    }

    return data;
  }

  private inferEventType(title: string, description?: string): CalendarEvent['eventType'] {
    const titleLower = title.toLowerCase();
    const descLower = (description || '').toLowerCase();
    const combined = `${titleLower} ${descLower}`;

    if (combined.includes('maintenance')) return 'maintenance';
    if (combined.includes('client') || combined.includes('visit')) return 'client_visit';
    if (combined.includes('office') || combined.includes('admin') || combined.includes('design') || combined.includes('invoice')) return 'office_work';
    
    return 'client_visit'; // Default assumption
  }

  private getMockEvents(): CalendarEvent[] {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    return [
      {
        id: 'event_001',
        title: 'Thomas - Maintenance - Sarah',
        start: new Date(today.getTime()).toISOString(),
        end: new Date(today.getTime() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours later
        location: '1764 SW 123rd Pl, 97229',
        description: `CLIENT: Thomas (C001)
HELPER: Sarah Martinez (H001)
SERVICE: Maintenance
HOURS: 4.0
RATE: $75/hour
PRIORITY: High

LOCATION: 1764 SW 123rd Pl, 97229
ZONE: Southwest
GATE CODE: 1234

NOTES: Regular maintenance visit
WEATHER SENSITIVE: No
CLIENT NOTIFIED: Yes`,
        eventType: 'maintenance',
        linkedRecords: {
          clientId: 'C001',
          helperId: 'H001',
        },
        status: {
          confirmed: true,
          clientNotified: true,
          flexibility: 'Fixed',
        },
        logistics: {
          travelTimeBuffer: 15,
          specialNotes: 'Gate code: 1234',
        },
      },
      {
        id: 'event_002',
        title: 'Nader - Install - Mike',
        start: tomorrow.toISOString(),
        end: new Date(tomorrow.getTime() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours later
        location: '486 Lake Bay Ct 97034',
        description: `CLIENT: Nader (C004)
HELPER: Mike Thompson (H002)
SERVICE: Install
HOURS: 5.0
RATE: $70/hour
PRIORITY: Medium

LOCATION: 486 Lake Bay Ct 97034
ZONE: Lake Oswego
PROJECT: Lakefront property (P001)

MATERIALS: Plants, mulch, irrigation supplies
WEATHER SENSITIVE: Yes
CLIENT NOTIFIED: No`,
        eventType: 'client_visit',
        linkedRecords: {
          clientId: 'C004',
          helperId: 'H002',
          projectId: 'P001',
        },
        status: {
          confirmed: true,
          clientNotified: false,
          flexibility: 'Preferred',
        },
        logistics: {
          travelTimeBuffer: 20,
          materialsNeeded: ['plants', 'mulch', 'irrigation supplies'],
          specialNotes: 'Weather dependent installation',
        },
      },
    ];
  }

  // Helper method to generate calendar event templates
  generateEventTemplate(clientId: string, helperId: string, serviceType: string, options: any = {}): string {
    // New format: [Status] Client Name - Service Type [+ Andrea]
    const andreaOnSite = options.andreaOnSite !== false; // Default to true unless explicitly false
    const andreaIndicator = andreaOnSite ? ' + Andrea' : '';
    const statusPrefix = options.status ? `[${options.status}] ` : '[Tentative] ';
    const title = `${statusPrefix}${options.clientName || '[Client Name]'} - ${serviceType}${andreaIndicator}`;
    
    const description = `CLIENT: ${options.clientName || '[Client Name]'} (${clientId})
HELPER: ${options.helperName || '[Helper Name]'} (${helperId})
SERVICE: ${serviceType}
ANDREA ON-SITE: ${andreaOnSite ? 'Yes' : 'No'}
HOURS: ${options.hours || '[Hours]'}
FLEXIBILITY: ${options.flexibility || 'Standard'}
PRIORITY: ${options.priority || 'Medium'}

LOCATION: ${options.location || '[Full Address]'}
ZONE: ${options.zone || '[Zone]'}
${options.projectId ? `PROJECT: ${options.projectName || '[Project Name]'} (${options.projectId})` : ''}

STATUS: ${options.status || 'Tentative'}
CLIENT NOTIFIED: ${options.clientNotified ? 'Yes' : 'No'}
WEATHER SENSITIVE: ${options.weatherSensitive ? 'Yes' : 'No'}

NOTES: ${options.notes || '[Additional notes]'}`;

    return `TITLE: ${title}

DESCRIPTION:
${description}

LOCATION: ${options.location || '[Full Address]'}`;
  }
} 