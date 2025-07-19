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
  ToggleButton,
  ToggleButtonGroup,
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
  Receipt as ReceiptIcon,
  AttachMoney as AttachMoneyIcon,
  CheckCircle as CheckCircleIcon,
  TableChart as TableChartIcon,
  ViewList as ViewListIcon,
  StickyNote2 as StickyNote2Icon,
} from '@mui/icons-material';
import { WorkActivitiesTable } from './WorkActivitiesTable';
import { ClientTasksList } from './ClientTasksList';
import { ClientNotesList } from './ClientNotesList';
import WorkActivityEditDialog from './WorkActivityEditDialog';
import { formatDatePacific } from '../utils/dateUtils';

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

  const [selectedActivitiesForInvoice, setSelectedActivitiesForInvoice] = useState<number[]>([]);
  const [invoiceCreationLoading, setInvoiceCreationLoading] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [useAIGeneration, setUseAIGeneration] = useState(false);
  const [workActivitiesView, setWorkActivitiesView] = useState<'table' | 'date' | 'notes'>('table');

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
    if (window.confirm(`Are you sure you want to delete this ${activity.workType} activity from ${formatDatePacific(activity.date)}?`)) {
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
        timeZone: 'America/Los_Angeles',
        weekday: 'short',
        month: 'short', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        timeZone: 'America/Los_Angeles',
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

  const completedActivities = workActivities.filter(activity => activity.status === 'completed');
  const readyToInvoiceActivities = completedActivities.filter(activity => 
    activity.billableHours && activity.billableHours > 0
  );

  // Removed unused invoice functions - now using new dialog implementation

  const handleCreateInvoiceConfirm = async () => {
    if (!client || selectedActivitiesForInvoice.length === 0) return;

    setInvoiceCreationLoading(true);
    try {
      const response = await fetch('/api/qbo/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: client.id,
          workActivityIds: selectedActivitiesForInvoice,
          includeOtherCharges: true,
          useAIGeneration: useAIGeneration,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSnackbar({ 
          open: true, 
          message: `Invoice created successfully! Invoice #${result.result.invoice.invoiceNumber}`, 
          severity: 'success' 
        });
        setShowInvoiceDialog(false);
        setSelectedActivitiesForInvoice([]);
        
        // Refresh work activities to update status
        if (id) {
          const activitiesResponse = await fetch(`/api/clients/${id}/work-activities`);
          if (activitiesResponse.ok) {
            const activitiesData = await activitiesResponse.json();
            setWorkActivities(activitiesData.activities);
            setSummary(activitiesData.summary);
          }
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create invoice');
      }
    } catch (error) {
      setSnackbar({ 
        open: true, 
        message: error instanceof Error ? error.message : 'Failed to create invoice', 
        severity: 'error' 
      });
    } finally {
      setInvoiceCreationLoading(false);
    }
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
                      <Typography variant="body1">{formatDatePacific(client.lastMaintenanceDate)}</Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarIcon color="action" />
                      <Typography variant="body2" color="text.secondary">Next Target:</Typography>
                      <Typography variant="body1">{formatDatePacific(client.nextMaintenanceTarget)}</Typography>
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

        {/* Work Activities */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5">Work Activities</Typography>
              <ToggleButtonGroup
                value={workActivitiesView}
                exclusive
                onChange={(event, newView) => {
                  if (newView !== null) {
                    setWorkActivitiesView(newView);
                  }
                }}
                size="small"
              >
                <ToggleButton value="table" aria-label="table view">
                  <TableChartIcon sx={{ mr: 1 }} />
                  Table View
                </ToggleButton>
                <ToggleButton value="date" aria-label="date view">
                  <ViewListIcon sx={{ mr: 1 }} />
                  Tasks List
                </ToggleButton>
                <ToggleButton value="notes" aria-label="notes view">
                  <StickyNote2Icon sx={{ mr: 1 }} />
                  Notes List
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            {workActivitiesView === 'table' ? (
              <WorkActivitiesTable
                activities={workActivities}
                onEdit={handleWorkActivityEdit}
                onDelete={handleWorkActivityDelete}
                showClientColumn={false}
                emptyMessage="No work activities found for this client."
              />
            ) : workActivitiesView === 'date' ? (
              <ClientTasksList
                activities={workActivities}
                emptyMessage="No tasks found for this client."
              />
            ) : (
              <ClientNotesList
                activities={workActivities}
                emptyMessage="No notes found for this client."
              />
            )}
          </Paper>
        </Grid>

        {/* Ready to Invoice Section */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ReceiptIcon sx={{ color: 'primary.main' }} />
                  <Typography variant="h6">Ready to Invoice</Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<AttachMoneyIcon />}
                  onClick={() => setShowInvoiceDialog(true)}
                  disabled={readyToInvoiceActivities.length === 0}
                >
                  Create Invoice
                </Button>
              </Box>
              
              {readyToInvoiceActivities.length > 0 ? (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {readyToInvoiceActivities.length} completed work {readyToInvoiceActivities.length === 1 ? 'activity' : 'activities'} ready to invoice
                  </Typography>
                  <Grid container spacing={2}>
                    {readyToInvoiceActivities.slice(0, 3).map((activity) => (
                      <Grid item xs={12} md={4} key={activity.id}>
                        <Paper sx={{ p: 2, bgcolor: 'success.50' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Typography variant="body2" fontWeight="medium">
                              {activity.workType.charAt(0).toUpperCase() + activity.workType.slice(1)}
                            </Typography>
                            <Chip
                              icon={<CheckCircleIcon />}
                              label="Completed"
                              color="success"
                              size="small"
                            />
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {formatDatePacific(activity.date)}
                          </Typography>
                          <Typography variant="body2" fontWeight="medium" sx={{ mt: 1 }}>
                            {activity.billableHours} hours
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                  {readyToInvoiceActivities.length > 3 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      ... and {readyToInvoiceActivities.length - 3} more activities
                    </Typography>
                  )}
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <ReceiptIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    No completed work activities ready to invoice
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Activities must be completed and have billable hours to be invoiced
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
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
                                {formatDatePacific(note.date)}
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
                        Created: {formatDatePacific(note.createdAt)}
                        {note.updatedAt !== note.createdAt && (
                          <span> • Updated: {formatDatePacific(note.updatedAt)}</span>
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



        {/* Invoice Creation Dialog */}
        <Dialog open={showInvoiceDialog} onClose={() => setShowInvoiceDialog(false)} maxWidth="lg" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
              Create Invoice
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Select work activities and customize invoice generation
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, py: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              
              {/* AI Enhancement Option */}
              <Paper sx={{ p: 2, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <input
                    type="checkbox"
                    id="useAI"
                    checked={useAIGeneration}
                    onChange={(e) => setUseAIGeneration(e.target.checked)}
                    style={{ marginTop: '2px', accentColor: '#2563eb' }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.800', mb: 0.5 }}>
                      ✨ AI-Enhanced Professional Descriptions
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                      Transforms basic work notes into detailed, professional invoice line items with specific tasks, dates, and value demonstration
                    </Typography>
                  </Box>
                </Box>
              </Paper>
              
              {/* Work Activities Selection */}
              <Box>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Select Work Activities
                </Typography>
                
                <Box sx={{ maxHeight: 400, overflowY: 'auto', border: '1px solid', borderColor: 'grey.300', borderRadius: 1 }}>
                  {readyToInvoiceActivities.map((activity, index) => (
                    <Box
                      key={activity.id}
                      sx={{
                        p: 2,
                        borderBottom: index < readyToInvoiceActivities.length - 1 ? '1px solid' : 'none',
                        borderColor: 'grey.200',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'grey.50' },
                        bgcolor: selectedActivitiesForInvoice.includes(activity.id) ? 'primary.50' : 'transparent'
                      }}
                      onClick={() => {
                        if (selectedActivitiesForInvoice.includes(activity.id)) {
                          setSelectedActivitiesForInvoice(selectedActivitiesForInvoice.filter(id => id !== activity.id));
                        } else {
                          setSelectedActivitiesForInvoice([...selectedActivitiesForInvoice, activity.id]);
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                        <input
                          type="checkbox"
                          checked={selectedActivitiesForInvoice.includes(activity.id)}
                          onChange={() => {}} // Handled by parent onClick
                          style={{ marginTop: '2px', accentColor: '#2563eb' }}
                        />
                        
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Box>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                {new Date(activity.date).toLocaleDateString('en-US', { 
                                  weekday: 'short', 
                                  month: 'short', 
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                <Box component="span" sx={{ fontWeight: 500 }}>
                                  {activity.billableHours || activity.totalHours}h
                                </Box>
                                {' @ '}
                                <Box component="span" sx={{ fontWeight: 500 }}>
                                  ${activity.hourlyRate || 55}/hr
                                </Box>
                                {' • '}
                                <Box component="span" sx={{ textTransform: 'capitalize' }}>
                                  {activity.workType.replace('_', ' ')}
                                </Box>
                              </Typography>
                            </Box>
                            
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography variant="h6" sx={{ fontWeight: 600, color: 'success.main' }}>
                                ${((activity.billableHours || activity.totalHours || 0) * (activity.hourlyRate || 55)).toFixed(2)}
                              </Typography>
                            </Box>
                          </Box>
                          
                          {(activity.notes || activity.tasks) && (
                            <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 0.5 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                                📝 {(activity.notes || activity.tasks || '').substring(0, 120)}
                                {(activity.notes || activity.tasks || '').length > 120 && '...'}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
              
              {/* Invoice Preview */}
              {selectedActivitiesForInvoice.length > 0 && (
                <Paper sx={{ p: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.300' }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Invoice Summary
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {selectedActivitiesForInvoice.length}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Activities
                        </Typography>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={6} sm={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: 'info.main' }}>
                          {readyToInvoiceActivities
                            .filter(a => selectedActivitiesForInvoice.includes(a.id))
                            .reduce((sum, a) => sum + (a.billableHours || a.totalHours || 0), 0)
                            .toFixed(1)}h
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Hours
                        </Typography>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h3" sx={{ fontWeight: 700, color: 'success.main' }}>
                          ${readyToInvoiceActivities
                            .filter(a => selectedActivitiesForInvoice.includes(a.id))
                            .reduce((sum, a) => sum + ((a.billableHours || a.totalHours || 0) * (a.hourlyRate || 55)), 0)
                            .toFixed(2)}
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                          Total Amount
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                  
                  {/* AI Enhancement Preview */}
                  {useAIGeneration && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'primary.50', borderRadius: 1, border: '1px solid', borderColor: 'primary.200' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.800' }}>
                          🤖 AI Enhancement Active
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                        Invoice descriptions will be enhanced with detailed task breakdowns, professional language, and value demonstration
                      </Typography>
                    </Box>
                  )}
                </Paper>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button 
              variant="outlined" 
              onClick={() => setShowInvoiceDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateInvoiceConfirm}
              variant="contained"
              disabled={selectedActivitiesForInvoice.length === 0 || invoiceCreationLoading}
            >
              {invoiceCreationLoading ? 'Creating Invoice...' : 'Create Invoice'}
            </Button>
          </DialogActions>
        </Dialog>
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