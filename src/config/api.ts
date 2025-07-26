// API Configuration
// This handles the difference between development and production environments

const isDevelopment = process.env.NODE_ENV === 'development';

// Check if we're using Create React App's proxy (package.json has "proxy" field)
// In development with proxy: Use relative URLs (proxy handles routing to backend)
// In development without proxy: Use full URLs to backend server
// In production: Use relative URLs (same origin)
export const API_BASE_URL = '';

// Helper function to create API URLs
export const createApiUrl = (endpoint: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  
  // Always use relative URLs now that we have proxy in development
  return `/${cleanEndpoint}`;
};

// Special helper for OAuth initiation (needs to bypass proxy in development)
export const createOAuthUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  
  if (isDevelopment) {
    // In development, OAuth initiation must bypass proxy to avoid redirect issues
    return `http://localhost:3001/${cleanEndpoint}`;
  } else {
    // In production, use relative URL (same origin)
    return `/${cleanEndpoint}`;
  }
};

// Common API endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH_STATUS: createApiUrl('api/auth/status'),
  AUTH_LOGIN: createOAuthUrl('api/auth/google'), // Special OAuth handling
  AUTH_LOGOUT: createApiUrl('api/auth/logout'),
  
  // Data
  WORK_ACTIVITIES: createApiUrl('api/work-activities'),
  CLIENTS: createApiUrl('api/clients'),
  EMPLOYEES: createApiUrl('api/employees'),
  PROJECTS: createApiUrl('api/projects'),
  
  // Notion Sync
  NOTION_SYNC_PAGE: createApiUrl('api/notion-sync/sync-page'),
  NOTION_SYNC_STATUS: createApiUrl('api/notion-sync/status'),
  
  // Debug
  DEBUG_SYSTEM_PROMPT: createApiUrl('api/debug/system-prompt'),
  MIGRATION_STATUS: createApiUrl('api/migration/status'),
  MIGRATION_SEED_RESET: createApiUrl('api/migration/seed-reset'),
} as const;

// Fetch wrapper with default options
export const apiClient = {
  get: (url: string, options?: RequestInit) => 
    fetch(url, { 
      credentials: 'include',
      ...options 
    }),
    
  post: (url: string, data?: any, options?: RequestInit) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }),
    
  put: (url: string, data?: any, options?: RequestInit) =>
    fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }),
    
  delete: (url: string, options?: RequestInit) =>
    fetch(url, {
      method: 'DELETE',
      credentials: 'include',
      ...options,
    }),
}; 