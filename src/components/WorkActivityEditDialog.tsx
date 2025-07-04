import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Paper,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { EditorState, ContentState, convertToRaw } from 'draft-js';
import { Editor } from 'react-draft-wysiwyg';
import draftToHtml from 'draftjs-to-html';
import htmlToDraft from 'html-to-draftjs';
import 'react-draft-wysiwyg/dist/react-draft-wysiwyg.css';

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

interface Client {
  id: number;
  clientId: string;
  name: string;
}

interface WorkActivityEditDialogProps {
  open: boolean;
  onClose: () => void;
  activity: WorkActivity | null;
  isCreating: boolean;
  onSave: (activity: WorkActivity, employees: Array<{ employeeId: number; hours: number }>, charges: Array<OtherCharge>, plants: Array<PlantListItem>) => Promise<void>;
  clients: Client[];
  projects: Project[];
  employees: Employee[];
  onShowSnackbar: (message: string, severity: 'success' | 'error' | 'warning') => void;
}

const WorkActivityEditDialog: React.FC<WorkActivityEditDialogProps> = ({
  open,
  onClose,
  activity,
  isCreating,
  onSave,
  clients,
  projects,
  employees,
  onShowSnackbar,
}) => {
  const [formData, setFormData] = useState<Partial<WorkActivity>>({});
  const [selectedEmployees, setSelectedEmployees] = useState<Array<{ employeeId: number; hours: number }>>([]);
  const [selectedCharges, setSelectedCharges] = useState<Array<OtherCharge>>([]);
  const [selectedPlants, setSelectedPlants] = useState<Array<PlantListItem>>([]);
  const [employeeToAdd, setEmployeeToAdd] = useState<number | ''>('');
  const [chargeFormData, setChargeFormData] = useState({
    chargeType: 'material',
    description: '',
    quantity: 1,
    unitRate: 0,
    totalCost: 0,
    billable: true
  });
  const [plantFormData, setPlantFormData] = useState({
    name: '',
    quantity: 1
  });
  const [notesEditorState, setNotesEditorState] = useState(EditorState.createEmpty());
  const [tasksEditorState, setTasksEditorState] = useState(EditorState.createEmpty());

  // Helper functions
  const htmlToEditorState = (html: string) => {
    try {
      if (!html || html.trim() === '') {
        return EditorState.createEmpty();
      }
      
      const contentBlock = htmlToDraft(html);
      if (contentBlock) {
        const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
        return EditorState.createWithContent(contentState);
      }
    } catch (error) {
      console.warn('Error converting HTML to editor state:', error);
    }
    return EditorState.createEmpty();
  };

  const editorStateToHtml = (editorState: EditorState) => {
    return draftToHtml(convertToRaw(editorState.getCurrentContent()));
  };

  // Initialize form data when activity changes
  useEffect(() => {
    if (isCreating) {
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
      setSelectedCharges([]);
      setSelectedPlants([]);
      setNotesEditorState(EditorState.createEmpty());
      setTasksEditorState(EditorState.createEmpty());
    } else if (activity) {
      setFormData(activity);
      setSelectedEmployees(activity.employeesList.map(emp => ({
        employeeId: emp.employeeId,
        hours: emp.hours
      })));
      setSelectedCharges(activity.chargesList.map(charge => ({
        chargeType: charge.chargeType,
        description: charge.description,
        quantity: charge.quantity,
        unitRate: charge.unitRate,
        totalCost: charge.totalCost,
        billable: charge.billable
      })));
      setSelectedPlants(activity.plantsList.map(plant => ({
        name: plant.name,
        quantity: plant.quantity
      })));
      setNotesEditorState(htmlToEditorState(activity.notes || ''));
      setTasksEditorState(htmlToEditorState(activity.tasks || ''));
    }

    // Reset form states
    setEmployeeToAdd('');
    setChargeFormData({
      chargeType: 'material',
      description: '',
      quantity: 1,
      unitRate: 0,
      totalCost: 0,
      billable: true
    });
    setPlantFormData({
      name: '',
      quantity: 1
    });
  }, [activity, isCreating, open]);

  const handleInputChange = (field: keyof WorkActivity, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Add date validation warning
    if (field === 'date' && value) {
      const selectedDate = new Date(value + 'T00:00:00-08:00');
      const currentDatePT = new Date().toLocaleString('en-US', {timeZone: 'America/Los_Angeles'});
      const currentYear = new Date(currentDatePT).getFullYear();
      const selectedYear = selectedDate.getFullYear();
      
      if (selectedYear < currentYear) {
        onShowSnackbar(`Warning: Selected date is from ${selectedYear}. Did you mean ${currentYear}?`, 'error');
      }
    }
  };

  // Employee management
  const handleAddEmployee = () => {
    if (employeeToAdd && !selectedEmployees.some(sel => sel.employeeId === employeeToAdd)) {
      setSelectedEmployees(prev => [...prev, { 
        employeeId: employeeToAdd as number, 
        hours: formData.totalHours || 8 
      }]);
      setEmployeeToAdd('');
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

  // Charge management
  const handleAddCharge = () => {
    if (!chargeFormData.description.trim()) {
      onShowSnackbar('Please enter a charge description', 'error');
      return;
    }

    const newCharge: Omit<OtherCharge, 'id'> = {
      chargeType: chargeFormData.chargeType,
      description: chargeFormData.description.trim(),
      quantity: chargeFormData.quantity || 1,
      unitRate: chargeFormData.unitRate || 0,
      totalCost: chargeFormData.totalCost || 0,
      billable: chargeFormData.billable
    };

    setSelectedCharges(prev => [...prev, newCharge]);
    
    setChargeFormData({
      chargeType: 'material',
      description: '',
      quantity: 1,
      unitRate: 0,
      totalCost: 0,
      billable: true
    });
  };

  const handleRemoveCharge = (index: number) => {
    setSelectedCharges(prev => prev.filter((_, i) => i !== index));
  };

  const handleChargeFormChange = (field: keyof typeof chargeFormData, value: any) => {
    setChargeFormData(prev => ({ ...prev, [field]: value }));
  };

  // Plant management
  const handleAddPlant = () => {
    if (!plantFormData.name.trim()) {
      onShowSnackbar('Please enter a plant name', 'error');
      return;
    }

    const newPlant: Omit<PlantListItem, 'id'> = {
      name: plantFormData.name.trim(),
      quantity: plantFormData.quantity || 1
    };

    setSelectedPlants(prev => [...prev, newPlant]);
    
    setPlantFormData({
      name: '',
      quantity: 1
    });
  };

  const handleRemovePlant = (index: number) => {
    setSelectedPlants(prev => prev.filter((_, i) => i !== index));
  };

  const handlePlantFormChange = (field: keyof typeof plantFormData, value: any) => {
    setPlantFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      if (selectedEmployees.length === 0) {
        onShowSnackbar('At least one employee must be assigned', 'error');
        return;
      }

      // Convert editor states back to HTML
      const updatedFormData = {
        ...formData,
        notes: editorStateToHtml(notesEditorState),
        tasks: editorStateToHtml(tasksEditorState),
      } as WorkActivity;

      await onSave(updatedFormData, selectedEmployees, selectedCharges, selectedPlants);
      onClose();
    } catch (error) {
      onShowSnackbar('Failed to save work activity', 'error');
    }
  };

  const filteredProjects = projects.filter(project => 
    !formData.clientId || project.clientId === formData.clientId
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      sx={{ '& .MuiDialog-paper': { height: '90vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          {isCreating ? 'Create New Work Activity' : 'Edit Work Activity'}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers sx={{ height: 'calc(90vh - 160px)', overflowY: 'auto' }}>
        <Grid container spacing={3}>
          {/* Basic Information Section */}
          <Grid item xs={12}>
            <Typography variant="h6" color="primary" gutterBottom sx={{ mb: 2 }}>
              📋 Basic Information
            </Typography>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth required>
              <InputLabel>Work Type</InputLabel>
              <Select
                value={formData.workType || ''}
                onChange={(e) => handleInputChange('workType', e.target.value)}
                label="Work Type"
              >
                <MenuItem value="maintenance">Maintenance</MenuItem>
                <MenuItem value="installation">Installation</MenuItem>
                <MenuItem value="consultation">Consultation</MenuItem>
                <MenuItem value="emergency">Emergency</MenuItem>
                <MenuItem value="seasonal_cleanup">Seasonal Cleanup</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Date"
              type="date"
              fullWidth
              required
              value={formData.date || ''}
              onChange={(e) => handleInputChange('date', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status || ''}
                onChange={(e) => handleInputChange('status', e.target.value)}
                label="Status"
              >
                <MenuItem value="planned">Planned</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
                <MenuItem value="rescheduled">Rescheduled</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Client</InputLabel>
              <Select
                value={formData.clientId || ''}
                onChange={(e) => handleInputChange('clientId', e.target.value)}
                label="Client"
              >
                <MenuItem value="">
                  <em>Select Client</em>
                </MenuItem>
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
              <InputLabel>Project (Optional)</InputLabel>
              <Select
                value={formData.projectId || ''}
                onChange={(e) => handleInputChange('projectId', e.target.value)}
                label="Project (Optional)"
                disabled={!formData.clientId}
              >
                <MenuItem value="">
                  <em>No Project</em>
                </MenuItem>
                {filteredProjects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Time & Billing Section */}
          <Grid item xs={12}>
            <Typography variant="h6" color="primary" gutterBottom sx={{ mb: 2, mt: 3 }}>
              ⏰ Time & Billing
            </Typography>
          </Grid>
          
          <Grid item xs={12} sm={3}>
            <TextField
              label="Total Hours"
              type="number"
              fullWidth
              required
              value={formData.totalHours || ''}
              onChange={(e) => handleInputChange('totalHours', parseFloat(e.target.value))}
              inputProps={{ min: 0, step: 0.25 }}
              helperText="Total time on site"
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

          {/* Other Charges Section */}
          <Grid item xs={12}>
            <Typography variant="h6" color="primary" gutterBottom sx={{ mb: 2, mt: 3 }}>
              💰 Other Charges
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add materials, services, debris removal, or other billable charges for this work activity.
            </Typography>
            
            {/* Add Charge Form */}
            <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                Add New Charge
              </Typography>
              
              <Grid container spacing={2} alignItems="flex-end">
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={chargeFormData.chargeType}
                      onChange={(e) => handleChargeFormChange('chargeType', e.target.value)}
                      label="Type"
                    >
                      <MenuItem value="material">Material</MenuItem>
                      <MenuItem value="service">Service</MenuItem>
                      <MenuItem value="debris">Debris</MenuItem>
                      <MenuItem value="delivery">Delivery</MenuItem>
                      <MenuItem value="equipment">Equipment</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="Description *"
                    fullWidth
                    size="small"
                    value={chargeFormData.description}
                    onChange={(e) => handleChargeFormChange('description', e.target.value)}
                    placeholder="e.g., 1 bag debris, 3 astrantia plants, mulch delivery"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    label="Quantity"
                    type="number"
                    fullWidth
                    size="small"
                    value={chargeFormData.quantity}
                    onChange={(e) => handleChargeFormChange('quantity', parseInt(e.target.value) || 1)}
                    inputProps={{ min: 1 }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={chargeFormData.billable}
                        onChange={(e) => handleChargeFormChange('billable', e.target.checked)}
                      />
                    }
                    label="Billable"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={2}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleAddCharge}
                    disabled={!chargeFormData.description.trim()}
                  >
                    Add Charge
                  </Button>
                </Grid>
              </Grid>
            </Box>
            
            {/* Charges List */}
            {selectedCharges.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                  Added Charges ({selectedCharges.length})
                </Typography>
                
                <List dense>
                  {selectedCharges.map((charge, index) => (
                    <ListItem key={index} divider={index < selectedCharges.length - 1}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Chip 
                              label={charge.chargeType} 
                              size="small" 
                              color="primary" 
                              variant="outlined"
                            />
                            <Typography component="span" sx={{ fontWeight: 500 }}>
                              {charge.description}
                            </Typography>
                            <Typography component="span" color="text.secondary">
                              (Qty: {charge.quantity})
                            </Typography>
                            {!charge.billable && (
                              <Chip label="Non-billable" size="small" color="default" />
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton 
                          edge="end" 
                          onClick={() => handleRemoveCharge(index)}
                          size="small"
                          color="error"
                          title="Remove Charge"
                        >
                          <RemoveIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Grid>

          {/* Plant List Section */}
          <Grid item xs={12}>
            <Typography variant="h6" color="primary" gutterBottom sx={{ mb: 2, mt: 3 }}>
              🌱 Plant List
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Track plants used in this work activity.
            </Typography>
            
            {/* Add Plant Form */}
            <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                Add New Plant
              </Typography>
              
              <Grid container spacing={2} alignItems="flex-end">
                <Grid item xs={12} sm={6} md={6}>
                  <TextField
                    label="Plant Name *"
                    fullWidth
                    size="small"
                    value={plantFormData.name}
                    onChange={(e) => handlePlantFormChange('name', e.target.value)}
                    placeholder="e.g., Astrantia, Lavender, Japanese Maple"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label="Quantity"
                    type="number"
                    fullWidth
                    size="small"
                    value={plantFormData.quantity}
                    onChange={(e) => handlePlantFormChange('quantity', parseInt(e.target.value) || 1)}
                    inputProps={{ min: 1 }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleAddPlant}
                    disabled={!plantFormData.name.trim()}
                  >
                    Add Plant
                  </Button>
                </Grid>
              </Grid>
            </Box>
            
            {/* Plants List */}
            {selectedPlants.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                  Added Plants ({selectedPlants.length})
                </Typography>
                
                <List dense>
                  {selectedPlants.map((plant, index) => (
                    <ListItem key={index} divider={index < selectedPlants.length - 1}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography component="span" sx={{ fontWeight: 500 }}>
                              {plant.name}
                            </Typography>
                            <Typography component="span" color="text.secondary">
                              (Qty: {plant.quantity})
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton 
                          edge="end" 
                          onClick={() => handleRemovePlant(index)}
                          size="small"
                          color="error"
                          title="Remove Plant"
                        >
                          <RemoveIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Grid>

          {/* Notes Section */}
          <Grid item xs={12}>
            <Typography variant="h6" color="primary" gutterBottom sx={{ mb: 2, mt: 3 }}>
              📝 Notes
            </Typography>
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, minHeight: 150 }}>
              <Editor
                editorState={notesEditorState}
                onEditorStateChange={setNotesEditorState}
                toolbar={{
                  options: ['inline', 'blockType', 'list', 'link', 'history'],
                  inline: { options: ['bold', 'italic', 'underline'] },
                  blockType: { options: ['Normal', 'H1', 'H2', 'H3', 'Blockquote'] },
                  list: { options: ['unordered', 'ordered'] }
                }}
                placeholder="Add detailed notes about the work performed..."
              />
            </Box>
          </Grid>

          {/* Tasks Section */}
          <Grid item xs={12}>
            <Typography variant="h6" color="primary" gutterBottom sx={{ mb: 2, mt: 3 }}>
              ✅ Tasks & Checklist
            </Typography>
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, minHeight: 150 }}>
              <Editor
                editorState={tasksEditorState}
                onEditorStateChange={setTasksEditorState}
                toolbar={{
                  options: ['inline', 'blockType', 'list', 'link', 'history'],
                  inline: { options: ['bold', 'italic', 'underline'] },
                  blockType: { options: ['Normal', 'H1', 'H2', 'H3', 'Blockquote'] },
                  list: { options: ['unordered', 'ordered'] }
                }}
                placeholder="List tasks completed or checklist items..."
              />
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={selectedEmployees.length === 0}
        >
          {isCreating ? 'Create Activity' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WorkActivityEditDialog; 