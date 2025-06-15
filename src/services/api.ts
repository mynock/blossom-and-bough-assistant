import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    throw error;
  }
);

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
  notes?: string;
}

export interface Client {
  id: string;
  name: string;
  address: string;
  zone: string;
  maintenanceSchedule: {
    isMaintenance: boolean;
    intervalWeeks?: number;
    hoursPerVisit?: number;
    lastVisit?: string;
    nextTarget?: string;
  };
  preferences: {
    preferredDays: string[];
    preferredTime: 'morning' | 'afternoon' | 'evening' | 'flexible';
    flexibility: 'Fixed' | 'Preferred' | 'Flexible';
  };
  priority: 'High' | 'Medium' | 'Low';
  status: 'active' | 'inactive' | 'seasonal';
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  eventType: 'maintenance' | 'ad_hoc' | 'design' | 'office_work' | 'errands' | 'helper_schedule' | 'personal' | 'todo';
  status?: {
    confirmed: boolean;
    clientNotified: boolean;
    flexibility: 'Fixed' | 'Preferred' | 'Flexible';
    level: 'C' | 'T' | 'P';
  };
}

export interface ChatResponse {
  response: string;
  reasoning?: string;
}

export interface TravelTimeResponse {
  duration: number;
  distance: string;
  route?: string;
}

// API functions
export const helpersApi = {
  getAll: async (): Promise<{ helpers: Helper[] }> => {
    const response = await apiClient.get('/helpers');
    return response.data;
  },
};

export const clientsApi = {
  getAll: async (): Promise<{ clients: Client[] }> => {
    const response = await apiClient.get('/clients');
    return response.data;
  },
};

export const calendarApi = {
  getEvents: async (days: number = 7): Promise<{ events: CalendarEvent[] }> => {
    const response = await apiClient.get(`/calendar?days=${days}`);
    return response.data;
  },
};

export const chatApi = {
  sendMessage: async (message: string): Promise<ChatResponse> => {
    const response = await apiClient.post('/chat', { query: message });
    return response.data;
  },
};

export const travelApi = {
  calculateTime: async (origin: string, destination: string): Promise<TravelTimeResponse> => {
    const response = await apiClient.post('/travel-time', { origin, destination });
    return response.data;
  },
};

export const contextApi = {
  getAll: async () => {
    const response = await apiClient.get('/context');
    return response.data;
  },
}; 