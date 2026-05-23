import { apiClient, API_ENDPOINTS } from './api';

export type NotificationSeverity = 'info' | 'warn' | 'error';

export interface Notification {
  id: number;
  type: string;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  link: string | null;
  sourceUrl: string | null;
  entityType: string | null;
  entityId: number | null;
  metadata: unknown;
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}

export const notificationsApi = {
  list: async (params: { includeRead?: boolean; includeDismissed?: boolean; limit?: number } = {}): Promise<Notification[]> => {
    const response = await apiClient.get<Notification[]>(API_ENDPOINTS.NOTIFICATIONS, { params });
    return response.data;
  },

  unreadCount: async (): Promise<number> => {
    const response = await apiClient.get<{ count: number }>(`${API_ENDPOINTS.NOTIFICATIONS}/unread-count`);
    return response.data.count;
  },

  markRead: async (id: number): Promise<Notification> => {
    const response = await apiClient.post<Notification>(`${API_ENDPOINTS.NOTIFICATIONS}/${id}/read`);
    return response.data;
  },

  dismiss: async (id: number): Promise<Notification> => {
    const response = await apiClient.post<Notification>(`${API_ENDPOINTS.NOTIFICATIONS}/${id}/dismiss`);
    return response.data;
  },

  markAllRead: async (): Promise<number> => {
    const response = await apiClient.post<{ updated: number }>(`${API_ENDPOINTS.NOTIFICATIONS}/read-all`);
    return response.data.updated;
  }
};
