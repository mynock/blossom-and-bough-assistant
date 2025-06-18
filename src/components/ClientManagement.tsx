import React, { useState, useEffect } from 'react';
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
  FormControlLabel,
  Switch,
  Chip,
  IconButton,
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

const ClientManagement: React.FC = () => {
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

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients');
      const data = await response.json();
      setClients(data);
    } catch (error) {
      showSnackbar('Failed to fetch clients', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

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

  if (loading) return <Typography>Loading clients...</Typography>;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon /> Client Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          Add Client
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Client ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Address</TableCell>
              <TableCell>Zone</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Maintenance</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>{client.clientId}</TableCell>
                <TableCell>{client.name}</TableCell>
                <TableCell>{client.address}</TableCell>
                <TableCell>{client.geoZone}</TableCell>
                <TableCell>
                  <Chip
                    label={client.priorityLevel}
                    color={getPriorityColor(client.priorityLevel) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {client.isRecurringMaintenance ? (
                    <Chip label="Recurring" color="primary" size="small" />
                  ) : (
                    <Chip label="One-time" color="default" size="small" />
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={client.activeStatus}
                    color={client.activeStatus === 'active' ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => handleEdit(client)} size="small">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(client)} size="small">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

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