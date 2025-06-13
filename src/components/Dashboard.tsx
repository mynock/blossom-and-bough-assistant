import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
} from '@mui/material';
import { People, Event, Business, Schedule } from '@mui/icons-material';
import { helpersApi, clientsApi, calendarApi, Helper, Client, CalendarEvent } from '../services/api';

interface DashboardStats {
  activeHelpers: number;
  activeClients: number;
  upcomingEvents: number;
  maintenanceClients: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    activeHelpers: 0,
    activeClients: 0,
    upcomingEvents: 0,
    maintenanceClients: 0,
  });
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [helpersData, clientsData, eventsData] = await Promise.all([
          helpersApi.getAll(),
          clientsApi.getAll(),
          calendarApi.getEvents(7),
        ]);

        setHelpers(helpersData.helpers);
        setClients(clientsData.clients);
        setEvents(eventsData.events);

        setStats({
          activeHelpers: helpersData.helpers.filter(h => h.status === 'active').length,
          activeClients: clientsData.clients.filter(c => c.status === 'active').length,
          upcomingEvents: eventsData.events.length,
          maintenanceClients: clientsData.clients.filter(c => c.maintenanceSchedule.isMaintenance).length,
        });
      } catch (err) {
        setError('Failed to load dashboard data. Make sure the backend server is running.');
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading dashboard...
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
        <Typography variant="body1">
          This is normal if you haven't started the backend server yet. The app includes mock data for demonstration.
        </Typography>
      </Container>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], {
      weekday: 'short',
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
      default: return 'default';
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Welcome back, Andrea! 🌿
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Here's your landscaping business overview
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Active Helpers
                  </Typography>
                  <Typography variant="h4">
                    {stats.activeHelpers}
                  </Typography>
                </Box>
                <People color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Active Clients
                  </Typography>
                  <Typography variant="h4">
                    {stats.activeClients}
                  </Typography>
                </Box>
                <Business color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Upcoming Events
                  </Typography>
                  <Typography variant="h4">
                    {stats.upcomingEvents}
                  </Typography>
                </Box>
                <Event color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Maintenance Clients
                  </Typography>
                  <Typography variant="h4">
                    {stats.maintenanceClients}
                  </Typography>
                </Box>
                <Schedule color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Helpers Overview */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Your Helpers
              </Typography>
              <List dense>
                {helpers.map((helper) => (
                  <ListItem key={helper.id} sx={{ px: 0 }}>
                    <ListItemText
                      primary={helper.name}
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {helper.workdays.join(', ')} • {helper.capabilityTier}
                          </Typography>
                          <Box sx={{ mt: 0.5 }}>
                            {helper.skills.slice(0, 3).map((skill) => (
                              <Chip
                                key={skill}
                                label={skill}
                                size="small"
                                sx={{ mr: 0.5, mb: 0.5, fontSize: '0.7rem' }}
                              />
                            ))}
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Upcoming Schedule */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Upcoming Schedule (Next 7 Days)
              </Typography>
              <List>
                {events.slice(0, 5).map((event) => (
                  <ListItem key={event.id} sx={{ px: 0 }}>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body1">{event.title}</Typography>
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
                            {formatDate(event.start)}
                          </Typography>
                          {event.location && (
                            <Typography variant="body2" color="text.secondary">
                              📍 {event.location}
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
      </Grid>
    </Container>
  );
};

export default Dashboard; 