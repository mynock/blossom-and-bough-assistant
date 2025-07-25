import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Chip,
  Alert,
  Snackbar,
  Grid,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Person as PersonIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import FilterableTable, { FilterConfig, ColumnConfig } from './FilterableTable';

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
  totalWorkActivities: number;
  totalHours: number;
  totalBillableHours: number;
}

const ClientManagement: React.FC = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Form state
  const [formData, setFormData] = useState<Partial<Client>>({
    name: '',
    address: '',
    geoZone: '',
    isRecurringMaintenance: false,
    priorityLevel: 'Medium',
    activeStatus: 'active',
  });

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const response = await fetch('/api/clients');
      const data = await response.json();
      setClients(data.clients);
    } catch (error) {
      showSnackbar('Failed to fetch clients', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setFormData(client);
    setIsCreating(false);
    setEditDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedClient(null);
    setFormData({
      name: '',
      address: '',
      geoZone: '',
      isRecurringMaintenance: false,
      priorityLevel: 'Medium',
      activeStatus: 'active',
    });
    setIsCreating(true);
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const url = isCreating ? '/api/clients' : `/api/clients/${selectedClient?.id}`;
      const method = isCreating ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        showSnackbar(
          isCreating ? 'Client created successfully' : 'Client updated successfully',
          'success'
        );
        setEditDialogOpen(false);
        fetchClients();
      } else {
        throw new Error('Failed to save client');
      }
    } catch (error) {
      showSnackbar('Failed to save client', 'error');
    }
  };

  const handleDelete = async (client: Client) => {
    if (window.confirm(`Are you sure you want to delete ${client.name}?`)) {
      try {
        const response = await fetch(`/api/clients/${client.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          showSnackbar('Client deleted successfully', 'success');
          fetchClients();
        } else {
          throw new Error('Failed to delete client');
        }
      } catch (error) {
        showSnackbar('Failed to delete client', 'error');
      }
    }
  };

  const handleInputChange = (field: keyof Client, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'error';
      case 'Medium': return 'warning';
      case 'Low': return 'success';
      default: return 'default';
    }
  };

  // Configure table columns
  const columns: ColumnConfig<Client>[] = [
    {
      key: 'clientId',
      label: 'Client ID',
      sortable: true,
    },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (client) => (
        <Button 
          variant="text" 
          onClick={() => navigate(`/clients/${client.id}`)}
          sx={{ textAlign: 'left', justifyContent: 'flex-start', textTransform: 'none' }}
        >
          {client.name}
        </Button>
      ),
    },
    {
      key: 'address',
      label: 'Address',
      sortable: true,
    },
    {
      key: 'geoZone',
      label: 'Zone',
      sortable: true,
    },
    {
      key: 'priorityLevel',
      label: 'Priority',
      sortable: true,
      render: (client) => (
        <Chip
          label={client.priorityLevel}
          color={getPriorityColor(client.priorityLevel) as any}
          size="small"
        />
      ),
    },
    {
      key: 'isRecurringMaintenance',
      label: 'Maintenance',
      render: (client) => (
        client.isRecurringMaintenance ? (
          <Chip label="Recurring" color="primary" size="small" />
        ) : (
          <Chip label="One-time" color="default" size="small" />
        )
      ),
    },
    {
      key: 'activeStatus',
      label: 'Status',
      sortable: true,
      render: (client) => (
        <Chip
          label={client.activeStatus}
          color={client.activeStatus === 'active' ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      key: 'totalWorkActivities',
      label: 'Entries',
      sortable: true,
      render: (client) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {client.totalWorkActivities}
        </Typography>
      ),
    },
    {
      key: 'totalHours',
      label: 'Total Hours',
      sortable: true,
      render: (client) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {client.totalHours.toFixed(1)}h
        </Typography>
      ),
    },
    {
      key: 'totalBillableHours',
      label: 'Billable Hours',
      sortable: true,
      render: (client) => (
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
          {client.totalBillableHours.toFixed(1)}h
        </Typography>
      ),
    },
  ];

  // Configure filters
  const filters: FilterConfig[] = [
    {
      key: 'name',
      label: 'Client Name',
      type: 'text',
    },
    {
      key: 'geoZone',
      label: 'Geographic Zone',
      type: 'text',
    },
    {
      key: 'priorityLevel',
      label: 'Priority Level',
      type: 'multiselect',
      options: [
        { value: 'High', label: 'High' },
        { value: 'Medium', label: 'Medium' },
        { value: 'Low', label: 'Low' },
      ],
    },
    {
      key: 'activeStatus',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
    {
      key: 'isRecurringMaintenance',
      label: 'Maintenance Type',
      type: 'select',
      options: [
        { value: true, label: 'Recurring' },
        { value: false, label: 'One-time' },
      ],
    },
    {
      key: 'totalWorkActivities',
      label: 'Number of Entries',
      type: 'select',
      options: [
        { value: 0, label: 'No entries' },
        { value: '1-5', label: '1-5 entries' },
        { value: '6-20', label: '6-20 entries' },
        { value: '21+', label: '21+ entries' },
      ],
    },
    {
      key: 'totalHours',
      label: 'Total Hours Range',
      type: 'select',
      options: [
        { value: 0, label: 'No hours' },
        { value: '1-10', label: '1-10 hours' },
        { value: '11-50', label: '11-50 hours' },
        { value: '51+', label: '51+ hours' },
      ],
    },
  ];

  // Handle table actions
  const handleRowAction = (action: string, client: Client) => {
    switch (action) {
      case 'view':
        navigate(`/clients/${client.id}`);
        break;
      case 'edit':
        handleEdit(client);
        break;
      case 'delete':
        handleDelete(client);
        break;
      default:
        break;
    }
  };

  const tableActions = [
    {
      key: 'view',
      label: 'View',
      icon: <ViewIcon />,
      color: 'primary' as const,
    },
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

  if (loading) return <Typography>Loading clients...</Typography>;

  return (
    <Box sx={{ p: 3 }}>
      <FilterableTable
        data={clients}
        columns={columns}
        filters={filters}
        onRowAction={handleRowAction}
        actions={tableActions}
        initialSortBy="name"
        initialSortOrder="asc"
        rowKeyField="id"
        emptyMessage="No clients found"
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon /> Client Management
          </Box>
        }
        headerActions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
          >
            Add Client
          </Button>
        }
      />

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {isCreating ? 'Create New Client' : `Edit ${selectedClient?.name}`}
        </DialogTitle>
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
                onChange={(e) => handleInputChange('clientId', e.target.value)}
                disabled={!isCreating}
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

export default ClientManagement; 