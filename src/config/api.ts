/**
 * @deprecated This module is deprecated. Use '../services/api' instead.
 *
 * This file is being phased out in favor of the consolidated API client
 * in src/services/api.ts which uses Axios with proper interceptors.
 *
 * Migration guide:
 * - Replace `import { apiClient } from '../config/api'` with `import { apiClient } from '../services/api'`
 * - Replace `API_ENDPOINTS.X` with the corresponding function in services/api.ts
 * - For OAuth login URL, use `getOAuthLoginUrl()` from services/api.ts
 */

// SECURITY: legacy fetch client also attaches the CSRF token — see §1.5.
import { fetchCsrfToken } from '../services/csrf';

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

async function withCsrfHeader(extra: HeadersInit | undefined): Promise<HeadersInit> {
  try {
    const token = await fetchCsrfToken();
    return { ...(extra || {}), 'X-CSRF-Token': token };
  } catch {
    // See services/api.ts — graceful degradation for cross-site embed contexts.
    return { ...(extra || {}) };
  }
}

// Fetch wrapper with default options
export const apiClient = {
  get: (url: string, options?: RequestInit) =>
    fetch(url, {
      credentials: 'include',
      ...options
    }),

  post: async (url: string, data?: any, options?: RequestInit) =>
    fetch(url, {
      method: 'POST',
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(await withCsrfHeader(options?.headers)),
      },
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: async (url: string, data?: any, options?: RequestInit) =>
    fetch(url, {
      method: 'PUT',
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(await withCsrfHeader(options?.headers)),
      },
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: async (url: string, options?: RequestInit) =>
    fetch(url, {
      method: 'DELETE',
      credentials: 'include',
      ...options,
      headers: await withCsrfHeader(options?.headers),
    }),
};
