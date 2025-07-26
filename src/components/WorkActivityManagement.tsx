import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Snackbar,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Assignment as AssignmentIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { Client } from '../services/api';
import { API_ENDPOINTS, apiClient } from '../config/api';
import { useSearchParams } from 'react-router-dom';

import { WorkActivitiesTable } from './WorkActivitiesTable';
import WorkActivityEditDialog from './WorkActivityEditDialog';
import TravelTimeAllocation from './TravelTimeAllocation';
import BreakTimeAllocation from './BreakTimeAllocation';

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
  adjustedTravelTimeMinutes?: number | null;
  breakTimeMinutes?: number;
  adjustedBreakTimeMinutes?: number | null;
  nonBillableTimeMinutes?: number;
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
  chargesList: Array<OtherCharge>;
  plantsList: Array<PlantListItem>;
  totalCharges: number;
}

interface OtherCharge {
  id?: number;
  chargeType: string;
  description: string;
  quantity?: number;
  unitRate?: number;
  totalCost: number;
  billable: boolean;
}

interface PlantListItem {
  id?: number;
  name: string;
  quantity: number;
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

interface WorkActivityFilters {
  startDate?: string;
  endDate?: string;
  workType?: string;
  status?: string;
  clientId?: number;
  employeeId?: number;
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
  'needs_review',
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
  
  // Filter state
  const [filters, setFilters] = useState<WorkActivityFilters>({});
  const [filtersExpanded, setFiltersExpanded] = useState(false);



  const showSnackbar = useCallback((message: string, severity: 'success' | 'error' | 'warning') => {
    setSnackbar({ open: true, message, severity: severity as 'success' | 'error' });
  }, []);

  const fetchWorkActivities = useCallback(async () => {
    try {
      // Build query parameters from filters
      const queryParams = new URLSearchParams();
      
      if (filters.startDate) {
        queryParams.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        queryParams.append('endDate', filters.endDate);
      }
      if (filters.workType) {
        queryParams.append('workType', filters.workType);
      }
      if (filters.status) {
        queryParams.append('status', filters.status);
      }
      if (filters.clientId) {
        queryParams.append('clientId', filters.clientId.toString());
      }
      if (filters.employeeId) {
        queryParams.append('employeeId', filters.employeeId.toString());
      }

      const url = `${API_ENDPOINTS.WORK_ACTIVITIES}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiClient.get(url);
      const data = await response.json();
      
      // Debug logging to see what we're receiving
      console.log('API response for work activities:', data);
      
      // Ensure we have an array
      if (Array.isArray(data)) {
        setWorkActivities(data);
      } else {
        console.error('Work activities API returned non-array data:', data);
        setWorkActivities([]);
        showSnackbar('Failed to load work activities - invalid data format', 'error');
      }
    } catch (error) {
      console.error('Error fetching work activities:', error);
      setWorkActivities([]);
      showSnackbar('Failed to fetch work activities', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar, filters]);

  useEffect(() => {
    fetchWorkActivities();
    fetchClients();
    fetchProjects();
    fetchEmployees();
  }, [fetchWorkActivities]);

    // Check for create parameter and auto-open dialog
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setIsCreating(true);
      setEditDialogOpen(true);
      setSelectedActivity(null);
      // Remove the parameter from URL without triggering navigation
      setSearchParams({});
    }
    
    // Check for edit parameter and auto-open dialog
    const editId = searchParams.get('edit');
    if (editId && workActivities.length > 0) {
      const activityToEdit = workActivities.find(a => a.id === parseInt(editId));
      if (activityToEdit) {
        setIsCreating(false);
        setSelectedActivity(activityToEdit);
        setEditDialogOpen(true);
        // Remove the parameter from URL without triggering navigation
        setSearchParams({});
      }
    }
  }, [searchParams, setSearchParams, workActivities]);

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
    setEditDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedActivity(null);
    setIsCreating(true);
    setEditDialogOpen(true);
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

  // New save handler for shared dialog
  const handleSharedDialogSave = async (
    activity: WorkActivity, 
    employees: Array<{ employeeId: number; hours: number; employeeName?: string | null }>, 
    charges: Array<OtherCharge>, 
    plants: Array<PlantListItem>
  ) => {
    if (employees.length === 0) {
      showSnackbar('At least one employee must be assigned', 'error');
      return;
    }

    const requestData = {
      workActivity: activity,
      employees: employees,
      charges: charges,
      plants: plants
    };

    const url = isCreating ? '/api/work-activities' : `/api/work-activities/${selectedActivity?.id}`;
    const method = isCreating ? 'POST' : 'PUT';
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(isCreating ? requestData : activity),
    });

    if (!response.ok) {
      throw new Error('Failed to save work activity');
    }

    showSnackbar(
      isCreating ? 'Work activity created successfully' : 'Work activity updated successfully',
      'success'
    );
    setEditDialogOpen(false);
    fetchWorkActivities();
  };

  const handleFilterChange = (field: keyof WorkActivityFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value || undefined // Convert empty strings to undefined
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const getActiveFilterCount = () => {
    return Object.values(filters).filter(value => value !== undefined && value !== '').length;
  };



  if (loading) return <Typography>Loading work activities...</Typography>;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AssignmentIcon sx={{ fontSize: 40 }} />
          <Typography variant="h4">Work Activities</Typography>
          {getActiveFilterCount() > 0 && (
            <Chip 
              label={`${getActiveFilterCount()} filter${getActiveFilterCount() === 1 ? '' : 's'}`} 
              color="primary" 
              size="small" 
            />
          )}
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          Add Work Activity
        </Button>
      </Box>

      {/* Filters */}
      <Accordion 
        expanded={filtersExpanded} 
        onChange={(_, isExpanded) => setFiltersExpanded(isExpanded)}
        sx={{ mb: 3 }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterListIcon />
            <Typography variant="h6">Filters</Typography>
            {getActiveFilterCount() > 0 && (
              <Chip 
                label={getActiveFilterCount()} 
                color="primary" 
                size="small" 
              />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            {/* Date Range */}
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Start Date"
                type="date"
                fullWidth
                value={filters.startDate || ''}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="End Date"
                type="date"
                fullWidth
                value={filters.endDate || ''}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>

            {/* Work Type */}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Work Type</InputLabel>
                <Select
                  value={filters.workType || ''}
                  onChange={(e) => handleFilterChange('workType', e.target.value)}
                  label="Work Type"
                >
                  <MenuItem value="">All Types</MenuItem>
                  {WORK_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.replace('_', ' ').toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Status */}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status || ''}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  {WORK_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status.replace('_', ' ').toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Client */}
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                size="small"
                options={clients}
                getOptionLabel={(option) => option.name}
                value={clients.find(c => c.id === filters.clientId) || null}
                onChange={(_, newValue) => handleFilterChange('clientId', newValue?.id)}
                renderInput={(params) => (
                  <TextField {...params} label="Client" fullWidth />
                )}
              />
            </Grid>

            {/* Employee */}
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                size="small"
                options={employees}
                getOptionLabel={(option) => option.name}
                value={employees.find(e => e.id === filters.employeeId) || null}
                onChange={(_, newValue) => handleFilterChange('employeeId', newValue?.id)}
                renderInput={(params) => (
                  <TextField {...params} label="Employee" fullWidth />
                )}
              />
            </Grid>

            {/* Clear Filters */}
            <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex', alignItems: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={clearFilters}
                disabled={getActiveFilterCount() === 0}
                fullWidth
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Travel Time Allocation Section */}
      <Accordion sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">Travel Time Allocation</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <TravelTimeAllocation 
            onUpdate={fetchWorkActivities} 
          />
        </AccordionDetails>
      </Accordion>

      {/* Break Time Allocation Section */}
      <Accordion sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">Break Time Allocation</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <BreakTimeAllocation 
            onUpdate={fetchWorkActivities} 
          />
        </AccordionDetails>
      </Accordion>

      {/* Work Activities Table */}
      <WorkActivitiesTable
        activities={workActivities}
        onEdit={handleEdit}
        onDelete={handleDelete}
        showClientColumn={true}
        emptyMessage="No work activities found. Try adjusting your filters or add a new work activity."
      />

      {/* Work Activity Edit Dialog */}
      <WorkActivityEditDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        activity={selectedActivity}
        isCreating={isCreating}
        onSave={handleSharedDialogSave}
        clients={clients.map(c => ({ id: c.id, clientId: c.clientId, name: c.name }))}
        projects={projects}
        employees={employees}
        onShowSnackbar={showSnackbar}
      />



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