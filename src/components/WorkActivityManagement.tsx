import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  IconButton,
  Alert,
  Snackbar,
  Grid,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Autocomplete,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Assignment as AssignmentIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  Remove as RemoveIcon,
} from '@mui/icons-material';
import { Client } from '../services/api';
import { API_ENDPOINTS, apiClient } from '../config/api';
import { useSearchParams } from 'react-router-dom';
import { Editor } from 'react-draft-wysiwyg';
import { EditorState, convertToRaw, ContentState } from 'draft-js';
import draftToHtml from 'draftjs-to-html';
import htmlToDraft from 'html-to-draftjs';
import 'react-draft-wysiwyg/dist/react-draft-wysiwyg.css';
import FilterableTable, { FilterConfig, ColumnConfig } from './FilterableTable';

interface WorkActivity {
  id: number;
  workType: string;
  date: string;
  status: string;
  startTime?: string;
  endTime?: string;
  billableHours?: number;
  totalHours: number;
  hourlyRate?: number;
  projectId?: number;
  clientId?: number;
  travelTimeMinutes?: number;
  breakTimeMinutes?: number;
  notes?: string;
  tasks?: string;
  createdAt: string;
  updatedAt: string;
  clientName?: string | null;
  projectName?: string | null;
  employeesList: Array<{ employeeId: number; employeeName: string | null; hours: number }>;
  chargesList: Array<any>;
  totalCharges: number;
}

interface Project {
  id: number;
  name: string;
  clientId: number;
}

interface Employee {
  id: number;
  name: string;
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

const WorkActivityManagement: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [workActivities, setWorkActivities] = useState<WorkActivity[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<WorkActivity | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Form state
  const [formData, setFormData] = useState<Partial<WorkActivity>>({
    workType: 'maintenance',
    date: new Date().toISOString().split('T')[0],
    status: 'planned',
    totalHours: 8,
    billableHours: 8,
    travelTimeMinutes: 0,
    breakTimeMinutes: 30,
  });

  const [selectedEmployees, setSelectedEmployees] = useState<Array<{ employeeId: number; hours: number }>>([]);
  
  // State for employee selection dropdown
  const [employeeToAdd, setEmployeeToAdd] = useState<number | ''>('');
  
  // Editor states for WYSIWYG
  const [notesEditorState, setNotesEditorState] = useState(() => EditorState.createEmpty());
  const [tasksEditorState, setTasksEditorState] = useState(() => EditorState.createEmpty());

  // Helper function to convert HTML to EditorState
  const htmlToEditorState = (html: string) => {
    if (!html) return EditorState.createEmpty();
    const contentBlock = htmlToDraft(html);
    if (contentBlock) {
      const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
      return EditorState.createWithContent(contentState);
    }
    return EditorState.createEmpty();
  };

  // Helper function to convert EditorState to HTML
  const editorStateToHtml = (editorState: EditorState) => {
    return draftToHtml(convertToRaw(editorState.getCurrentContent()));
  };

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const fetchWorkActivities = useCallback(async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.WORK_ACTIVITIES);
      const data = await response.json();
      setWorkActivities(data);
    } catch (error) {
      showSnackbar('Failed to fetch work activities', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    fetchWorkActivities();
    fetchClients();
    fetchProjects();
    fetchEmployees();
  }, [fetchWorkActivities]);

  // Check for create parameter and auto-open dialog
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      // Set a flag to open the dialog on next render
      setIsCreating(true);
      setEditDialogOpen(true);
      setSelectedActivity(null);
      setFormData({
        workType: 'maintenance',
        date: new Date().toISOString().split('T')[0],
        status: 'planned',
        totalHours: 8,
        billableHours: 8,
        travelTimeMinutes: 0,
        breakTimeMinutes: 30,
      });
      setSelectedEmployees([]);
      // Reset editor states
      setNotesEditorState(EditorState.createEmpty());
      setTasksEditorState(EditorState.createEmpty());
      // Reset employee dropdown
      setEmployeeToAdd('');
      // Remove the parameter from URL without triggering navigation
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const fetchClients = async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.CLIENTS);
      const data = await response.json();
      setClients(data.clients);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.PROJECTS);
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.EMPLOYEES);
      const data = await response.json();
      setEmployees(data);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const handleEdit = (activity: WorkActivity) => {
    setSelectedActivity(activity);
    setFormData(activity);
    setSelectedEmployees(activity.employeesList.map(emp => ({
      employeeId: emp.employeeId,
      hours: emp.hours
    })));
    // Initialize editor states with existing content
    setNotesEditorState(htmlToEditorState(activity.notes || ''));
    setTasksEditorState(htmlToEditorState(activity.tasks || ''));
    // Reset employee dropdown
    setEmployeeToAdd('');
    setIsCreating(false);
    setEditDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedActivity(null);
    setFormData({
      workType: 'maintenance',
      date: new Date().toISOString().split('T')[0],
      status: 'planned',
      totalHours: 8,
      billableHours: 8,
      travelTimeMinutes: 0,
      breakTimeMinutes: 30,
    });
    setSelectedEmployees([]);
    // Reset editor states
    setNotesEditorState(EditorState.createEmpty());
    setTasksEditorState(EditorState.createEmpty());
    // Reset employee dropdown
    setEmployeeToAdd('');
    setIsCreating(true);
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (selectedEmployees.length === 0) {
        showSnackbar('At least one employee must be assigned', 'error');
        return;
      }

      const requestData = {
        workActivity: formData,
        employees: selectedEmployees,
        charges: [] // TODO: Add charges support
      };

      const url = isCreating ? '/api/work-activities' : `/api/work-activities/${selectedActivity?.id}`;
      const method = isCreating ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(isCreating ? requestData : formData),
      });

      if (response.ok) {
        showSnackbar(
          isCreating ? 'Work activity created successfully' : 'Work activity updated successfully',
          'success'
        );
        setEditDialogOpen(false);
        fetchWorkActivities();
      } else {
        throw new Error('Failed to save work activity');
      }
    } catch (error) {
      showSnackbar('Failed to save work activity', 'error');
    }
  };

  const handleDelete = async (activity: WorkActivity) => {
    if (window.confirm(`Are you sure you want to delete this ${activity.workType} activity?`)) {
      try {
        const response = await fetch(`/api/work-activities/${activity.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          showSnackbar('Work activity deleted successfully', 'success');
          fetchWorkActivities();
        } else {
          throw new Error('Failed to delete work activity');
        }
      } catch (error) {
        showSnackbar('Failed to delete work activity', 'error');
      }
    }
  };

  const handleInputChange = (field: keyof WorkActivity, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Add date validation warning (using Pacific Time)
    if (field === 'date' && value) {
      // Create dates in Pacific Time to avoid timezone issues
      const selectedDate = new Date(value + 'T00:00:00-08:00'); // Force Pacific Time
      const currentDatePT = new Date().toLocaleString('en-US', {timeZone: 'America/Los_Angeles'});
      const currentYear = new Date(currentDatePT).getFullYear();
      const selectedYear = selectedDate.getFullYear();
      
      if (selectedYear < currentYear) {
        showSnackbar(`Warning: Selected date is from ${selectedYear}. Did you mean ${currentYear}?`, 'error');
      }
    }
  };

  const handleAddEmployee = () => {
    if (employeeToAdd && !selectedEmployees.some(sel => sel.employeeId === employeeToAdd)) {
      setSelectedEmployees(prev => [...prev, { 
        employeeId: employeeToAdd as number, 
        hours: formData.totalHours || 8 
      }]);
      setEmployeeToAdd(''); // Reset the dropdown
    }
  };

  const handleRemoveEmployee = (employeeId: number) => {
    setSelectedEmployees(prev => prev.filter(emp => emp.employeeId !== employeeId));
  };

  const handleEmployeeHoursChange = (employeeId: number, hours: number) => {
    setSelectedEmployees(prev => prev.map(emp => 
      emp.employeeId === employeeId ? { ...emp, hours } : emp
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'info';
      case 'in_progress': return 'primary';
      case 'completed': return 'success';
      case 'invoiced': return 'secondary';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    // Parse the date string as a local date to avoid timezone conversion
    // dateString is in YYYY-MM-DD format from the database
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString('en-US', {
      timeZone: 'America/Los_Angeles', // Force Pacific Time
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
  };

  // Configure table columns
  const columns: ColumnConfig<WorkActivity>[] = [
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      render: (activity) => formatDate(activity.date),
    },
    {
      key: 'workType',
      label: 'Type',
      sortable: true,
      render: (activity) => (
        <Chip 
          label={activity.workType.replace('_', ' ').toUpperCase()} 
          size="small" 
          variant="outlined"
        />
      ),
    },
    {
      key: 'clientName',
      label: 'Client/Project',
      sortable: true,
      render: (activity) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {activity.clientName || 'No Client'}
          </Typography>
          {activity.projectName && (
            <Typography variant="caption" color="text.secondary">
              {activity.projectName}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      key: 'employeesList',
      label: 'Employees',
      render: (activity) => (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {activity.employeesList.map((emp) => (
            <Chip 
              key={emp.employeeId}
              label={`${emp.employeeName || 'Unknown'} (${emp.hours.toFixed(2)}h)`}
              size="small"
              icon={<PersonIcon />}
            />
          ))}
        </Box>
      ),
    },
    {
      key: 'totalHours',
      label: 'Hours',
      sortable: true,
      render: (activity) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TimeIcon fontSize="small" />
          <Typography variant="body2">
            {activity.totalHours.toFixed(2)}h
            {activity.billableHours && activity.billableHours !== activity.totalHours && (
              <Typography component="span" variant="caption" color="text.secondary">
                {' '}({activity.billableHours.toFixed(2)}h billable)
              </Typography>
            )}
          </Typography>
        </Box>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (activity) => (
        <Chip
          label={activity.status.replace('_', ' ').toUpperCase()}
          color={getStatusColor(activity.status) as any}
          size="small"
        />
      ),
    },
  ];

  // Configure filters
  const filters: FilterConfig[] = [
    {
      key: 'date',
      label: 'Date Range',
      type: 'daterange',
    },
    {
      key: 'clientName',
      label: 'Client',
      type: 'autocomplete',
      options: clients.map(client => ({ value: client.name, label: client.name })),
      getOptionLabel: (option) => option || 'No Client',
    },
    {
      key: 'status',
      label: 'Status',
      type: 'multiselect',
      options: WORK_STATUSES.map(status => ({
        value: status,
        label: status.replace('_', ' ').toUpperCase()
      })),
    },
    {
      key: 'employeesList',
      label: 'Employees',
      type: 'autocomplete',
      options: employees.map(emp => ({ value: { employeeName: emp.name, employeeId: emp.id }, label: emp.name })),
      getOptionLabel: (option) => option?.employeeName || 'Unknown',
    },
    {
      key: 'workType',
      label: 'Work Type',
      type: 'multiselect',
      options: WORK_TYPES.map(type => ({
        value: type,
        label: type.replace('_', ' ').toUpperCase()
      })),
    },
  ];

  // Handle table actions
  const handleRowAction = (action: string, activity: WorkActivity) => {
    switch (action) {
      case 'edit':
        handleEdit(activity);
        break;
      case 'delete':
        handleDelete(activity);
        break;
      default:
        break;
    }
  };

  const tableActions = [
    {
      key: 'edit',
      label: 'Edit',
      icon: <EditIcon />,
      color: 'default' as const,
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: <DeleteIcon />,
      color: 'error' as const,
    },
  ];

  if (loading) return <Typography>Loading work activities...</Typography>;

  return (
    <Box sx={{ p: 3 }}>
      <FilterableTable
        data={workActivities}
        columns={columns}
        filters={filters}
        onRowAction={handleRowAction}
        actions={tableActions}
        initialSortBy="date"
        initialSortOrder="desc"
        rowKeyField="id"
        emptyMessage="No work activities found"
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssignmentIcon /> Work Activity Management
          </Box>
        }
        headerActions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
          >
            Log Work Activity
          </Button>
        }
      />

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {isCreating ? 'Log New Work Activity' : `Edit Work Activity`}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Basic Information Section */}
            <Grid item xs={12}>
              <Typography variant="h6" color="primary" gutterBottom sx={{ mb: 2, mt: 1 }}>
                📋 Basic Information
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Date *"
                type="date"
                fullWidth
                value={formData.date || ''}
                onChange={(e) => handleInputChange('date', e.target.value)}
                required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth required>
                <InputLabel>Work Type *</InputLabel>
                <Select
                  value={formData.workType || 'maintenance'}
                  onChange={(e) => handleInputChange('workType', e.target.value)}
                  label="Work Type *"
                >
                  {WORK_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.replace('_', ' ').toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth required>
                <InputLabel>Status *</InputLabel>
                <Select
                  value={formData.status || 'planned'}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  label="Status *"
                >
                  {WORK_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status.replace('_', ' ').toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Client & Project Section */}
            <Grid item xs={12}>
              <Typography variant="h6" color="primary" gutterBottom sx={{ mb: 2, mt: 3 }}>
                🏢 Client & Project
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Autocomplete
                value={formData.clientId ? clients.find(c => c.id === formData.clientId) || null : null}
                onChange={(event, newValue) => {
                  const newClientId = newValue ? newValue.id : null;
                  handleInputChange('clientId', newClientId);
                  
                  // Clear project if it doesn't belong to the new client
                  if (formData.projectId && newClientId) {
                    const currentProject = projects.find(p => p.id === formData.projectId);
                    if (currentProject && currentProject.clientId !== newClientId) {
                      handleInputChange('projectId', null);
                    }
                  } else if (!newClientId) {
                    // Clear project if no client is selected
                    handleInputChange('projectId', null);
                  }
                }}
                options={clients}
                getOptionLabel={(option) => option.name || ''}
                renderInput={(params) => (
                  <TextField {...params} label="Client (Optional)" fullWidth />
                )}
                clearText="Clear Selection"
                noOptionsText="No clients found"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Autocomplete
                value={formData.projectId ? projects.find(p => p.id === formData.projectId) || null : null}
                onChange={(event, newValue) => {
                  handleInputChange('projectId', newValue ? newValue.id : null);
                }}
                options={projects.filter(project => !formData.clientId || project.clientId === formData.clientId)}
                getOptionLabel={(option) => option.name || ''}
                renderInput={(params) => (
                  <TextField {...params} label="Project (Optional)" fullWidth />
                )}
                clearText="Clear Selection"
                noOptionsText={formData.clientId ? "No projects found for this client" : "Select a client first"}
                disabled={!formData.clientId}
              />
            </Grid>

            {/* Time & Billing Section */}
            <Grid item xs={12}>
              <Typography variant="h6" color="primary" gutterBottom sx={{ mb: 2, mt: 3 }}>
                ⏱️ Time & Billing
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={3}>
              <TextField
                label="Total Hours *"
                type="number"
                fullWidth
                value={formData.totalHours || ''}
                onChange={(e) => handleInputChange('totalHours', parseFloat(e.target.value))}
                inputProps={{ min: 0, step: 0.25 }}
                required
                helperText="Total time worked"
              />
            </Grid>
            
            <Grid item xs={12} sm={3}>
              <TextField
                label="Billable Hours"
                type="number"
                fullWidth
                value={formData.billableHours || ''}
                onChange={(e) => handleInputChange('billableHours', parseFloat(e.target.value))}
                inputProps={{ min: 0, step: 0.25 }}
                helperText="Hours to bill client"
              />
            </Grid>
            
            <Grid item xs={12} sm={3}>
              <TextField
                label="Hourly Rate"
                type="number"
                fullWidth
                value={formData.hourlyRate || ''}
                onChange={(e) => handleInputChange('hourlyRate', parseFloat(e.target.value))}
                inputProps={{ min: 0, step: 0.5 }}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>$</Typography>
                }}
                helperText="Rate per hour"
              />
            </Grid>
            
            <Grid item xs={12} sm={3}>
              <TextField
                label="Break Time"
                type="number"
                fullWidth
                value={formData.breakTimeMinutes || 0}
                onChange={(e) => handleInputChange('breakTimeMinutes', parseInt(e.target.value))}
                inputProps={{ min: 0 }}
                InputProps={{
                  endAdornment: <Typography sx={{ ml: 1, color: 'text.secondary' }}>min</Typography>
                }}
                helperText="Break duration"
              />
            </Grid>

            {/* Schedule Details Section */}
            <Grid item xs={12}>
              <Typography variant="h6" color="primary" gutterBottom sx={{ mb: 2, mt: 3 }}>
                📅 Schedule Details
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Start Time"
                type="time"
                fullWidth
                value={formData.startTime || ''}
                onChange={(e) => handleInputChange('startTime', e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="When work started"
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="End Time"
                type="time"
                fullWidth
                value={formData.endTime || ''}
                onChange={(e) => handleInputChange('endTime', e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="When work ended"
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Travel Time"
                type="number"
                fullWidth
                value={formData.travelTimeMinutes || 0}
                onChange={(e) => handleInputChange('travelTimeMinutes', parseInt(e.target.value))}
                inputProps={{ min: 0 }}
                InputProps={{
                  endAdornment: <Typography sx={{ ml: 1, color: 'text.secondary' }}>min</Typography>
                }}
                helperText="Travel to/from job"
              />
            </Grid>

            {/* Employee Assignment Section */}
            <Grid item xs={12}>
              <Typography variant="h6" color="primary" gutterBottom sx={{ mb: 2, mt: 3 }}>
                👥 Assigned Employees
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-end' }}>
                <FormControl sx={{ minWidth: 250 }}>
                  <InputLabel>Select Employee to Add</InputLabel>
                  <Select
                    value={employeeToAdd}
                    onChange={(e) => setEmployeeToAdd(e.target.value as number)}
                    label="Select Employee to Add"
                  >
                    {employees
                      .filter(emp => !selectedEmployees.some(sel => sel.employeeId === emp.id))
                      .map((employee) => (
                        <MenuItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
                
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddEmployee}
                  disabled={!employeeToAdd}
                  sx={{ height: 56 }}
                >
                  Add Employee
                </Button>
              </Box>
              
              {selectedEmployees.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mb: 2 }}>
                  No employees assigned yet. Please add at least one employee.
                </Typography>
              ) : (
                <List sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                  {selectedEmployees.map((selectedEmp) => {
                    const employee = employees.find(emp => emp.id === selectedEmp.employeeId);
                    return (
                      <ListItem key={selectedEmp.employeeId} divider>
                        <ListItemText
                          primary={employee?.name || 'Unknown Employee'}
                          secondary={`${selectedEmp.hours.toFixed(2)} hours assigned`}
                        />
                        <ListItemSecondaryAction>
                          <TextField
                            label="Hours"
                            type="number"
                            value={selectedEmp.hours}
                            onChange={(e) => handleEmployeeHoursChange(selectedEmp.employeeId, parseFloat(e.target.value))}
                            size="small"
                            sx={{ width: 100, mr: 1 }}
                            inputProps={{ min: 0, step: 0.25 }}
                          />
                          <IconButton 
                            onClick={() => handleRemoveEmployee(selectedEmp.employeeId)}
                            size="small"
                            color="error"
                            title="Remove Employee"
                          >
                            <RemoveIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Grid>

            {/* Notes & Tasks Section */}
            <Grid item xs={12}>
              <Typography variant="h6" color="primary" gutterBottom sx={{ mb: 2, mt: 3 }}>
                📝 Documentation
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Add detailed notes about the work performed and any tasks or follow-up items.
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                Work Notes
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Describe the work that was performed, any issues encountered, materials used, etc.
              </Typography>
              <Box sx={{ 
                '& .rdw-editor-wrapper': {
                  border: '1px solid rgba(0, 0, 0, 0.23)',
                  borderRadius: 1,
                  backgroundColor: '#fff',
                  minHeight: '150px'
                },
                '& .rdw-editor-toolbar': {
                  borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px 4px 0 0',
                  padding: '8px'
                },
                '& .rdw-editor-main': {
                  minHeight: '120px',
                  padding: '12px',
                  fontSize: '14px'
                }
              }}>
                <Editor
                  editorState={notesEditorState}
                  onEditorStateChange={(state) => {
                    handleInputChange('notes', editorStateToHtml(state));
                    setNotesEditorState(state);
                  }}
                  toolbar={{
                    options: ['inline', 'list', 'link', 'history'],
                    inline: { options: ['bold', 'italic', 'underline'] },
                    list: { options: ['unordered', 'ordered'] }
                  }}
                  placeholder="Describe the work performed..."
                />
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                Tasks & Follow-up
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                List any pending tasks, follow-up items, or next steps required.
              </Typography>
              <Box sx={{ 
                '& .rdw-editor-wrapper': {
                  border: '1px solid rgba(0, 0, 0, 0.23)',
                  borderRadius: 1,
                  backgroundColor: '#fff',
                  minHeight: '150px'
                },
                '& .rdw-editor-toolbar': {
                  borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px 4px 0 0',
                  padding: '8px'
                },
                '& .rdw-editor-main': {
                  minHeight: '120px',
                  padding: '12px',
                  fontSize: '14px'
                }
              }}>
                <Editor
                  editorState={tasksEditorState}
                  onEditorStateChange={(state) => {
                    handleInputChange('tasks', editorStateToHtml(state));
                    setTasksEditorState(state);
                  }}
                  toolbar={{
                    options: ['inline', 'list', 'link', 'history'],
                    inline: { options: ['bold', 'italic', 'underline'] },
                    list: { options: ['unordered', 'ordered'] }
                  }}
                  placeholder="List tasks, follow-up items, or next steps..."
                />
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, bgcolor: 'grey.50', borderTop: '1px solid', borderColor: 'divider' }}>
          <Button 
            onClick={() => setEditDialogOpen(false)}
            variant="outlined"
            size="large"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained"
            size="large"
            sx={{ minWidth: 120 }}
          >
            {isCreating ? 'Create Activity' : 'Save Changes'}
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

export default WorkActivityManagement; 