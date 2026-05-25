import React, { useCallback, useEffect, useState } from 'react';
import {
  IconButton,
  Popover,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Button,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  Bell,
  Info as InfoIcon,
  AlertTriangle as WarningIcon,
  AlertCircle as ErrorIcon,
  X as CloseIcon,
  ExternalLink as OpenInNew
} from '../icons';
import { useNavigate } from 'react-router-dom';
import { notificationsApi, type Notification, type NotificationSeverity } from '../services/notifications';
import { useNotifications } from '../contexts/NotificationsContext';

const PANEL_LIMIT = 10;

function severityIcon(severity: NotificationSeverity) {
  switch (severity) {
    case 'error': return <ErrorIcon size={16} color="var(--bloom-600)" />;
    case 'warn': return <WarningIcon size={16} color="var(--honey-600)" />;
    default: return <InfoIcon size={16} color="var(--sky-600)" />;
  }
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { unreadCount, refresh, decrementUnread } = useNotifications();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const open = Boolean(anchorEl);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await notificationsApi.list({ limit: PANEL_LIMIT });
      setItems(list);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleRowClick = async (n: Notification) => {
    if (!n.readAt) {
      const wasUnread = !n.dismissedAt;
      try {
        await notificationsApi.markRead(n.id);
        setItems(prev => prev.map(item => item.id === n.id ? { ...item, readAt: new Date().toISOString() } : item));
        if (wasUnread) decrementUnread();
        refresh();
      } catch (err) {
        console.error('Failed to mark notification read', err);
      }
    }
    if (n.link) {
      handleClose();
      navigate(n.link);
    }
  };

  const handleDismiss = async (event: React.MouseEvent, n: Notification) => {
    event.stopPropagation();
    const wasUnread = !n.readAt && !n.dismissedAt;
    try {
      await notificationsApi.dismiss(n.id);
      setItems(prev => prev.filter(item => item.id !== n.id));
      if (wasUnread) decrementUnread();
      refresh();
    } catch (err) {
      console.error('Failed to dismiss notification', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const updated = await notificationsApi.markAllRead();
      setItems(prev => prev.map(item => item.readAt ? item : { ...item, readAt: new Date().toISOString() }));
      decrementUnread(updated);
      refresh();
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  const handleSeeAll = () => {
    handleClose();
    navigate('/notifications');
  };

  return (
    <>
      <Tooltip title="Notifications">
        <button
          type="button"
          className="gc-iconbtn"
          onClick={handleOpen}
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <Bell size={18} strokeWidth={1.6} />
          {unreadCount > 0 && <span className="dot" />}
        </button>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 380, maxHeight: 480 } } }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" fontWeight={600}>Notifications</Typography>
          <Button size="small" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
            Mark all read
          </Button>
        </Box>
        <Divider />

        {loading ? (
          <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">You're all caught up.</Typography>
          </Box>
        ) : (
          <List dense disablePadding sx={{ maxHeight: 340, overflowY: 'auto' }}>
            {items.map(n => (
              <ListItem
                key={n.id}
                onClick={() => handleRowClick(n)}
                sx={{
                  cursor: n.link ? 'pointer' : 'default',
                  bgcolor: n.readAt ? 'transparent' : 'action.hover',
                  alignItems: 'flex-start',
                  '&:hover': { bgcolor: 'action.selected' }
                }}
                secondaryAction={
                  <IconButton edge="end" size="small" onClick={(e) => handleDismiss(e, n)} aria-label="dismiss">
                    <CloseIcon size={14} />
                  </IconButton>
                }
              >
                <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                  {severityIcon(n.severity)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="body2" fontWeight={n.readAt ? 400 : 600}>
                      {n.title}
                    </Typography>
                  }
                  secondary={
                    <>
                      {n.body && (
                        <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block' }}>
                          {n.body}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.disabled" component="span" sx={{ display: 'block', mt: 0.5 }}>
                        {timeAgo(n.createdAt)}
                        {n.sourceUrl && (
                          <>
                            {' · '}
                            <a
                              href={n.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: 'inherit', textDecoration: 'underline' }}
                            >
                              source <OpenInNew size={10} style={{ verticalAlign: 'middle' }} />
                            </a>
                          </>
                        )}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}

        <Divider />
        <Box sx={{ p: 1, display: 'flex', justifyContent: 'center' }}>
          <Button size="small" onClick={handleSeeAll}>See all notifications</Button>
        </Box>
      </Popover>
    </>
  );
};

export default NotificationBell;
