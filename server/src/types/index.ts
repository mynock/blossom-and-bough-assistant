export interface Helper {
  id: string;
  name: string;
  workdays: string[];
  homeAddress: string;
  minHours: number;
  maxHours: number;
  capabilityTier: 'Beginner' | 'Intermediate' | 'Advanced';
  skills: string[];
  hourlyRate: number;
  status: 'active' | 'inactive';
  communicationPreferences?: {
    noticeRequired: number; // hours
    contactMethod: 'phone' | 'email' | 'text';
  };
}

export interface Client {
  id: string;
  name: string;
  address: string;
  zone: string;
  email?: string;
  phone?: string;
  maintenanceSchedule: {
    isMaintenance: boolean;
    intervalWeeks?: number;
    hoursPerVisit?: number;
    lastVisit?: string;
    nextTarget?: string;
    rate?: number;
  };
  preferences: {
    preferredDays: string[];
    preferredTime: 'morning' | 'afternoon' | 'evening' | 'flexible';
    flexibility: 'Fixed' | 'Preferred' | 'Flexible';
    specialRequirements?: string;
  };
  priority: 'High' | 'Medium' | 'Low';
  status: 'active' | 'inactive' | 'seasonal';
  notes?: string;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  description: string;
  type: 'Design' | 'Install' | 'Pruning' | 'Maintenance' | 'Repair' | 'Other';
  status: 'Quoted' | 'Approved' | 'In Progress' | 'Completed' | 'On Hold';
  schedulingDetails: {
    estimatedHours: number;
    officeHours?: number;
    preferredCompletionDate?: string;
    urgency: 'Low' | 'Medium' | 'High' | 'Critical';
    weatherSensitive: boolean;
  };
  requirements: {
    requiredCapabilityLevel: 'Beginner' | 'Intermediate' | 'Advanced';
    requiredSkills: string[];
    materialsNeeded?: string[];
    equipmentRequired?: string[];
  };
  financial: {
    quotedAmount?: number;
    approvedBudget?: number;
    actualHours?: number;
  };
  notes?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  eventType: 'client_visit' | 'office_work' | 'personal' | 'maintenance' | 'helper_schedule' | 'todo';
  linkedRecords?: {
    clientId?: string;
    projectId?: string;
    helperId?: string;
  };
  status: {
    confirmed: boolean;
    clientNotified: boolean;
    flexibility: 'Fixed' | 'Preferred' | 'Flexible';
  };
  logistics?: {
    travelTimeBuffer: number;
    materialsNeeded?: string[];
    specialNotes?: string;
  };
}

export interface MaintenanceCalendarEvent {
  // Core identification
  clientName: string;
  clientId: string;
  service: string;
  helperId: string;
  helperName: string;
  
  // Andrea involvement
  andreaOnSite: boolean;
  
  // Timing
  hours: number;
  
  // Scheduling attributes
  flexibility: 'Fixed' | 'Preferred' | 'Flexible';
  priority: 'High' | 'Medium' | 'Low';
  
  // Location
  location: string;
  zone: string;
  
  // Status tracking
  clientNotified: boolean;
  status: 'Tentative' | 'Self-Confirmed' | 'Client-Confirmed' | 'Rescheduled';
  
  // Additional details
  notes?: string;
  weatherSensitive?: boolean;
}

export interface ServiceZone {
  id: string;
  name: string;
  description?: string;
  typicalTravelTimes: { [zoneId: string]: number };
}

export interface SchedulingContext {
  helpers: Helper[];
  clients: Client[];
  projects: Project[];
  calendarEvents: CalendarEvent[];
  zones: ServiceZone[];
}

export interface SchedulingRequest {
  query: string;
  context?: Partial<SchedulingContext>;
}

export interface SchedulingResponse {
  response: string;
  suggestions?: SchedulingSuggestion[];
  reasoning: string;
}

export interface SchedulingSuggestion {
  id: string;
  title: string;
  description: string;
  scheduledTime: {
    start: string;
    end: string;
  };
  assignedHelper: string;
  clientId: string;
  projectId?: string;
  estimatedTravelTime?: number;
  conflicts?: string[];
  benefits: string[];
  tradeoffs?: string[];
}

export interface TravelTimeRequest {
  origin: string;
  destination: string;
}

export interface TravelTimeResponse {
  duration: number; // minutes
  distance: string;
  route?: string;
} 