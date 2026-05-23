import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Chip,
  Stack,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  Button,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Close as CloseIcon,
  Done as DoneIcon,
  OpenInNew
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { notificationsApi, type Notification, type NotificationSeverity } from '../services/notifications';
import { useNotifications } from '../contexts/NotificationsContext';

type Filter = 'all' | 'unread' | 'dismissed';

function severityIcon(severity: NotificationSeverity) {
  switch (severity) {
    case 'error': return <ErrorIcon color="error" />;
    case 'warn': return <WarningIcon color="warning" />;
    default: return <InfoIcon color="info" />;
  }
}

function groupByDay(items: Notification[]): Array<{ day: string; items: Notification[] }> {
  const groups = new Map<string, Notification[]>();
  for (const n of items) {
    const day = new Date(n.createdAt).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(n);
  }
  return Array.from(groups.entries()).map(([day, items]) => ({ day, items }));
}

const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const { refresh, decrementUnread } = useNotifications();
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await notificationsApi.list({
        includeRead: true,
        includeDismissed: filter === 'dismissed',
        limit: 200
      });
      setItems(list);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'unread') return items.filter(n => !n.readAt && !n.dismissedAt);
    if (filter === 'dismissed') return items.filter(n => n.dismissedAt);
    return items.filter(n => !n.dismissedAt);
  }, [items, filter]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

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
    if (n.link) navigate(n.link);
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
      const now = new Date().toISOString();
      setItems(prev => prev.map(item => item.readAt ? item : { ...item, readAt: now }));
      decrementUnread(updated);
      refresh();
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Notifications</Typography>
        <Button startIcon={<DoneIcon />} onClick={handleMarkAllRead}>Mark all read</Button>
      </Box>

      <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
        <Chip label="All" color={filter === 'all' ? 'primary' : 'default'} onClick={() => setFilter('all')} />
        <Chip label="Unread" color={filter === 'unread' ? 'primary' : 'default'} onClick={() => setFilter('unread')} />
        <Chip label="Dismissed" color={filter === 'dismissed' ? 'primary' : 'default'} onClick={() => setFilter('dismissed')} />
      </Stack>

      {loading ? (
        <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : grouped.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">No notifications.</Typography>
        </Paper>
      ) : (
        grouped.map(({ day, items }) => (
          <Paper key={day} sx={{ mb: 3 }}>
            <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.100' }}>
              <Typography variant="subtitle2" color="text.secondary">{day}</Typography>
            </Box>
            <Divider />
            <List disablePadding>
              {items.map((n, idx) => (
                <React.Fragment key={n.id}>
                  <ListItem
                    onClick={() => handleRowClick(n)}
                    sx={{
                      cursor: n.link ? 'pointer' : 'default',
                      bgcolor: n.readAt || n.dismissedAt ? 'transparent' : 'action.hover',
                      alignItems: 'flex-start',
                      py: 1.5,
                      '&:hover': { bgcolor: 'action.selected' }
                    }}
                    secondaryAction={
                      !n.dismissedAt && (
                        <Tooltip title="Dismiss">
                          <IconButton edge="end" size="small" onClick={(e) => handleDismiss(e, n)} aria-label="dismiss">
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 40, mt: 0.5 }}>{severityIcon(n.severity)}</ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body1" fontWeight={n.readAt ? 400 : 600}>
                          {n.title}
                        </Typography>
                      }
                      secondary={
                        <>
                          {n.body && (
                            <Typography variant="body2" color="text.secondary" component="span" sx={{ display: 'block' }}>
                              {n.body}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.disabled" component="span" sx={{ display: 'block', mt: 0.5 }}>
                            {new Date(n.createdAt).toLocaleString()}
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
                                  source <OpenInNew sx={{ fontSize: 12, verticalAlign: 'middle' }} />
                                </a>
                              </>
                            )}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                  {idx < items.length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        ))
      )}
    </Container>
  );
};

export default Notifications;
