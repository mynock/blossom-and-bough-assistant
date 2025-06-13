import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
  Grid,
} from '@mui/material';
import { calendarApi, CalendarEvent } from '../services/api';

const Schedule: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const data = await calendarApi.getEvents(14); // Next 2 weeks
        setEvents(data.events);
      } catch (err) {
        setError('Failed to load schedule. Make sure the backend server is running.');
        console.error('Schedule fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading schedule...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      </Container>
    );
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString([], {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEventTypeColor = (eventType: CalendarEvent['eventType']) => {
    switch (eventType) {
      case 'maintenance': return 'success';
      case 'client_visit': return 'primary';
      case 'office_work': return 'warning';
      case 'personal': return 'secondary';
      default: return 'default';
    }
  };

  const groupEventsByDate = (events: CalendarEvent[]) => {
    const grouped: { [key: string]: CalendarEvent[] } = {};
    events.forEach(event => {
      const date = new Date(event.start).toDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(event);
    });
    return grouped;
  };

  const groupedEvents = groupEventsByDate(events);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Schedule Overview
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Your upcoming appointments and tasks
      </Typography>

      <Grid container spacing={3}>
        {Object.entries(groupedEvents).map(([date, dayEvents]) => (
          <Grid item xs={12} key={date}>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {new Date(date).toLocaleDateString([], {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Typography>
                <List>
                  {dayEvents.map((event) => (
                    <ListItem key={event.id} sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                            <Typography variant="body1" component="span">
                              {event.title}
                            </Typography>
                            <Chip
                              label={event.eventType.replace('_', ' ')}
                              size="small"
                              color={getEventTypeColor(event.eventType)}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {new Date(event.start).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })} - {' '}
                              {new Date(event.end).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Typography>
                            {event.location && (
                              <Typography variant="body2" color="text.secondary">
                                📍 {event.location}
                              </Typography>
                            )}
                            {event.description && (
                              <Typography variant="body2" color="text.secondary">
                                {event.description}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {events.length === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              No upcoming events
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your schedule is clear! Use the AI Assistant to help plan new appointments.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Container>
  );
};

export default Schedule; 