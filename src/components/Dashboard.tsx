import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import { 
  Assignment,
  CloudUpload,
  Schedule,
  People,
  Business,
  Add,
  FileUpload,
  Analytics,
  Today,
  AccessTime,
  AttachMoney,
  ArrowForward,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS } from '../config/api';

interface WorkActivityStats {
  totalActivities: number;
  thisWeekActivities: number;
  totalHours: number;
  billableHours: number;
  recentActivities: Array<{
    id: number;
    date: string;
    workType: string;
    clientName: string;
    clientId?: number;
    totalHours: number;
    status: string;
  }>;
}

interface QuickStats {
  activeClients: number;
  activeEmployees: number;
  pendingActivities: number;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [workStats, setWorkStats] = useState<WorkActivityStats>({
    totalActivities: 0,
    thisWeekActivities: 0,
    totalHours: 0,
    billableHours: 0,
    recentActivities: [],
  });
  const [quickStats, setQuickStats] = useState<QuickStats>({
    activeClients: 0,
    activeEmployees: 0,
    pendingActivities: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch work activities and other data
        const [workActivitiesRes, clientsRes, employeesRes] = await Promise.all([
          fetch(API_ENDPOINTS.WORK_ACTIVITIES),
          fetch(API_ENDPOINTS.CLIENTS),
          fetch(API_ENDPOINTS.EMPLOYEES),
        ]);

        const workActivities = await workActivitiesRes.json();
        const clientsData = await clientsRes.json();
        const employeesData = await employeesRes.json();

        // Calculate work activity stats
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const thisWeekActivities = workActivities.filter((activity: any) => 
          new Date(activity.date) >= weekAgo
        );

        const totalHours = workActivities.reduce((sum: number, activity: any) => 
          sum + (activity.totalHours || 0), 0
        );

        const billableHours = workActivities.reduce((sum: number, activity: any) => 
          sum + (activity.billableHours || 0), 0
        );

        // Get recent activities (last 5)
        const recentActivities = workActivities
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 5)
          .map((activity: any) => ({
            id: activity.id,
            date: activity.date,
            workType: activity.workType,
            clientName: activity.clientName || 'No Client',
            clientId: activity.clientId,
            totalHours: activity.totalHours,
            status: activity.status,
          }));

        setWorkStats({
          totalActivities: workActivities.length,
          thisWeekActivities: thisWeekActivities.length,
          totalHours,
          billableHours,
          recentActivities,
        });

        setQuickStats({
          activeClients: clientsData.clients?.filter((c: any) => c.activeStatus === 'active').length || 0,
          activeEmployees: employeesData?.filter((e: any) => e.activeStatus === 'active').length || 0,
          pendingActivities: workActivities.filter((a: any) => a.status === 'planned').length,
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
          This is normal if you haven't started the backend server yet.
        </Typography>
      </Container>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'info';
      case 'in_progress': return 'primary';
      case 'completed': return 'success';
      case 'invoiced': return 'secondary';
      default: return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Work Activity Management 📋
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Transform your work notes into structured data for better business insights
        </Typography>
      </Box>

      {/* Primary Action Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <FileUpload sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Import Work Notes
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Upload PDF work notes and automatically extract structured activity data
                  </Typography>
                </Box>
              </Box>
              <Button 
                variant="contained" 
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
                startIcon={<CloudUpload />}
                onClick={() => navigate('/work-notes-import')}
                fullWidth
              >
                Import PDF Notes
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <Add sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Log Work Activity
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Manually record work activities with detailed time tracking and billing
                  </Typography>
                </Box>
              </Box>
              <Button 
                variant="contained" 
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
                startIcon={<Assignment />}
                onClick={() => navigate('/work-activities?create=true')}
                fullWidth
              >
                Log Activity
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Stats Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Activities
                  </Typography>
                  <Typography variant="h4">
                    {workStats.totalActivities}
                  </Typography>
                </Box>
                <Assignment color="primary" sx={{ fontSize: 40 }} />
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
                    This Week
                  </Typography>
                  <Typography variant="h4">
                    {workStats.thisWeekActivities}
                  </Typography>
                </Box>
                <Today color="primary" sx={{ fontSize: 40 }} />
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
                    Total Hours
                  </Typography>
                  <Typography variant="h4">
                    {workStats.totalHours.toFixed(1)}
                  </Typography>
                </Box>
                <AccessTime color="primary" sx={{ fontSize: 40 }} />
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
                    Billable Hours
                  </Typography>
                  <Typography variant="h4">
                    {workStats.billableHours.toFixed(1)}
                  </Typography>
                </Box>
                <AttachMoney color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Content Grid */}
      <Grid container spacing={3}>
        {/* Recent Activities */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h6">
                  Recent Work Activities
                </Typography>
                <Button 
                  size="small" 
                  endIcon={<ArrowForward />}
                  onClick={() => navigate('/work-activities')}
                >
                  View All
                </Button>
              </Box>
              
              {workStats.recentActivities.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Assignment sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No work activities yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Start by importing your PDF work notes or manually logging activities
                  </Typography>
                  <Button 
                    variant="contained" 
                    startIcon={<Add />}
                    onClick={() => navigate('/work-activities?create=true')}
                  >
                    Log First Activity
                  </Button>
                </Box>
              ) : (
                <List>
                  {workStats.recentActivities.map((activity, index) => (
                    <React.Fragment key={activity.id}>
                      <ListItem>
                        <ListItemIcon>
                          <Assignment color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="subtitle2">
                                {activity.workType.replace('_', ' ').toUpperCase()}
                              </Typography>
                              <Chip 
                                label={activity.status.replace('_', ' ').toUpperCase()} 
                                size="small"
                                color={getStatusColor(activity.status) as any}
                              />
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {activity.clientId && activity.clientName !== 'No Client' ? (
                                <Button 
                                  variant="text" 
                                  onClick={() => navigate(`/clients/${activity.clientId}`)}
                                  sx={{ 
                                    minHeight: 'auto',
                                    p: 0,
                                    textTransform: 'none',
                                    fontSize: '0.875rem',
                                    color: 'text.secondary',
                                    '&:hover': {
                                      color: 'primary.main',
                                      backgroundColor: 'transparent'
                                    }
                                  }}
                                >
                                  {activity.clientName}
                                </Button>
                              ) : (
                                <Typography component="span" variant="body2" color="text.secondary">
                                  {activity.clientName}
                                </Typography>
                              )}
                              <Typography component="span" variant="body2" color="text.secondary">
                                • {formatDate(activity.date)} • {activity.totalHours}h
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < workStats.recentActivities.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Stats & Actions */}
        <Grid item xs={12} md={4}>
          <Grid container spacing={2}>
            {/* Quick Stats */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Quick Stats
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Box display="flex" alignItems="center">
                        <Business sx={{ fontSize: 20, mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">Active Clients</Typography>
                      </Box>
                      <Typography variant="h6">{quickStats.activeClients}</Typography>
                    </Box>
                    <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Box display="flex" alignItems="center">
                        <People sx={{ fontSize: 20, mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">Active Employees</Typography>
                      </Box>
                      <Typography variant="h6">{quickStats.activeEmployees}</Typography>
                    </Box>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box display="flex" alignItems="center">
                        <Schedule sx={{ fontSize: 20, mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">Pending Activities</Typography>
                      </Box>
                      <Typography variant="h6">{quickStats.pendingActivities}</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Quick Actions */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Quick Actions
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button 
                      variant="outlined" 
                      startIcon={<Business />}
                      onClick={() => navigate('/clients')}
                      fullWidth
                    >
                      Manage Clients
                    </Button>
                    <Button 
                      variant="outlined" 
                      startIcon={<People />}
                      onClick={() => navigate('/employees')}
                      fullWidth
                    >
                      Manage Employees
                    </Button>
                    <Button 
                      variant="outlined" 
                      startIcon={<Analytics />}
                      onClick={() => navigate('/debug')}
                      fullWidth
                    >
                      View Reports
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard; 