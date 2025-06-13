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

      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: endTime.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      return events.map((event: any) => this.parseGoogleEvent(event)).filter(Boolean);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      return this.getMockEvents();
    }
  }

  private parseGoogleEvent(googleEvent: any): CalendarEvent | null {
    if (!googleEvent.id || !googleEvent.summary) return null;

    const start = googleEvent.start?.dateTime || googleEvent.start?.date;
    const end = googleEvent.end?.dateTime || googleEvent.end?.date;

    if (!start || !end) return null;

    return {
      id: googleEvent.id,
      title: googleEvent.summary,
      start: start,
      end: end,
      location: googleEvent.location,
      description: googleEvent.description,
      eventType: this.inferEventType(googleEvent.summary, googleEvent.description),
      status: {
        confirmed: googleEvent.status === 'confirmed',
        clientNotified: false, // This would need to be tracked separately
        flexibility: 'Fixed', // Default, could be parsed from description
      },
      logistics: {
        travelTimeBuffer: 15, // Default 15 minutes
      },
    };
  }

  private inferEventType(title: string, description?: string): CalendarEvent['eventType'] {
    const titleLower = title.toLowerCase();
    const descLower = (description || '').toLowerCase();
    const combined = `${titleLower} ${descLower}`;

    if (combined.includes('maintenance')) return 'maintenance';
    if (combined.includes('client') || combined.includes('visit')) return 'client_visit';
    if (combined.includes('office') || combined.includes('admin') || combined.includes('design')) return 'office_work';
    
    return 'client_visit'; // Default assumption
  }

  private getMockEvents(): CalendarEvent[] {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    return [
      {
        id: 'event_001',
        title: 'Smith Property - Maintenance',
        start: new Date(today.getTime()).toISOString(),
        end: new Date(today.getTime() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours later
        location: '123 Oak St, Portland, OR',
        description: 'Regular maintenance with Sarah',
        eventType: 'maintenance',
        linkedRecords: {
          clientId: 'client_001',
          helperId: 'helper_001',
        },
        status: {
          confirmed: true,
          clientNotified: true,
          flexibility: 'Fixed',
        },
        logistics: {
          travelTimeBuffer: 15,
        },
      },
      {
        id: 'event_002',
        title: 'Johnson Landscape - Install',
        start: tomorrow.toISOString(),
        end: new Date(tomorrow.getTime() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours later
        location: '456 Pine Ave, Portland, OR',
        description: 'New plant installation with Mike',
        eventType: 'client_visit',
        linkedRecords: {
          clientId: 'client_002',
          helperId: 'helper_002',
          projectId: 'project_001',
        },
        status: {
          confirmed: true,
          clientNotified: false,
          flexibility: 'Preferred',
        },
        logistics: {
          travelTimeBuffer: 20,
          materialsNeeded: ['plants', 'tools'],
        },
      },
    ];
  }
} 