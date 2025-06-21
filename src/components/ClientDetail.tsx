import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Divider,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Snackbar,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocationOn as LocationIcon,
  Flag as PriorityIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';

interface Client {
  id: number;
  clientId: string;
  name: string;
  address: string;
  geoZone: string;
  isRecurringMaintenance: boolean;
  maintenanceIntervalWeeks?: number;
  maintenanceHoursPerVisit?: string;
  maintenanceRate?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceTarget?: string;
  priorityLevel: 'High' | 'Medium' | 'Low';
  scheduleFlexibility?: string;
  preferredDays?: string;
  preferredTime?: string;
  specialNotes?: string;
  activeStatus: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

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
  clientName?: string | null;
  projectName?: string | null;
  employeesList: Array<{ employeeId: number; employeeName: string | null; hours: number }>;
  chargesList: Array<any>;
  totalCharges: number;
  notes: string | null;
  tasks: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface Summary {
  totalActivities: number;
  totalHours: number;
  totalBillableHours: number;
  totalCharges: number;
  statusBreakdown: Record<string, number>;
  workTypeBreakdown: Record<string, number>;
  lastActivityDate: string | null;
  yearToDateHours: number;
}

const WORK_TYPES = [
  'maintenance',
  'installation',
  'repair',
  'consultation',
  'design',
  'cleanup',
  'office_work',
  'travel',
  'other'
];

const WORK_STATUSES = [
  'planned',
  'in_progress',
  'completed',
  'invoiced',
  'cancelled'
];

const ClientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [workActivities, setWorkActivities] = useState<WorkActivity[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Client>>({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  // Work Activity edit state
  const [workActivityEditOpen, setWorkActivityEditOpen] = useState(false);
  const [selectedWorkActivity, setSelectedWorkActivity] = useState<WorkActivity | null>(null);
  const [workActivityFormData, setWorkActivityFormData] = useState<Partial<WorkActivity>>({});
  
  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchClientData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch client details
        const clientResponse = await fetch(`/api/clients/${id}`);
        if (!clientResponse.ok) throw new Error('Failed to fetch client');
        const clientData = await clientResponse.json();
        setClient(clientData);

        // Fetch work activities and summary
        const activitiesResponse = await fetch(`/api/clients/${id}/work-activities`);
        if (!activitiesResponse.ok) throw new Error('Failed to fetch work activities');
        const activitiesData = await activitiesResponse.json();
        setWorkActivities(activitiesData.activities);
        setSummary(activitiesData.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchClientData();
    }
  }, [id]);

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'error';
      case 'Medium': return 'warning';
      case 'Low': return 'success';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'primary';
      case 'planned': return 'warning';
      case 'invoiced': return 'secondary';
      default: return 'default';
    }
  };

  const handleEdit = () => {
    if (client) {
      setFormData(client);
      setEditDialogOpen(true);
    }
  };

  const handleInputChange = (field: keyof Client, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const updatedClient = await response.json();
        setClient(updatedClient);
        setSnackbar({ open: true, message: 'Client updated successfully', severity: 'success' });
        setEditDialogOpen(false);
      } else {
        throw new Error('Failed to save client');
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to save client', severity: 'error' });
    }
  };

  const handleWorkActivityEdit = (activity: WorkActivity) => {
    setSelectedWorkActivity(activity);
    setWorkActivityFormData(activity);
    setWorkActivityEditOpen(true);
  };

  const handleWorkActivityInputChange = (field: keyof WorkActivity, value: any) => {
    setWorkActivityFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleWorkActivitySave = async () => {
    try {
      const response = await fetch(`/api/work-activities/${selectedWorkActivity?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workActivityFormData),
      });

      if (response.ok) {
        setSnackbar({ open: true, message: 'Work activity updated successfully', severity: 'success' });
        setWorkActivityEditOpen(false);
        // Refresh work activities data
        if (id) {
          const activitiesResponse = await fetch(`/api/clients/${id}/work-activities`);
          if (activitiesResponse.ok) {
            const activitiesData = await activitiesResponse.json();
            setWorkActivities(activitiesData.activities);
            setSummary(activitiesData.summary);
          }
        }
      } else {
        throw new Error('Failed to save work activity');
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to save work activity', severity: 'error' });
    }
  };

  const handleWorkActivityDelete = async (activity: WorkActivity) => {
    if (window.confirm(`Are you sure you want to delete this ${activity.workType} activity from ${formatDate(activity.date)}?`)) {
      try {
        const response = await fetch(`/api/work-activities/${activity.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setSnackbar({ open: true, message: 'Work activity deleted successfully', severity: 'success' });
          // Refresh work activities data
          if (id) {
            const activitiesResponse = await fetch(`/api/clients/${id}/work-activities`);
            if (activitiesResponse.ok) {
              const activitiesData = await activitiesResponse.json();
              setWorkActivities(activitiesData.activities);
              setSummary(activitiesData.summary);
            }
          }
        } else {
          throw new Error('Failed to delete work activity');
        }
      } catch (error) {
        setSnackbar({ open: true, message: 'Failed to delete work activity', severity: 'error' });
      }
    }
  };

  const toggleRowExpansion = (activityId: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(activityId)) {
        newSet.delete(activityId);
      } else {
        newSet.add(activityId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !client) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Client not found'}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/clients')} sx={{ mt: 2 }}>
          Back to Clients
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/clients')} variant="outlined">
            Back
          </Button>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon /> {client.name}
          </Typography>
          <Chip 
            label={client.activeStatus} 
            color={client.activeStatus === 'active' ? 'success' : 'default'} 
            size="small" 
          />
        </Box>
        <Button startIcon={<EditIcon />} variant="contained" onClick={handleEdit}>
          Edit Client
        </Button>
      </Box>

      {/* Client Information */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Accordion defaultExpanded={false}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon /> Client Information
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon color="action" />
                  <Typography variant="body2" color="text.secondary">Client ID:</Typography>
                  <Typography variant="body1">{client.clientId}</Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocationIcon color="action" />
                  <Typography variant="body2" color="text.secondary">Address:</Typography>
                  <Typography variant="body1">{client.address}</Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocationIcon color="action" />
                  <Typography variant="body2" color="text.secondary">Zone:</Typography>
                  <Typography variant="body1">{client.geoZone}</Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PriorityIcon color="action" />
                  <Typography variant="body2" color="text.secondary">Priority:</Typography>
                  <Chip 
                    label={client.priorityLevel} 
                    color={getPriorityColor(client.priorityLevel) as any} 
                    size="small" 
                  />
                </Box>
                
                {client.preferredDays && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CalendarIcon color="action" />
                    <Typography variant="body2" color="text.secondary">Preferred Days:</Typography>
                    <Typography variant="body1">{client.preferredDays}</Typography>
                  </Box>
                )}
                
                {client.preferredTime && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ScheduleIcon color="action" />
                    <Typography variant="body2" color="text.secondary">Preferred Time:</Typography>
                    <Typography variant="body1">{client.preferredTime}</Typography>
                  </Box>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Grid>

        <Grid item xs={12} md={6}>
          <Accordion defaultExpanded={false}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon /> Maintenance Details
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <Box>
                  <Chip 
                    label={client.isRecurringMaintenance ? 'Recurring Maintenance' : 'One-time Service'} 
                    color={client.isRecurringMaintenance ? 'primary' : 'default'} 
                  />
                </Box>
                
                {client.isRecurringMaintenance && (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarIcon color="action" />
                      <Typography variant="body2" color="text.secondary">Interval:</Typography>
                      <Typography variant="body1">{client.maintenanceIntervalWeeks} weeks</Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ScheduleIcon color="action" />
                      <Typography variant="body2" color="text.secondary">Hours per Visit:</Typography>
                      <Typography variant="body1">{client.maintenanceHoursPerVisit || '-'}</Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <MoneyIcon color="action" />
                      <Typography variant="body2" color="text.secondary">Rate:</Typography>
                      <Typography variant="body1">{client.maintenanceRate || '-'}</Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarIcon color="action" />
                      <Typography variant="body2" color="text.secondary">Last Maintenance:</Typography>
                      <Typography variant="body1">{formatDate(client.lastMaintenanceDate)}</Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarIcon color="action" />
                      <Typography variant="body2" color="text.secondary">Next Target:</Typography>
                      <Typography variant="body1">{formatDate(client.nextMaintenanceTarget)}</Typography>
                    </Box>
                  </>
                )}
                
                {client.specialNotes && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>Special Notes:</Typography>
                    <Typography variant="body1">{client.specialNotes}</Typography>
                  </Box>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Summary Statistics */}
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ mt: 2 }}>Activity Summary</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <WorkIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                  <Typography variant="h4">{summary?.totalActivities || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">Total Activities</Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <ScheduleIcon sx={{ fontSize: 40, color: 'secondary.main' }} />
                  <Typography variant="h4">{summary?.totalHours.toFixed(1) || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">Total Hours</Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <MoneyIcon sx={{ fontSize: 40, color: 'success.main' }} />
                  <Typography variant="h4">{formatCurrency(summary?.totalCharges || 0)}</Typography>
                  <Typography variant="body2" color="text.secondary">Total Charges</Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <CalendarIcon sx={{ fontSize: 40, color: 'warning.main' }} />
                  <Typography variant="h4">{summary?.yearToDateHours.toFixed(1) || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">YTD Hours</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* Work Activities */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mt: 2 }}>
            <Typography variant="h5" gutterBottom>Work Activities</Typography>
            <Divider sx={{ mb: 2 }} />
            
            {workActivities.length === 0 ? (
              <Alert severity="info">No work activities found for this client.</Alert>
            ) : (
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table sx={{ minWidth: 800 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '10%' }}>Date</TableCell>
                      <TableCell sx={{ width: '10%' }}>Type</TableCell>
                      <TableCell sx={{ width: '10%' }}>Status</TableCell>
                      <TableCell sx={{ width: '12%' }}>Time</TableCell>
                      <TableCell sx={{ width: '8%' }}>Hours</TableCell>
                      <TableCell sx={{ width: '20%' }}>Employees</TableCell>
                      <TableCell sx={{ width: '10%' }}>Charges</TableCell>
                      <TableCell sx={{ width: '10%' }}>Notes/Tasks</TableCell>
                      <TableCell sx={{ width: '10%', textAlign: 'center' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {workActivities.map((activity) => (
                      <React.Fragment key={activity.id}>
                        <TableRow sx={{ '&:nth-of-type(odd)': { backgroundColor: 'action.hover' } }}>
                          <TableCell>{formatDate(activity.date)}</TableCell>
                          <TableCell>
                            <Chip label={activity.workType} size="small" />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={activity.status} 
                              color={getStatusColor(activity.status) as any} 
                              size="small" 
                            />
                          </TableCell>
                          <TableCell>
                            {activity.startTime && activity.endTime 
                              ? `${activity.startTime} - ${activity.endTime}`
                              : '-'
                            }
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{activity.totalHours}h</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {activity.employeesList.map((emp, index) => (
                                <Chip 
                                  key={index}
                                  label={emp.employeeName || 'Unknown'}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.75rem', height: '24px' }}
                                />
                              ))}
                            </Box>
                          </TableCell>
                          <TableCell>{formatCurrency(activity.totalCharges)}</TableCell>
                          <TableCell>
                            {(activity.notes || activity.tasks) ? (
                              <Button 
                                variant="text" 
                                size="small" 
                                onClick={() => toggleRowExpansion(activity.id)}
                                sx={{ minWidth: 'auto', p: 0.5 }}
                              >
                                {expandedRows.has(activity.id) ? 'Hide' : 'View'}
                              </Button>
                            ) : (
                              <Typography variant="body2" color="text.secondary">-</Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ textAlign: 'center' }}>
                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                              <IconButton onClick={() => handleWorkActivityEdit(activity)} size="small" color="primary">
                                <EditIcon />
                              </IconButton>
                              <IconButton onClick={() => handleWorkActivityDelete(activity)} size="small" color="error">
                                <DeleteIcon />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                        {expandedRows.has(activity.id) && (activity.notes || activity.tasks) && (
                          <TableRow>
                            <TableCell colSpan={9} sx={{ p: 0, borderBottom: 'none' }}>
                              <Box sx={{ p: 3, backgroundColor: 'grey.50', borderRadius: 1, m: 1 }}>
                                <Grid container spacing={3}>
                                  {activity.notes && (
                                    <Grid item xs={12} md={6}>
                                      <Box>
                                        <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                                          📝 Notes
                                        </Typography>
                                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                          {activity.notes}
                                        </Typography>
                                      </Box>
                                    </Grid>
                                  )}
                                  {activity.tasks && (
                                    <Grid item xs={12} md={activity.notes ? 6 : 12}>
                                      <Box>
                                        <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                                          ✓ Tasks
                                        </Typography>
                                        <Typography variant="body1" component="pre" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                          {activity.tasks}
                                        </Typography>
                                      </Box>
                                    </Grid>
                                  )}
                                </Grid>
                              </Box>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit {client?.name}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Name"
                fullWidth
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Client ID"
                fullWidth
                value={formData.clientId || ''}
                disabled
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Address"
                fullWidth
                value={formData.address || ''}
                onChange={(e) => handleInputChange('address', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Geographic Zone"
                fullWidth
                value={formData.geoZone || ''}
                onChange={(e) => handleInputChange('geoZone', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Priority Level</InputLabel>
                <Select
                  value={formData.priorityLevel || 'Medium'}
                  onChange={(e) => handleInputChange('priorityLevel', e.target.value)}
                >
                  <MenuItem value="High">High</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="Low">Low</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.activeStatus || 'active'}
                  onChange={(e) => handleInputChange('activeStatus', e.target.value)}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isRecurringMaintenance || false}
                    onChange={(e) => handleInputChange('isRecurringMaintenance', e.target.checked)}
                  />
                }
                label="Recurring Maintenance"
              />
            </Grid>
            {formData.isRecurringMaintenance && (
              <>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Interval (weeks)"
                    type="number"
                    fullWidth
                    value={formData.maintenanceIntervalWeeks || ''}
                    onChange={(e) => handleInputChange('maintenanceIntervalWeeks', parseInt(e.target.value))}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Hours per Visit"
                    fullWidth
                    value={formData.maintenanceHoursPerVisit || ''}
                    onChange={(e) => handleInputChange('maintenanceHoursPerVisit', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Maintenance Rate"
                    fullWidth
                    value={formData.maintenanceRate || ''}
                    onChange={(e) => handleInputChange('maintenanceRate', e.target.value)}
                  />
                </Grid>
              </>
            )}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Preferred Days"
                fullWidth
                value={formData.preferredDays || ''}
                onChange={(e) => handleInputChange('preferredDays', e.target.value)}
                placeholder="e.g., Monday Wednesday Friday"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Preferred Time"
                fullWidth
                value={formData.preferredTime || ''}
                onChange={(e) => handleInputChange('preferredTime', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Special Notes"
                fullWidth
                multiline
                rows={3}
                value={formData.specialNotes || ''}
                onChange={(e) => handleInputChange('specialNotes', e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Work Activity Edit Dialog */}
      <Dialog open={workActivityEditOpen} onClose={() => setWorkActivityEditOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Work Activity</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Date"
                type="date"
                fullWidth
                value={workActivityFormData.date || ''}
                onChange={(e) => handleWorkActivityInputChange('date', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Work Type</InputLabel>
                <Select
                  value={workActivityFormData.workType || ''}
                  onChange={(e) => handleWorkActivityInputChange('workType', e.target.value)}
                >
                  {WORK_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.replace('_', ' ').toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={workActivityFormData.status || ''}
                  onChange={(e) => handleWorkActivityInputChange('status', e.target.value)}
                >
                  {WORK_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status.replace('_', ' ').toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Total Hours"
                type="number"
                fullWidth
                value={workActivityFormData.totalHours || ''}
                onChange={(e) => handleWorkActivityInputChange('totalHours', parseFloat(e.target.value) || 0)}
                inputProps={{ step: 0.25, min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Start Time"
                type="time"
                fullWidth
                value={workActivityFormData.startTime || ''}
                onChange={(e) => handleWorkActivityInputChange('startTime', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="End Time"
                type="time"
                fullWidth
                value={workActivityFormData.endTime || ''}
                onChange={(e) => handleWorkActivityInputChange('endTime', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Billable Hours"
                type="number"
                fullWidth
                value={workActivityFormData.billableHours || ''}
                onChange={(e) => handleWorkActivityInputChange('billableHours', parseFloat(e.target.value) || 0)}
                inputProps={{ step: 0.25, min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Travel Time (minutes)"
                type="number"
                fullWidth
                value={workActivityFormData.travelTimeMinutes || ''}
                onChange={(e) => handleWorkActivityInputChange('travelTimeMinutes', parseInt(e.target.value) || 0)}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes"
                fullWidth
                multiline
                rows={3}
                value={workActivityFormData.notes || ''}
                onChange={(e) => handleWorkActivityInputChange('notes', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Tasks"
                fullWidth
                multiline
                rows={3}
                value={workActivityFormData.tasks || ''}
                onChange={(e) => handleWorkActivityInputChange('tasks', e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWorkActivityEditOpen(false)}>Cancel</Button>
          <Button onClick={handleWorkActivitySave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>



      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ClientDetail; 