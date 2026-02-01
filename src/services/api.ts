import axios, { AxiosError } from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '/api';
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Main API client using Axios.
 * Configured with credentials for session-based auth.
 */
const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies for session auth
});

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    console.error('API Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    throw error;
  }
);

/**
 * API Endpoints - Common paths for API calls.
 * Use these constants to ensure consistency across the application.
 */
export const API_ENDPOINTS = {
  // Auth
  AUTH_STATUS: '/auth/status',
  AUTH_LOGOUT: '/auth/logout',

  // Data
  WORK_ACTIVITIES: '/work-activities',
  CLIENTS: '/clients',
  EMPLOYEES: '/employees',
  PROJECTS: '/projects',

  // Notion Sync
  NOTION_SYNC_PAGE: '/notion-sync/sync-page',
  NOTION_SYNC_STATUS: '/notion-sync/status',

  // Settings & Admin
  SETTINGS: '/settings',
  MIGRATION_STATUS: '/migration/status',
  MIGRATION_SEED_RESET: '/migration/seed-reset',

  // Debug
  DEBUG_SYSTEM_PROMPT: '/debug/system-prompt',
} as const;

/**
 * Get the OAuth login URL.
 * In development, this bypasses the proxy to avoid redirect issues.
 */
export const getOAuthLoginUrl = (): string => {
  if (isDevelopment) {
    return 'http://localhost:3001/api/auth/google';
  }
  return '/api/auth/google';
};

/**
 * Export the raw apiClient for components that need direct access.
 * Prefer using the typed API functions below when possible.
 */
export { apiClient };

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

// Authentication API
export interface AuthUser {
  email: string;
  name?: string;
  picture?: string;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  user?: AuthUser;
}

export const authApi = {
  /**
   * Check current authentication status.
   */
  getStatus: async (): Promise<AuthStatus> => {
    const response = await apiClient.get(API_ENDPOINTS.AUTH_STATUS);
    return response.data;
  },

  /**
   * Log out the current user.
   */
  logout: async (): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.AUTH_LOGOUT);
  },

  /**
   * Get the URL for OAuth login.
   * Use this for redirecting to Google OAuth.
   */
  getLoginUrl: getOAuthLoginUrl,
};

// Settings API
export interface AppSettings {
  [key: string]: any;
}

export const settingsApi = {
  getAll: async (): Promise<AppSettings> => {
    const response = await apiClient.get(API_ENDPOINTS.SETTINGS);
    return response.data;
  },

  update: async (settings: Partial<AppSettings>): Promise<AppSettings> => {
    const response = await apiClient.put(API_ENDPOINTS.SETTINGS, settings);
    return response.data;
  },
};

// Work Activities API
export interface WorkActivity {
  id: number;
  workType: string;
  date: string;
  status: string;
  totalHours: number;
  billableHours?: number;
  clientId?: number;
  clientName?: string;
  projectId?: number;
  projectName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const workActivitiesApi = {
  getAll: async (filters?: {
    startDate?: string;
    endDate?: string;
    workType?: string;
    status?: string;
    clientId?: number;
    employeeId?: number;
  }): Promise<WorkActivity[]> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.workType) params.append('workType', filters.workType);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.clientId) params.append('clientId', filters.clientId.toString());
    if (filters?.employeeId) params.append('employeeId', filters.employeeId.toString());

    const queryString = params.toString();
    const url = queryString ? `${API_ENDPOINTS.WORK_ACTIVITIES}?${queryString}` : API_ENDPOINTS.WORK_ACTIVITIES;
    const response = await apiClient.get(url);
    return response.data;
  },

  getById: async (id: number): Promise<WorkActivity> => {
    const response = await apiClient.get(`${API_ENDPOINTS.WORK_ACTIVITIES}/${id}`);
    return response.data;
  },

  create: async (data: {
    workActivity: Partial<WorkActivity>;
    employees: Array<{ employeeId: number; hours: number }>;
    charges?: any[];
  }): Promise<WorkActivity> => {
    const response = await apiClient.post(API_ENDPOINTS.WORK_ACTIVITIES, data);
    return response.data;
  },

  update: async (id: number, data: Partial<WorkActivity>): Promise<WorkActivity> => {
    const response = await apiClient.put(`${API_ENDPOINTS.WORK_ACTIVITIES}/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`${API_ENDPOINTS.WORK_ACTIVITIES}/${id}`);
  },
};

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

export const employeesApi = {
  getAll: async (): Promise<{ employees: Array<{ id: number; name: string }> }> => {
    const response = await apiClient.get('/employees');
    // Transform the Employee objects to just id and name
    const employees = response.data.map((emp: any) => ({
      id: emp.id,
      name: emp.name
    }));
    return { employees };
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

// Reports API
export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  clientId?: number;
  employeeId?: number;
  dayOfWeek?: string;
}

export interface TimeSeriesDataPoint {
  date: string;
  billableHours: number;
  totalHours: number;
  travelTimeHours: number;
  breakTimeHours: number;
  clientName?: string;
  employeeName?: string;
}

export interface ReportSummary {
  totalBillableHours: number;
  totalHours: number;
  totalTravelTimeHours: number;
  totalBreakTimeHours: number;
  totalActivities: number;
  averageHoursPerActivity: number;
  clientBreakdown: Array<{
    clientId: number;
    clientName: string;
    billableHours: number;
    totalHours: number;
    activities: number;
  }>;
  employeeBreakdown: Array<{
    employeeId: number;
    employeeName: string;
    billableHours: number;
    totalHours: number;
    activities: number;
  }>;
  dayOfWeekBreakdown: Array<{
    dayOfWeek: string;
    billableHours: number;
    totalHours: number;
    activities: number;
  }>;
}

export const reportsApi = {
  getTimeSeriesData: async (filters?: ReportFilters, groupBy: string = 'day'): Promise<TimeSeriesDataPoint[]> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.clientId) params.append('clientId', filters.clientId.toString());
    if (filters?.employeeId) params.append('employeeId', filters.employeeId.toString());
    if (filters?.dayOfWeek) params.append('dayOfWeek', filters.dayOfWeek);
    params.append('groupBy', groupBy);

    const response = await apiClient.get(`/reports/time-series?${params.toString()}`);
    return response.data;
  },

  getSummaryData: async (filters?: ReportFilters): Promise<ReportSummary> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.clientId) params.append('clientId', filters.clientId.toString());
    if (filters?.employeeId) params.append('employeeId', filters.employeeId.toString());
    if (filters?.dayOfWeek) params.append('dayOfWeek', filters.dayOfWeek);

    const response = await apiClient.get(`/reports/summary?${params.toString()}`);
    return response.data;
  },
}; 