import { google } from 'googleapis';
import { CalendarEvent } from '../types';
import { createGoogleAuth, hasGoogleCredentials, getGoogleAuthConfig } from '../utils/googleAuth';

export class GoogleCalendarService {
  private auth: any = null;
  private calendar: any = null;

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      // Check if any Google credentials are available
      if (!hasGoogleCredentials()) {
        console.log('📅 Google credentials not configured for Calendar, calendar features disabled');
        const config = getGoogleAuthConfig();
        console.log('📝 Auth config:', config);
        return;
      }

      console.log('🔑 Initializing Google Calendar with shared auth...');

      // Initialize Google Calendar API using shared auth utility
      this.auth = createGoogleAuth(['https://www.googleapis.com/auth/calendar.readonly']);
      this.calendar = google.calendar({ version: 'v3', auth: this.auth });
      console.log('✅ Google Calendar API initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Google Calendar auth:', error);
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
        clientNotified: Boolean(googleEvent.attendees?.some((a: any) => a.responseStatus === 'accepted')),
        flexibility: (googleEvent.extendedProperties?.private?.flexibility as any) || 'Flexible',
        level: 'C' // Default to Confirmed for existing events
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
    if (combined.includes('client') || combined.includes('visit')) return 'ad_hoc';
    if (combined.includes('office') || combined.includes('admin') || combined.includes('design') || combined.includes('invoice')) return 'office_work';
    
    return 'maintenance';
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
          flexibility: 'Fixed' as const,
          level: 'C' as const
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
        eventType: 'ad_hoc',
        linkedRecords: {
          clientId: 'C004',
          helperId: 'H002',
          projectId: 'P001',
        },
        status: {
          confirmed: true,
          clientNotified: false,
          flexibility: 'Preferred' as const,
          level: 'T' as const
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
    // Updated format to match calendar enhancer: [Status] Client - WorkType (Helper) | Notes
    const helperInfo = options.helperName ? `(${options.helperName})` : '';
    const statusLabel = options.status || 'C'; // Default to Confirmed
    const notesSection = options.notes ? ` | ${options.notes}` : '';
    const title = `[${statusLabel}] ${options.clientName || '[Client Name]'} - ${serviceType}${helperInfo}${notesSection}`;
    
    // Enhanced description matching calendar enhancer format
    const description = `CLIENT: ${options.clientName || '[Client Name]'} (${clientId})
SERVICE: ${serviceType}

${options.helperName ? `HELPER: ${options.helperName} (${helperId})` : ''}
${options.hours ? `ESTIMATED HOURS: ${options.hours}` : ''}
${options.priority ? `PRIORITY: ${options.priority}` : ''}
${options.flexibility ? `FLEXIBILITY: ${options.flexibility}` : ''}

${options.zone ? `ZONE: ${options.zone}` : ''}

${options.notes ? `NOTES: ${options.notes}` : ''}

PREFERENCES:
${options.clientNotified ? 'CLIENT NOTIFIED: Yes' : 'CLIENT NOTIFIED: No'}
${options.weatherSensitive ? 'WEATHER SENSITIVE: Yes' : 'WEATHER SENSITIVE: No'}`;

    return `TITLE: ${title}

DESCRIPTION:
${description}

LOCATION: ${options.location || '[Full Address]'}`;
  }

  // Helper method to determine work type from event content (matching calendar enhancer logic)
  private determineWorkType(summary: string, description?: string): string {
    if (!summary) return 'Maintenance';
    
    const combined = `${summary} ${description || ''}`.toLowerCase();
    
    // Check for specific work type keywords (matching calendar enhancer logic)
    if (combined.includes('design') || combined.includes('consultation') || combined.includes('planning') || combined.includes('plan') || combined.includes('estimate')) {
      return 'Design';
    } else if (combined.includes('office') || combined.includes('invoice') || combined.includes('quote') || combined.includes('admin') || combined.includes('paperwork') || combined.includes('follow-up')) {
      return 'Office Work';
    } else if (combined.includes('errands') || combined.includes('supply') || combined.includes('pickup') || combined.includes('equipment service') || combined.includes('shop') || combined.includes('truck service') || combined.includes('tool') || combined.includes('equipment maintenance') || combined.includes('repair')) {
      return 'Errands';
    } else if (combined.includes('storm') || combined.includes('emergency') || combined.includes('urgent') || combined.includes('fix')) {
      return 'Ad-hoc';
    } else {
      return 'Maintenance'; // Default for client work
    }
  }

  private categorizeEventType(summary: string, description?: string): CalendarEvent['eventType'] {
    const workType = this.determineWorkType(summary, description);
    
    // Map work types to event types
    switch (workType) {
      case 'Maintenance': return 'maintenance';
      case 'Ad-hoc': return 'ad_hoc';
      case 'Design': return 'design';
      case 'Office Work': return 'office_work';
      case 'Errands': return 'errands';
      default: return 'maintenance';
    }
  }
} 