import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Snackbar,
  FormGroup,
  Checkbox,
  Tabs,
  Tab,
  TablePagination,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { formatDatePacific } from '../utils/dateUtils';

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

interface EmployeeSummary {
  totalActivities: number;
  totalHours: number;
  totalBillableHours: number;
  totalEarnings: number;
  statusBreakdown: Record<string, number>;
  workTypeBreakdown: Record<string, number>;
  lastActivityDate: string | null;
  yearToDateHours: number;
  averageHoursPerDay: number;
  completionRate: number;
  clientsWorkedWith: string[];
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`employee-tabpanel-${index}`}
      aria-labelledby={`employee-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const EmployeeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [workActivities, setWorkActivities] = useState<WorkActivity[]>([]);
  const [summary, setSummary] = useState<EmployeeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Employee>>({});
  const [selectedWorkdays, setSelectedWorkdays] = useState<string[]>([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [tabValue, setTabValue] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    const fetchEmployeeData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch employee details
        const employeeResponse = await fetch(`/api/employees/${id}`);
        if (!employeeResponse.ok) throw new Error('Failed to fetch employee');
        const employeeData = await employeeResponse.json();
        setEmployee(employeeData);

        // Fetch work activities and summary
        const activitiesResponse = await fetch(`/api/employees/${id}/work-activities`);
        if (!activitiesResponse.ok) throw new Error('Failed to fetch work activities');
        const activitiesData = await activitiesResponse.json();
        setWorkActivities(activitiesData.activities);
        setSummary(activitiesData.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchEmployeeData();
    }
  }, [id]);



  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'primary';
      case 'planned': return 'warning';
      case 'invoiced': return 'secondary';
      default: return 'default';
    }
  };

  const handleEdit = () => {
    if (employee) {
      setFormData(employee);
      setSelectedWorkdays(employee.regularWorkdays.split(' ').filter(day => day.trim()));
      setEditDialogOpen(true);
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

  const handleSave = async () => {
    try {
      const dataToSave = {
        ...formData,
        regularWorkdays: selectedWorkdays.join(' '),
      };

      const response = await fetch(`/api/employees/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSave),
      });

      if (response.ok) {
        const updatedEmployee = await response.json();
        setEmployee(updatedEmployee);
        setSnackbar({ open: true, message: 'Employee updated successfully', severity: 'success' });
        setEditDialogOpen(false);
      } else {
        throw new Error('Failed to save employee');
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to save employee', severity: 'error' });
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !employee) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Employee not found'}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/employees')} sx={{ mt: 2 }}>
          Back to Employees
        </Button>
      </Box>
    );
  }

  // Calculate work activities for current page
  const paginatedWorkActivities = workActivities.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/employees')} variant="outlined">
            Back
          </Button>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon /> {employee.name}
          </Typography>
          <Chip 
            label={employee.activeStatus} 
            color={employee.activeStatus === 'active' ? 'success' : 'default'} 
            size="small" 
          />
          <Chip 
            label={employee.employeeId} 
            color="primary" 
            size="small" 
          />
        </Box>
        <Button startIcon={<EditIcon />} variant="contained" onClick={handleEdit}>
          Edit Employee
        </Button>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="employee detail tabs">
          <Tab label="Overview" icon={<PersonIcon />} />
          <Tab label="Work Activities" icon={<WorkIcon />} />
          <Tab label="Performance" icon={<TrendingUpIcon />} />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          {/* Summary Statistics */}
          <Grid item xs={12}>
            <Typography variant="h5" gutterBottom>Performance Summary</Typography>
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
                    <ScheduleIcon sx={{ fontSize: 40, color: 'success.main' }} />
                    <Typography variant="h4">{summary?.totalHours.toFixed(1) || 0}</Typography>
                    <Typography variant="body2" color="text.secondary">Total Hours</Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <MoneyIcon sx={{ fontSize: 40, color: 'warning.main' }} />
                    <Typography variant="h4">{formatCurrency(summary?.totalEarnings || 0)}</Typography>
                    <Typography variant="body2" color="text.secondary">Total Earnings</Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <TrendingUpIcon sx={{ fontSize: 40, color: 'secondary.main' }} />
                    <Typography variant="h4">{summary?.completionRate.toFixed(1) || 0}%</Typography>
                    <Typography variant="body2" color="text.secondary">Completion Rate</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>

          {/* Employee Information */}
          <Grid item xs={12} md={6}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon /> Employee Information
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Employee ID</Typography>
                    <Typography variant="body1">{employee.employeeId}</Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">Home Address</Typography>
                    <Typography variant="body1">{employee.homeAddress}</Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">Capability Level</Typography>
                    <Chip 
                      label={`${getCapabilityLabel(employee.capabilityLevel)} (${employee.capabilityLevel})`}
                      color={getCapabilityColor(employee.capabilityLevel) as any}
                      size="small" 
                    />
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">Hourly Rate</Typography>
                    <Typography variant="body1">
                      {employee.hourlyRate ? formatCurrency(employee.hourlyRate) : 'Owner/Salaried'}
                    </Typography>
                  </Box>
                  
                  {employee.notes && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">Notes</Typography>
                      <Typography variant="body1">{employee.notes}</Typography>
                    </Box>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Work Schedule */}
          <Grid item xs={12} md={6}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ScheduleIcon /> Work Schedule
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>Regular Workdays</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {employee.regularWorkdays.split(' ').filter(day => day.trim()).map((day) => (
                        <Chip key={day} label={day} size="small" color="primary" />
                      ))}
                    </Box>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">Hours per Day</Typography>
                    <Typography variant="body1">{employee.minHoursPerDay} - {employee.maxHoursPerDay} hours</Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">Average Hours per Day</Typography>
                    <Typography variant="body1">{summary?.averageHoursPerDay.toFixed(1) || 0} hours</Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">Last Activity</Typography>
                    <Typography variant="body1">{formatDatePacific(summary?.lastActivityDate)}</Typography>
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Work Activities Tab */}
      <TabPanel value={tabValue} index={1}>
        <Typography variant="h5" gutterBottom>Work Activities</Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Work Type</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Hours</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Earnings</TableCell>
                <TableCell>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedWorkActivities.map((activity) => {
                const employeeHours = activity.employeesList.find(emp => emp.employeeId === employee.id)?.hours || 0;
                const earnings = employeeHours * (activity.hourlyRate || employee.hourlyRate || 0);
                
                return (
                  <TableRow key={activity.id}>
                    <TableCell>{formatDatePacific(activity.date)}</TableCell>
                    <TableCell>
                      <Chip label={activity.workType} size="small" />
                    </TableCell>
                    <TableCell>{activity.clientName || '-'}</TableCell>
                    <TableCell>{employeeHours.toFixed(1)}h</TableCell>
                    <TableCell>
                      <Chip 
                        label={activity.status} 
                        color={getStatusColor(activity.status) as any} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>{formatCurrency(earnings)}</TableCell>
                    <TableCell>{activity.notes ? activity.notes.substring(0, 50) + '...' : '-'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={workActivities.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      </TabPanel>

      {/* Performance Tab */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Work Type Distribution</Typography>
                {summary?.workTypeBreakdown && Object.entries(summary.workTypeBreakdown).map(([type, count]) => (
                  <Box key={type} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2">{type}</Typography>
                    <Chip label={count} size="small" />
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Status Distribution</Typography>
                {summary?.statusBreakdown && Object.entries(summary.statusBreakdown).map(([status, count]) => (
                  <Box key={status} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2">{status}</Typography>
                    <Chip label={count} size="small" color={getStatusColor(status) as any} />
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Clients Worked With</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {summary?.clientsWorkedWith?.map((client, index) => (
                    <Chip key={index} label={client} size="small" color="primary" />
                  )) || <Typography variant="body2" color="text.secondary">No client data available</Typography>}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit {employee.name}</DialogTitle>
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
                label="Employee ID"
                fullWidth
                value={formData.employeeId || ''}
                onChange={(e) => handleInputChange('employeeId', e.target.value)}
                disabled
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Home Address"
                fullWidth
                value={formData.homeAddress || ''}
                onChange={(e) => handleInputChange('homeAddress', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Regular Workdays</Typography>
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
                label="Min Hours Per Day"
                type="number"
                fullWidth
                value={formData.minHoursPerDay || ''}
                onChange={(e) => handleInputChange('minHoursPerDay', parseInt(e.target.value))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Max Hours Per Day"
                type="number"
                fullWidth
                value={formData.maxHoursPerDay || ''}
                onChange={(e) => handleInputChange('maxHoursPerDay', parseFloat(e.target.value))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Capability Level</InputLabel>
                <Select
                  value={formData.capabilityLevel || 3}
                  onChange={(e) => handleInputChange('capabilityLevel', e.target.value)}
                  label="Capability Level"
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
          <Button onClick={handleSave} variant="contained">Save</Button>
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

export default EmployeeDetail;