import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Snackbar,
  Paper,
} from '@mui/material';
import {
  Add as AddIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { Client } from '../services/api';
import { API_ENDPOINTS, apiClient } from '../config/api';
import { useSearchParams } from 'react-router-dom';

import { WorkActivitiesTable } from './WorkActivitiesTable';
import WorkActivityEditDialog from './WorkActivityEditDialog';

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


  


  const showSnackbar = useCallback((message: string, severity: 'success' | 'error' | 'warning') => {
    setSnackbar({ open: true, message, severity: severity as 'success' | 'error' });
  }, []);

  const fetchWorkActivities = useCallback(async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.WORK_ACTIVITIES);
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
      setIsCreating(true);
      setEditDialogOpen(true);
      setSelectedActivity(null);
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






  if (loading) return <Typography>Loading work activities...</Typography>;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
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
      </Paper>

      {/* Work Activities Table */}
      <WorkActivitiesTable
        activities={workActivities}
        onEdit={handleEdit}
        onDelete={handleDelete}
        showClientColumn={true}
        emptyMessage="No work activities found"
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