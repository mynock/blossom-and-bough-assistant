import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Work as WorkIcon,
} from '@mui/icons-material';
import { Client } from '../services/api';

interface Project {
  id: number;
  clientId: number;
  status: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  clientName: string;
}

const PROJECT_STATUSES = [
  'planning',
  'in_progress', 
  'on_hold',
  'completed',
  'cancelled'
];

const ProjectManagement: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Form state
  const [formData, setFormData] = useState<Partial<Project>>({
    name: '',
    description: '',
    status: 'planning',
    clientId: undefined,
  });

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      showSnackbar('Failed to fetch projects', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    fetchProjects();
    fetchClients();
  }, [fetchProjects]);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients');
      const data = await response.json();
      setClients(data.clients);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const handleEdit = (project: Project) => {
    setSelectedProject(project);
    setFormData(project);
    setIsCreating(false);
    setEditDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedProject(null);
    setFormData({
      name: '',
      description: '',
      status: 'planning',
      clientId: undefined,
    });
    setIsCreating(true);
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const url = isCreating ? '/api/projects' : `/api/projects/${selectedProject?.id}`;
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
          isCreating ? 'Project created successfully' : 'Project updated successfully',
          'success'
        );
        setEditDialogOpen(false);
        fetchProjects();
      } else {
        throw new Error('Failed to save project');
      }
    } catch (error) {
      showSnackbar('Failed to save project', 'error');
    }
  };

  const handleDelete = async (project: Project) => {
    if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) {
      try {
        const response = await fetch(`/api/projects/${project.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          showSnackbar('Project deleted successfully', 'success');
          fetchProjects();
        } else {
          throw new Error('Failed to delete project');
        }
      } catch (error) {
        showSnackbar('Failed to delete project', 'error');
      }
    }
  };

  const handleInputChange = (field: keyof Project, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return 'info';
      case 'in_progress': return 'primary';
      case 'on_hold': return 'warning';
      case 'completed': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) return <Typography>Loading projects...</Typography>;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WorkIcon /> Project Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          Add Project
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Project Name</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {project.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  {project.clientId ? (
                    <Button 
                      variant="text" 
                      onClick={() => navigate(`/clients/${project.clientId}`)}
                      sx={{ 
                        textAlign: 'left', 
                        justifyContent: 'flex-start', 
                        textTransform: 'none',
                        minHeight: 'auto',
                        p: 0
                      }}
                    >
                      {project.clientName}
                    </Button>
                  ) : (
                    <Typography variant="body2">
                      {project.clientName || 'No Client'}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={project.status.replace('_', ' ').toUpperCase()}
                    color={getStatusColor(project.status) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {project.description || '-'}
                  </Typography>
                </TableCell>
                <TableCell>{formatDate(project.createdAt)}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleEdit(project)} size="small">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(project)} size="small">
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
          {isCreating ? 'Create New Project' : `Edit ${selectedProject?.name}`}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Project Name"
                fullWidth
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Client</InputLabel>
                <Select
                  value={formData.clientId || ''}
                  onChange={(e) => handleInputChange('clientId', e.target.value)}
                >
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
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status || 'planning'}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                >
                  {PROJECT_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status.replace('_', ' ').toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={4}
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe the project scope, goals, or special requirements..."
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

export default ProjectManagement; 