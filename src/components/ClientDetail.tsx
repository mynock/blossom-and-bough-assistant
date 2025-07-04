import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Button,
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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  Schedule as ScheduleIcon,
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  LocationOn as LocationIcon,
  Flag as PriorityIcon,
  CalendarToday as CalendarIcon,
  Note as NoteIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { WorkActivitiesTable } from './WorkActivitiesTable';
import WorkActivityEditDialog from './WorkActivityEditDialog';

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
  plantsList: Array<any>;
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

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  eventType?: string;
}

interface ClientNote {
  id: number;
  clientId: number;
  noteType: string;
  title: string;
  content: string;
  date: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NewClientNote {
  noteType: string;
  title: string;
  content: string;
  date?: string;
}

interface UpcomingScheduleData {
  upcomingEvents: CalendarEvent[];
  client: {
    id: number;
    name: string;
    clientId: string;
  };
  dateRange: {
    startDate: string;
    endDate: string;
    daysAhead: number;
  };
}

const NOTE_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'meeting', label: 'Meeting Notes' },
  { value: 'property_info', label: 'Property Information' },
  { value: 'client_preferences', label: 'Client Preferences' },
  { value: 'maintenance_notes', label: 'Maintenance Notes' },
  { value: 'issue_report', label: 'Issue Report' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'contact_info', label: 'Contact Information' },
  { value: 'special_instructions', label: 'Special Instructions' },
];

const ClientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [workActivities, setWorkActivities] = useState<WorkActivity[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [upcomingSchedule, setUpcomingSchedule] = useState<UpcomingScheduleData | null>(null);
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Client>>({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  // Work Activity edit state
  const [workActivityEditOpen, setWorkActivityEditOpen] = useState(false);
  const [selectedWorkActivity, setSelectedWorkActivity] = useState<WorkActivity | null>(null);
  
  // Notes state
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteFormData, setNoteFormData] = useState<NewClientNote>({
    noteType: 'general',
    title: '',
    content: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [editingNote, setEditingNote] = useState<ClientNote | null>(null);

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

        // Fetch upcoming schedule
        const scheduleResponse = await fetch(`/api/clients/${id}/upcoming-schedule?days=30`);
        if (scheduleResponse.ok) {
          const scheduleData = await scheduleResponse.json();
          setUpcomingSchedule(scheduleData);
        } else {
          console.warn('Failed to fetch upcoming schedule, continuing without it');
        }

        // Fetch client notes
        const notesResponse = await fetch(`/api/clients/${id}/notes`);
        if (notesResponse.ok) {
          const notesData = await notesResponse.json();
          setClientNotes(notesData.notes);
        } else {
          console.warn('Failed to fetch client notes, continuing without them');
        }
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'error';
      case 'Medium': return 'warning';
      case 'Low': return 'success';
      default: return 'default';
    }
  };

  const getNoteTypeLabel = (noteType: string) => {
    const type = NOTE_TYPES.find(t => t.value === noteType);
    return type ? type.label : noteType;
  };

  const getNoteTypeColor = (noteType: string) => {
    switch (noteType) {
      case 'issue_report': return 'error';
      case 'follow_up': return 'warning';
      case 'meeting': return 'info';
      case 'maintenance_notes': return 'success';
      case 'client_preferences': return 'secondary';
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
    setWorkActivityEditOpen(true);
  };

  const handleWorkActivitySave = async (
    activity: WorkActivity, 
    employees: Array<{ employeeId: number; hours: number }>, 
    charges: Array<any>, 
    plants: Array<any>
  ) => {
    const response = await fetch(`/api/work-activities/${selectedWorkActivity?.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(activity),
    });

    if (!response.ok) {
      throw new Error('Failed to save work activity');
    }

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

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    };
  };

  const handleNoteEdit = (note: ClientNote) => {
    setEditingNote(note);
    setNoteFormData({
      noteType: note.noteType,
      title: note.title,
      content: note.content,
      date: note.date || new Date().toISOString().split('T')[0]
    });
    setNoteDialogOpen(true);
  };

  const handleNoteDelete = async (noteId: number) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      try {
        const response = await fetch(`/api/clients/${id}/notes/${noteId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setClientNotes(clientNotes.filter(note => note.id !== noteId));
          setSnackbar({ open: true, message: 'Note deleted successfully', severity: 'success' });
        } else {
          throw new Error('Failed to delete note');
        }
      } catch (error) {
        setSnackbar({ open: true, message: 'Failed to delete note', severity: 'error' });
      }
    }
  };

  const handleNoteSave = async () => {
    try {
      const url = editingNote 
        ? `/api/clients/${id}/notes/${editingNote.id}`
        : `/api/clients/${id}/notes`;
      
      const method = editingNote ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(noteFormData),
      });

      if (response.ok) {
        const savedNote = await response.json();
        
        if (editingNote) {
          setClientNotes(clientNotes.map(note => 
            note.id === editingNote.id ? savedNote : note
          ));
          setSnackbar({ open: true, message: 'Note updated successfully', severity: 'success' });
        } else {
          setClientNotes([savedNote, ...clientNotes]);
          setSnackbar({ open: true, message: 'Note created successfully', severity: 'success' });
        }
        
        setNoteDialogOpen(false);
        setEditingNote(null);
        setNoteFormData({
          noteType: 'general',
          title: '',
          content: '',
          date: new Date().toISOString().split('T')[0]
        });
      } else {
        throw new Error('Failed to save note');
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to save note', severity: 'error' });
    }
  };

  const handleAddNote = () => {
    setEditingNote(null);
    setNoteFormData({
      noteType: 'general',
      title: '',
      content: '',
      date: new Date().toISOString().split('T')[0]
    });
    setNoteDialogOpen(true);
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
                      <ScheduleIcon color="action" />
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
                  <ScheduleIcon sx={{ fontSize: 40, color: 'info.main' }} />
                  <Typography variant="h4">{summary?.totalBillableHours.toFixed(1) || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">Total Billable Hours</Typography>
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

        {/* Upcoming Schedule */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarIcon color="primary" />
                Upcoming Schedule
                {upcomingSchedule && (
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    ({upcomingSchedule.upcomingEvents.length} event{upcomingSchedule.upcomingEvents.length !== 1 ? 's' : ''} in next 30 days)
                  </Typography>
                )}
              </Typography>
              
              {upcomingSchedule && upcomingSchedule.upcomingEvents.length > 0 ? (
                <Stack spacing={1}>
                  {upcomingSchedule.upcomingEvents.slice(0, 5).map((event) => {
                    const { date, time } = formatDateTime(event.start);
                    return (
                      <Box key={event.id} sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 2,
                        p: 1,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        backgroundColor: 'background.default'
                      }}>
                        <Box sx={{ minWidth: 80 }}>
                          <Typography variant="body2" color="primary" fontWeight="bold">
                            {date}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {time}
                          </Typography>
                        </Box>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body1" fontWeight="medium">
                            {event.title}
                          </Typography>
                          {event.location && (
                            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <LocationIcon fontSize="small" />
                              {event.location}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                  {upcomingSchedule.upcomingEvents.length > 5 && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 1 }}>
                      ... and {upcomingSchedule.upcomingEvents.length - 5} more events
                    </Typography>
                  )}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No upcoming scheduled events found for this client.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Client Notes */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <NoteIcon color="primary" />
                  Client Notes
                  {clientNotes.length > 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      ({clientNotes.length})
                    </Typography>
                  )}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddNote}
                  size="small"
                >
                  Add Note
                </Button>
              </Box>
              
              {clientNotes.length > 0 ? (
                <Stack spacing={2}>
                  {clientNotes.map((note) => (
                    <Box key={note.id} sx={{ 
                      p: 2,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      backgroundColor: 'background.default'
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                            {note.title}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                            <Chip 
                              label={getNoteTypeLabel(note.noteType)} 
                              size="small" 
                              variant="outlined" 
                              color={getNoteTypeColor(note.noteType) as any}
                            />
                            {note.date && (
                              <Typography variant="body2" color="text.secondary">
                                {formatDate(note.date)}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            startIcon={<EditIcon />}
                            onClick={() => handleNoteEdit(note)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            startIcon={<DeleteIcon />}
                            onClick={() => handleNoteDelete(note.id)}
                            color="error"
                          >
                            Delete
                          </Button>
                        </Box>
                      </Box>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {note.content}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Created: {formatDate(note.createdAt)}
                        {note.updatedAt !== note.createdAt && (
                          <span> • Updated: {formatDate(note.updatedAt)}</span>
                        )}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No notes found for this client. Click "Add Note" to create one.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Work Activities */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mt: 2 }}>
            <Typography variant="h5" gutterBottom>Work Activities</Typography>
            <Divider sx={{ mb: 2 }} />
            
            <WorkActivitiesTable
              activities={workActivities}
              onEdit={handleWorkActivityEdit}
              onDelete={handleWorkActivityDelete}
              showClientColumn={false}
              emptyMessage="No work activities found for this client."
            />
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
      <WorkActivityEditDialog
        open={workActivityEditOpen}
        onClose={() => setWorkActivityEditOpen(false)}
        activity={selectedWorkActivity}
        isCreating={false}
        onSave={handleWorkActivitySave}
        clients={client ? [{ id: client.id, clientId: client.clientId, name: client.name }] : []}
        projects={[]}
        employees={[]}
        onShowSnackbar={(message, severity) => setSnackbar({ open: true, message, severity: severity === 'warning' ? 'error' : severity })}
      />

      {/* Notes Dialog */}
      <Dialog open={noteDialogOpen} onClose={() => setNoteDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingNote ? 'Edit Note' : 'Add New Note'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Note Type</InputLabel>
                <Select
                  value={noteFormData.noteType}
                  onChange={(e) => setNoteFormData(prev => ({ ...prev, noteType: e.target.value }))}
                >
                  {NOTE_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Date"
                type="date"
                fullWidth
                value={noteFormData.date}
                onChange={(e) => setNoteFormData(prev => ({ ...prev, date: e.target.value }))}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Title"
                fullWidth
                value={noteFormData.title}
                onChange={(e) => setNoteFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Brief description of the note"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Content"
                fullWidth
                multiline
                rows={6}
                value={noteFormData.content}
                onChange={(e) => setNoteFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Detailed notes, observations, or information..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleNoteSave} 
            variant="contained"
            disabled={!noteFormData.title.trim() || !noteFormData.content.trim()}
          >
            {editingNote ? 'Update' : 'Save'}
          </Button>
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