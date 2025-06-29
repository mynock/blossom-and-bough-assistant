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
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Work as WorkIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';

interface Employee {
  id: number;
  employeeId: string;
  name: string;
  regularWorkdays: string;
  homeAddress: string;
  minHoursPerDay: number;
  maxHoursPerDay: number;
  capabilityLevel: number;
  hourlyRate: number | null;
  notes?: string;
  activeStatus: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const EmployeeManagement: React.FC = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Form state
  const [formData, setFormData] = useState<Partial<Employee>>({
    name: '',
    regularWorkdays: '',
    homeAddress: '',
    minHoursPerDay: 7,
    maxHoursPerDay: 8,
    capabilityLevel: 3,
    hourlyRate: null,
    activeStatus: 'active',
  });

  const [selectedWorkdays, setSelectedWorkdays] = useState<string[]>([]);

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetch('/api/employees');
      const data = await response.json();
      setEmployees(data);
    } catch (error) {
      showSnackbar('Failed to fetch employees', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormData(employee);
    setSelectedWorkdays(employee.regularWorkdays.split(' ').filter(day => day.trim()));
    setIsCreating(false);
    setEditDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedEmployee(null);
    setFormData({
      name: '',
      employeeId: '',
      regularWorkdays: '',
      homeAddress: '',
      minHoursPerDay: 7,
      maxHoursPerDay: 8,
      capabilityLevel: 3,
      hourlyRate: null,
      activeStatus: 'active',
    });
    setSelectedWorkdays([]);
    setIsCreating(true);
    setEditDialogOpen(true);
  };

  const handleView = (employee: Employee) => {
    navigate(`/employees/${employee.id}`);
  };

  const handleSave = async () => {
    try {
      // Validate required fields
      if (!formData.name?.trim()) {
        showSnackbar('Name is required', 'error');
        return;
      }
      
      if (!formData.employeeId?.trim()) {
        showSnackbar('Employee ID is required', 'error');
        return;
      }
      
      if (selectedWorkdays.length === 0) {
        showSnackbar('At least one workday must be selected', 'error');
        return;
      }
      
      if (!formData.homeAddress?.trim()) {
        showSnackbar('Home address is required', 'error');
        return;
      }
      
      if (!formData.minHoursPerDay || formData.minHoursPerDay < 1) {
        showSnackbar('Valid minimum hours per day is required', 'error');
        return;
      }
      
      if (!formData.maxHoursPerDay || formData.maxHoursPerDay < 1) {
        showSnackbar('Valid maximum hours per day is required', 'error');
        return;
      }
      
      if (!formData.capabilityLevel || formData.capabilityLevel < 1) {
        showSnackbar('Capability level is required', 'error');
        return;
      }

      const dataToSave = {
        ...formData,
        regularWorkdays: selectedWorkdays.join(' '),
        name: formData.name.trim(),
        employeeId: formData.employeeId.trim(),
        homeAddress: formData.homeAddress.trim(),
      };

      const url = isCreating ? '/api/employees' : `/api/employees/${selectedEmployee?.id}`;
      const method = isCreating ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSave),
      });

      if (response.ok) {
        showSnackbar(
          isCreating ? 'Employee created successfully' : 'Employee updated successfully',
          'success'
        );
        setEditDialogOpen(false);
        fetchEmployees();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save employee');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showSnackbar(`Failed to save employee: ${errorMessage}`, 'error');
    }
  };

  const handleDelete = async (employee: Employee) => {
    if (window.confirm(`Are you sure you want to delete ${employee.name}?`)) {
      try {
        const response = await fetch(`/api/employees/${employee.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          showSnackbar('Employee deleted successfully', 'success');
          fetchEmployees();
        } else {
          throw new Error('Failed to delete employee');
        }
      } catch (error) {
        showSnackbar('Failed to delete employee', 'error');
      }
    }
  };

  const handleInputChange = (field: keyof Employee, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleWorkdayChange = (day: string, checked: boolean) => {
    if (checked) {
      setSelectedWorkdays(prev => [...prev, day]);
    } else {
      setSelectedWorkdays(prev => prev.filter(d => d !== day));
    }
  };

  const getCapabilityLabel = (level: number) => {
    if (level <= 2) return 'Beginner';
    if (level <= 4) return 'Intermediate';
    return 'Advanced';
  };

  const getCapabilityColor = (level: number) => {
    if (level <= 2) return 'default';
    if (level <= 4) return 'primary';
    return 'success';
  };

  if (loading) return <Typography>Loading employees...</Typography>;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WorkIcon /> Employee Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          Add Employee
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Workdays</TableCell>
              <TableCell>Hours/Day</TableCell>
              <TableCell>Capability</TableCell>
              <TableCell>Hourly Rate</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>{employee.employeeId}</TableCell>
                <TableCell>{employee.name}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {employee.regularWorkdays.split(' ').filter(day => day.trim()).map((day) => (
                      <Chip key={day} label={day.slice(0, 3)} size="small" />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>{employee.minHoursPerDay}-{employee.maxHoursPerDay}h</TableCell>
                <TableCell>
                  <Chip
                    label={`${getCapabilityLabel(employee.capabilityLevel)} (${employee.capabilityLevel})`}
                    color={getCapabilityColor(employee.capabilityLevel) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {employee.hourlyRate ? `$${employee.hourlyRate}/hr` : 'Owner'}
                </TableCell>
                <TableCell>
                  <Chip
                    label={employee.activeStatus}
                    color={employee.activeStatus === 'active' ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => handleView(employee)} size="small" color="primary">
                    <VisibilityIcon />
                  </IconButton>
                  <IconButton onClick={() => handleEdit(employee)} size="small">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(employee)} size="small">
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
          {isCreating ? 'Create New Employee' : `Edit ${selectedEmployee?.name}`}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Name *"
                fullWidth
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                error={!formData.name?.trim()}
                helperText={!formData.name?.trim() ? 'Name is required' : ''}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Employee ID *"
                fullWidth
                value={formData.employeeId || ''}
                onChange={(e) => handleInputChange('employeeId', e.target.value)}
                disabled={!isCreating}
                required
                error={!formData.employeeId?.trim()}
                helperText={!formData.employeeId?.trim() ? 'Employee ID is required' : (!isCreating ? 'Cannot be changed after creation' : '')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Home Address *"
                fullWidth
                value={formData.homeAddress || ''}
                onChange={(e) => handleInputChange('homeAddress', e.target.value)}
                required
                error={!formData.homeAddress?.trim()}
                helperText={!formData.homeAddress?.trim() ? 'Home address is required' : ''}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Regular Workdays *
                {selectedWorkdays.length === 0 && (
                  <Typography component="span" color="error" sx={{ ml: 1, fontSize: '0.75rem' }}>
                    (At least one day must be selected)
                  </Typography>
                )}
              </Typography>
              <FormGroup row>
                {WEEKDAYS.map((day) => (
                  <FormControlLabel
                    key={day}
                    control={
                      <Checkbox
                        checked={selectedWorkdays.includes(day)}
                        onChange={(e) => handleWorkdayChange(day, e.target.checked)}
                      />
                    }
                    label={day}
                  />
                ))}
              </FormGroup>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Min Hours Per Day *"
                type="number"
                fullWidth
                value={formData.minHoursPerDay || ''}
                onChange={(e) => handleInputChange('minHoursPerDay', parseInt(e.target.value))}
                inputProps={{ min: 1, max: 12 }}
                required
                error={!formData.minHoursPerDay || formData.minHoursPerDay < 1}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Max Hours Per Day *"
                type="number"
                fullWidth
                value={formData.maxHoursPerDay || ''}
                onChange={(e) => handleInputChange('maxHoursPerDay', parseInt(e.target.value))}
                inputProps={{ min: 1, max: 12 }}
                required
                error={!formData.maxHoursPerDay || formData.maxHoursPerDay < 1}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Capability Level *</InputLabel>
                <Select
                  value={formData.capabilityLevel || 3}
                  onChange={(e) => handleInputChange('capabilityLevel', e.target.value)}
                  label="Capability Level *"
                >
                  <MenuItem value={1}>1 - Beginner</MenuItem>
                  <MenuItem value={2}>2 - Beginner+</MenuItem>
                  <MenuItem value={3}>3 - Intermediate</MenuItem>
                  <MenuItem value={4}>4 - Intermediate+</MenuItem>
                  <MenuItem value={5}>5 - Advanced</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Hourly Rate ($)"
                type="number"
                fullWidth
                value={formData.hourlyRate || ''}
                onChange={(e) => handleInputChange('hourlyRate', e.target.value ? parseFloat(e.target.value) : null)}
                inputProps={{ min: 0, step: 0.5 }}
                helperText="Leave empty for business owners or non-hourly employees"
              />
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
            <Grid item xs={12}>
              <TextField
                label="Notes"
                fullWidth
                multiline
                rows={3}
                value={formData.notes || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
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

export default EmployeeManagement; 