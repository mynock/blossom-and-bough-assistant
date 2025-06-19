import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  };

  const handleAddEmployee = () => {
    if (employees.length > 0) {
      const firstAvailableEmployee = employees.find(emp => 
        !selectedEmployees.some(sel => sel.employeeId === emp.id)
      );
      
      if (firstAvailableEmployee) {
        setSelectedEmployees(prev => [...prev, { 
          employeeId: firstAvailableEmployee.id, 
          hours: formData.totalHours || 8 
        }]);
      }
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
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) return <Typography>Loading work activities...</Typography>;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssignmentIcon /> Work Activity Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          Log Work Activity
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Client/Project</TableCell>
              <TableCell>Employees</TableCell>
              <TableCell>Hours</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {workActivities.map((activity) => (
              <TableRow key={activity.id}>
                <TableCell>{formatDate(activity.date)}</TableCell>
                <TableCell>
                  <Chip 
                    label={activity.workType.replace('_', ' ').toUpperCase()} 
                    size="small" 
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {activity.employeesList.map((emp) => (
                      <Chip 
                        key={emp.employeeId}
                        label={`${emp.employeeName || 'Unknown'} (${emp.hours}h)`}
                        size="small"
                        icon={<PersonIcon />}
                      />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TimeIcon fontSize="small" />
                    <Typography variant="body2">
                      {activity.totalHours}h
                      {activity.billableHours && activity.billableHours !== activity.totalHours && (
                        <Typography component="span" variant="caption" color="text.secondary">
                          {' '}({activity.billableHours}h billable)
                        </Typography>
                      )}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={activity.status.replace('_', ' ').toUpperCase()}
                    color={getStatusColor(activity.status) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => handleEdit(activity)} size="small">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(activity)} size="small">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {isCreating ? 'Log New Work Activity' : `Edit Work Activity`}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Basic Information Row */}
            <Grid item xs={12}>
              <Typography variant="h6" color="primary" gutterBottom>
                Basic Information
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Date"
                type="date"
                fullWidth
                value={formData.date || ''}
                onChange={(e) => handleInputChange('date', e.target.value)}
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Work Type</InputLabel>
                <Select
                  value={formData.workType || 'maintenance'}
                  onChange={(e) => handleInputChange('workType', e.target.value)}
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
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status || 'planned'}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                >
                  {WORK_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status.replace('_', ' ').toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Client & Project Row */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Client</InputLabel>
                <Select
                  value={formData.clientId || ''}
                  onChange={(e) => handleInputChange('clientId', e.target.value)}
                >
                  <MenuItem value="">No Client</MenuItem>
                  {clients.map((client) => (
                    <MenuItem key={client.id} value={client.id}>
                      {client.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Project</InputLabel>
                <Select
                  value={formData.projectId || ''}
                  onChange={(e) => handleInputChange('projectId', e.target.value)}
                >
                  <MenuItem value="">No Project</MenuItem>
                  {projects
                    .filter(project => !formData.clientId || project.clientId === formData.clientId)
                    .map((project) => (
                    <MenuItem key={project.id} value={project.id}>
                      {project.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Time & Rate Information */}
            <Grid item xs={12}>
              <Typography variant="h6" color="primary" gutterBottom sx={{ mt: 2 }}>
                Time & Billing
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={3}>
              <TextField
                label="Total Hours"
                type="number"
                fullWidth
                value={formData.totalHours || ''}
                onChange={(e) => handleInputChange('totalHours', parseFloat(e.target.value))}
                inputProps={{ min: 0, step: 0.5 }}
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={3}>
              <TextField
                label="Billable Hours"
                type="number"
                fullWidth
                value={formData.billableHours || ''}
                onChange={(e) => handleInputChange('billableHours', parseFloat(e.target.value))}
                inputProps={{ min: 0, step: 0.5 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={3}>
              <TextField
                label="Hourly Rate ($)"
                type="number"
                fullWidth
                value={formData.hourlyRate || ''}
                onChange={(e) => handleInputChange('hourlyRate', parseFloat(e.target.value))}
                inputProps={{ min: 0, step: 0.5 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={3}>
              <TextField
                label="Break Time (min)"
                type="number"
                fullWidth
                value={formData.breakTimeMinutes || 0}
                onChange={(e) => handleInputChange('breakTimeMinutes', parseInt(e.target.value))}
                inputProps={{ min: 0 }}
              />
            </Grid>

            {/* Schedule Details */}
            <Grid item xs={12}>
              <Typography variant="h6" color="primary" gutterBottom sx={{ mt: 2 }}>
                Schedule Details
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Start Time"
                type="time"
                fullWidth
                value={formData.startTime || ''}
                onChange={(e) => handleInputChange('startTime', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="End Time"
                type="time"
                fullWidth
                value={formData.endTime || ''}
                onChange={(e) => handleInputChange('endTime', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Travel Time (min)"
                type="number"
                fullWidth
                value={formData.travelTimeMinutes || 0}
                onChange={(e) => handleInputChange('travelTimeMinutes', parseInt(e.target.value))}
                inputProps={{ min: 0 }}
              />
            </Grid>

            {/* Employee Assignment */}
            <Grid item xs={12}>
              <Typography variant="h6" color="primary" gutterBottom sx={{ mt: 2 }}>
                Assigned Employees
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddEmployee}
                sx={{ mb: 2 }}
                disabled={selectedEmployees.length >= employees.length}
              >
                Add Employee
              </Button>
              
              <List>
                {selectedEmployees.map((selectedEmp) => {
                  const employee = employees.find(emp => emp.id === selectedEmp.employeeId);
                  return (
                    <ListItem key={selectedEmp.employeeId}>
                      <ListItemText
                        primary={employee?.name || 'Unknown Employee'}
                        secondary={`${selectedEmp.hours} hours`}
                      />
                      <ListItemSecondaryAction>
                        <TextField
                          type="number"
                          value={selectedEmp.hours}
                          onChange={(e) => handleEmployeeHoursChange(selectedEmp.employeeId, parseFloat(e.target.value))}
                          size="small"
                          sx={{ width: 80, mr: 1 }}
                          inputProps={{ min: 0, step: 0.5 }}
                        />
                        <IconButton 
                          onClick={() => handleRemoveEmployee(selectedEmp.employeeId)}
                          size="small"
                        >
                          <RemoveIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  );
                })}
              </List>
            </Grid>

            {/* Notes & Tasks */}
            <Grid item xs={12}>
              <Typography variant="h6" color="primary" gutterBottom sx={{ mt: 2 }}>
                Documentation
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Work Notes
              </Typography>
              <Box sx={{ 
                '& .rdw-editor-wrapper': {
                  border: '1px solid rgba(0, 0, 0, 0.23)',
                  borderRadius: 1,
                  backgroundColor: '#fff'
                },
                '& .rdw-editor-toolbar': {
                  borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
                  backgroundColor: '#f5f5f5',
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
                    options: ['inline', 'blockType', 'list', 'textAlign', 'link', 'history'],
                    inline: { options: ['bold', 'italic', 'underline'] },
                    blockType: { options: ['Normal', 'H1', 'H2', 'H3'] },
                    list: { options: ['unordered', 'ordered'] }
                  }}
                />
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Tasks / To-Do Items
              </Typography>
              <Box sx={{ 
                '& .rdw-editor-wrapper': {
                  border: '1px solid rgba(0, 0, 0, 0.23)',
                  borderRadius: 1,
                  backgroundColor: '#fff'
                },
                '& .rdw-editor-toolbar': {
                  borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
                  backgroundColor: '#f5f5f5',
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
                    options: ['inline', 'blockType', 'list', 'textAlign', 'link', 'history'],
                    inline: { options: ['bold', 'italic', 'underline'] },
                    blockType: { options: ['Normal', 'H1', 'H2', 'H3'] },
                    list: { options: ['unordered', 'ordered'] }
                  }}
                />
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {isCreating ? 'Create' : 'Save'}
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