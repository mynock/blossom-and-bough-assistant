import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

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
  id: number;
  clientId: string;
  name: string;
  address: string;
  geoZone: string;
  isRecurringMaintenance: boolean;
  maintenanceIntervalWeeks?: number;
  maintenanceHoursPerVisit?: string;
  maintenanceRate?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceTarget?: string;
  priorityLevel?: string;
  scheduleFlexibility?: string;
  preferredDays?: string;
  preferredTime?: string;
  specialNotes?: string;
  activeStatus: string;
  createdAt: string;
  updatedAt: string;
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

export const notionApi = {
  createSmartEntry: async (clientName: string): Promise<{
    success: boolean;
    page_url: string;
    carryover_tasks: string[];
    error?: string;
  }> => {
    console.log('NotionAPI: Making request to create smart entry');
    console.log('NotionAPI: Client name:', clientName);
    console.log('NotionAPI: Request URL:', `${API_BASE}/notion/create-smart-entry`);
    console.log('NotionAPI: User Agent:', navigator.userAgent);
    
    try {
      const response = await apiClient.post('/notion/create-smart-entry', {
        client_name: clientName,
      });
      
      console.log('NotionAPI: Response status:', response.status);
      console.log('NotionAPI: Response data:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('NotionAPI: Request failed');
      console.error('NotionAPI: Error:', error);
      console.error('NotionAPI: Error response:', (error as any)?.response);
      console.error('NotionAPI: Error status:', (error as any)?.response?.status);
      console.error('NotionAPI: Error data:', (error as any)?.response?.data);
      throw error;
    }
  },
  
  getClients: async (): Promise<{ clients: Client[] }> => {
    console.log('NotionAPI: Fetching clients list');
    console.log('NotionAPI: Request URL:', `${API_BASE}/notion/clients`);
    
    try {
      const response = await apiClient.get('/notion/clients');
      console.log('NotionAPI: Clients fetched successfully:', response.data.clients?.length || 0, 'clients');
      return response.data;
    } catch (error) {
      console.error('NotionAPI: Failed to fetch clients');
      console.error('NotionAPI: Error:', error);
      console.error('NotionAPI: Error response:', (error as any)?.response);
      throw error;
    }
  },
  
  healthCheck: async (): Promise<{
    status: string;
    notion_token_configured: boolean;
    notion_database_configured: boolean;
    ready: boolean;
  }> => {
    const response = await apiClient.get('/notion/health');
    return response.data;
  },
}; 