import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Paper,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Stack,
} from '@mui/material';
import {
  ArrowBack,
  Assignment,
  AccessTime,
  AttachMoney,
  Person,
  Business,
  Edit,
  Delete,
  Schedule,
  CheckCircle,
  PendingActions,
  Cancel,
  Work,
  ExpandMore,
  LocalFlorist,
  ShoppingCart,
  Timeline,
  Sync,
} from '@mui/icons-material';
import { API_ENDPOINTS } from '../config/api';
import { formatDateLongPacific, formatDateTimePacific } from '../utils/dateUtils';

interface WorkActivity {
  id: number;
  workType: string;
  date: string;
  status: string;
  startTime: string | null;
  endTime: string | null;
  billableHours: number | null;
  totalHours: number;
  hourlyRate: number | null;
  projectId?: number;
  clientId?: number;
  travelTimeMinutes?: number;
  breakTimeMinutes?: number;
  notes: string | null;
  tasks: string | null;
  createdAt?: string;
  updatedAt?: string;
  notionPageId?: string;
  lastNotionSyncAt?: string;
  lastUpdatedBy?: 'web_app' | 'notion_sync';
  clientName?: string | null;
  projectName?: string | null;
  employeesList: Array<{ employeeId: number; employeeName: string | null; hours: number }>;
  chargesList: Array<{
    chargeType: string;
    description: string;
    quantity: number | null;
    unitRate: number | null;
    totalCost: number | null;
    billable: boolean;
  }>;
  plantsList: Array<{
    name: string;
    quantity: number;
  }>;
  totalCharges: number;
}

const WorkActivityDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<WorkActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_ENDPOINTS.WORK_ACTIVITIES}/${id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch work activity');
        }
        const data = await response.json();
        setActivity(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchActivity();
    }
  }, [id]);



  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'warning';
      case 'planned': return 'info';
      case 'invoiced': return 'primary';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle />;
      case 'in_progress': return <PendingActions />;
      case 'planned': return <Schedule />;
      case 'invoiced': return <AttachMoney />;
      case 'cancelled': return <Cancel />;
      default: return <Work />;
    }
  };

  const handleEdit = () => {
    navigate(`/work-activities?edit=${id}`);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this work activity?')) {
      try {
        const response = await fetch(`${API_ENDPOINTS.WORK_ACTIVITIES}/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          navigate('/work-activities');
        } else {
          throw new Error('Failed to delete work activity');
        }
      } catch (err) {
        console.error('Error deleting work activity:', err);
        alert('Failed to delete work activity');
      }
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading work activity details...
        </Typography>
      </Container>
    );
  }

  if (error || !activity) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Work activity not found'}
        </Alert>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/work-activities')}
          variant="outlined"
        >
          Back to Work Activities
        </Button>
      </Container>
    );
  }

  const totalEarnings = activity.employeesList.reduce((sum, emp) => 
    sum + (emp.hours * (activity.hourlyRate || 0)), 0
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton onClick={() => navigate('/work-activities')} sx={{ mr: 1 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" sx={{ flexGrow: 1 }}>
            Work Activity Details
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Edit />}
              onClick={handleEdit}
            >
              Edit
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Delete />}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </Box>
        </Box>
        <Typography variant="subtitle1" color="text.secondary">
          Activity #{activity.id} • {formatDateLongPacific(activity.date)}
        </Typography>
      </Box>

      {/* Status and Basic Info */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                {getStatusIcon(activity.status)}
              </Box>
              <Chip
                label={activity.status.replace('_', ' ').toUpperCase()}
                color={getStatusColor(activity.status) as any}
                sx={{ mb: 1 }}
              />
              <Typography variant="h6" gutterBottom>
                {activity.workType.replace('_', ' ').toUpperCase()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <AccessTime sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4">{activity.totalHours}h</Typography>
              <Typography variant="body2" color="text.secondary">
                Total Hours
              </Typography>
              {activity.billableHours && (
                <Typography variant="caption" color="success.main">
                  {activity.billableHours}h billable
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <AttachMoney sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography variant="h4">{formatCurrency(totalEarnings)}</Typography>
              <Typography variant="body2" color="text.secondary">
                Total Earnings
              </Typography>
              {activity.hourlyRate && (
                <Typography variant="caption" color="text.secondary">
                  ${activity.hourlyRate}/hr
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Person sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
              <Typography variant="h4">{activity.employeesList.length}</Typography>
              <Typography variant="body2" color="text.secondary">
                {activity.employeesList.length === 1 ? 'Employee' : 'Employees'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Left Column */}
        <Grid item xs={12} md={8}>
          {/* Client and Project Information */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Client & Project Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Business sx={{ mr: 1, color: 'text.secondary' }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Client
                      </Typography>
                      {activity.clientName && activity.clientId ? (
                        <Button
                          variant="text"
                          onClick={() => navigate(`/clients/${activity.clientId}`)}
                          sx={{ p: 0, textTransform: 'none', justifyContent: 'flex-start' }}
                        >
                          {activity.clientName}
                        </Button>
                      ) : (
                        <Typography variant="body1">
                          {activity.clientName || 'No Client'}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Assignment sx={{ mr: 1, color: 'text.secondary' }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Project
                      </Typography>
                      <Typography variant="body1">
                        {activity.projectName || 'No Project'}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Time Details */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Time Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Start Time
                  </Typography>
                  <Typography variant="body1">
                    {activity.startTime || 'Not specified'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    End Time
                  </Typography>
                  <Typography variant="body1">
                    {activity.endTime || 'Not specified'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Travel Time
                  </Typography>
                  <Typography variant="body1">
                    {activity.travelTimeMinutes ? `${activity.travelTimeMinutes} minutes` : 'None'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Break Time
                  </Typography>
                  <Typography variant="body1">
                    {activity.breakTimeMinutes ? `${activity.breakTimeMinutes} minutes` : 'None'}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Employees */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Employee Assignments
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Employee</TableCell>
                      <TableCell align="right">Hours</TableCell>
                      <TableCell align="right">Earnings</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activity.employeesList.map((emp, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Avatar sx={{ mr: 2, width: 32, height: 32 }}>
                              {emp.employeeName?.charAt(0) || 'U'}
                            </Avatar>
                            {emp.employeeName || `Employee ${emp.employeeId}`}
                          </Box>
                        </TableCell>
                        <TableCell align="right">{emp.hours}h</TableCell>
                        <TableCell align="right">
                          {formatCurrency(emp.hours * (activity.hourlyRate || 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Notes and Tasks */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">Notes & Tasks</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Notes
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50', minHeight: 100 }}>
                    <Typography variant="body2">
                      {activity.notes ? (
                        <div dangerouslySetInnerHTML={{ __html: activity.notes }} />
                      ) : (
                        <span style={{ color: 'text.secondary' }}>No notes available</span>
                      )}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Tasks
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50', minHeight: 100 }}>
                    <Typography variant="body2">
                      {activity.tasks ? (
                        <div dangerouslySetInnerHTML={{ __html: activity.tasks }} />
                      ) : (
                        <span style={{ color: 'text.secondary' }}>No tasks specified</span>
                      )}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} md={4}>
          {/* Other Charges */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <ShoppingCart sx={{ mr: 1, verticalAlign: 'middle' }} />
                Other Charges
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {activity.chargesList.length > 0 ? (
                <>
                  <List dense>
                    {activity.chargesList.map((charge, index) => (
                      <ListItem key={index} divider>
                        <ListItemText
                          primary={charge.description}
                          secondary={
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                {charge.quantity || 'N/A'}x {charge.unitRate ? formatCurrency(charge.unitRate) : 'N/A'} = {charge.totalCost ? formatCurrency(charge.totalCost) : 'N/A'}
                              </Typography>
                              {charge.billable && (
                                <Chip label="Billable" size="small" color="success" sx={{ ml: 1 }} />
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                  <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle2">
                      Total Charges: {formatCurrency(activity.totalCharges)}
                    </Typography>
                  </Box>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No charges recorded for this work activity
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Plants */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <LocalFlorist sx={{ mr: 1, verticalAlign: 'middle' }} />
                Plants Used
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {activity.plantsList.length > 0 ? (
                <List dense>
                  {activity.plantsList.map((plant, index) => (
                    <ListItem key={index} divider>
                      <ListItemIcon>
                        <LocalFlorist color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary={plant.name}
                        secondary={`Quantity: ${plant.quantity}`}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No plants used in this work activity
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* System Information */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Timeline sx={{ mr: 1, verticalAlign: 'middle' }} />
                System Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body1">
                    {activity.createdAt ? formatDateTimePacific(activity.createdAt) : 'Unknown'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Last Updated
                  </Typography>
                  <Typography variant="body1">
                    {activity.updatedAt ? formatDateTimePacific(activity.updatedAt) : 'Unknown'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Last Updated By
                  </Typography>
                  <Chip
                    label={activity.lastUpdatedBy === 'notion_sync' ? 'Notion Sync' : 'Web App'}
                    color={activity.lastUpdatedBy === 'notion_sync' ? 'info' : 'default'}
                    size="small"
                  />
                </Box>
                {activity.notionPageId && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Notion Integration
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Sync color="info" />
                      <Typography variant="body2">
                        Synced with Notion
                      </Typography>
                    </Box>
                    {activity.lastNotionSyncAt && (
                                          <Typography variant="caption" color="text.secondary">
                      Last sync: {formatDateTimePacific(activity.lastNotionSyncAt)}
                    </Typography>
                    )}
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default WorkActivityDetail;