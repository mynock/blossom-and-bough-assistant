import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { notificationsApi } from '../services/notifications';
import { useAuth } from './AuthContext';

interface NotificationsContextType {
  unreadCount: number;
  refresh: () => Promise<void>;
  decrementUnread: (by?: number) => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

const POLL_INTERVAL_MS = 60_000;

export const NotificationsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const count = await notificationsApi.unreadCount();
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to fetch unread notification count', err);
    }
  }, [isAuthenticated]);

  const decrementUnread = useCallback((by: number = 1) => {
    setUnreadCount(prev => Math.max(0, prev - by));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    refresh();

    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      refresh();
    };
    intervalRef.current = setInterval(tick, POLL_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated, refresh]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, refresh, decrementUnread }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = (): NotificationsContextType => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
};
