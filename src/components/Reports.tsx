import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { subDays, subMonths, subYears, format } from 'date-fns';
import {
  reportsApi, 
  ReportFilters, 
  TimeSeriesDataPoint, 
  ReportSummary,
  clientsApi,
  employeesApi,
} from '../services/api';
import TimeSeriesChart from './charts/TimeSeriesChart';
import BreakdownChart from './charts/BreakdownChart';
import SummaryCards from './charts/SummaryCards';

interface Employee {
  id: number;
  name: string;
}

const Reports: React.FC = () => {
  // State for filters
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: format(subMonths(new Date(), 3), 'yyyy-MM-dd'), // Default to last 3 months
    endDate: format(new Date(), 'yyyy-MM-dd'),
  });
  
  // State for time scale
  const [timeScale, setTimeScale] = useState<'day' | 'week' | 'month' | 'year'>('week');
  
  // State for data
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesDataPoint[]>([]);
  const [summaryData, setSummaryData] = useState<ReportSummary | null>(null);
  const [clients, setClients] = useState<Array<{ id: number; name: string }>>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // State for UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick date filter presets
  const quickFilters = [
    { label: 'Last 7 Days', startDate: subDays(new Date(), 7) },
    { label: 'Last 30 Days', startDate: subDays(new Date(), 30) },
    { label: 'Last 3 Months', startDate: subMonths(new Date(), 3) },
    { label: 'Last 6 Months', startDate: subMonths(new Date(), 6) },
    { label: 'Last Year', startDate: subYears(new Date(), 1) },
  ];

  const dayOfWeekOptions = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ];

  // Load initial data
  useEffect(() => {
    loadClients();
    loadEmployees();
  }, []);

  // Load data when filters change
  useEffect(() => {
    loadReportData();
  }, [filters, timeScale]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadClients = async () => {
    try {
      const response = await clientsApi.getAll();
      setClients(response.clients.map(c => ({ id: c.id, name: c.name })));
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await employeesApi.getAll();
      setEmployees(response.employees);
    } catch (error) {
      console.error('Error loading employees:', error);
      // Fallback to placeholder data if API fails
      setEmployees([
        { id: 1, name: 'Andrea' },
        { id: 2, name: 'Employee 2' },
      ]);
    }
  };

  const loadReportData = async () => {
    if (!filters.startDate || !filters.endDate) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [timeSeriesResponse, summaryResponse] = await Promise.all([
        reportsApi.getTimeSeriesData(filters, timeScale),
        reportsApi.getSummaryData(filters),
      ]);
      
      setTimeSeriesData(timeSeriesResponse);
      setSummaryData(summaryResponse);
    } catch (error) {
      console.error('Error loading report data:', error);
      setError('Failed to load report data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFilter = (startDate: Date) => {
    setFilters({
      ...filters,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    });
  };

  const handleFilterChange = (field: keyof ReportFilters, value: any) => {
    setFilters({
      ...filters,
      [field]: value,
    });
  };

  const clearFilters = () => {
    setFilters({
      startDate: format(subMonths(new Date(), 3), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    });
  };

  const timeSeriesChartData = [
    {
      key: 'billableHours' as keyof TimeSeriesDataPoint,
      name: 'Billable Hours',
      color: '#2e7d32',
    },
    {
      key: 'totalHours' as keyof TimeSeriesDataPoint,
      name: 'Total Hours',
      color: '#558b2f',
    },
    {
      key: 'travelTimeHours' as keyof TimeSeriesDataPoint,
      name: 'Travel Time',
      color: '#ff9800',
    },
    {
      key: 'breakTimeHours' as keyof TimeSeriesDataPoint,
      name: 'Break Time',
      color: '#2196f3',
    },
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
        Reports
      </Typography>

      {/* Filters */}
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Filters
        </Typography>
        
        {/* Quick Filter Buttons */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Quick Filters:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {quickFilters.map((preset) => (
              <Button
                key={preset.label}
                variant="outlined"
                size="small"
                onClick={() => handleQuickFilter(preset.startDate)}
              >
                {preset.label}
              </Button>
            ))}
          </Box>
        </Box>

        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <DatePicker
              label="Start Date"
              value={filters.startDate ? new Date(filters.startDate) : null}
              onChange={(date) => 
                handleFilterChange('startDate', date ? format(date, 'yyyy-MM-dd') : '')
              }
              slotProps={{
                textField: { fullWidth: true, size: 'small' }
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <DatePicker
              label="End Date"
              value={filters.endDate ? new Date(filters.endDate) : null}
              onChange={(date) => 
                handleFilterChange('endDate', date ? format(date, 'yyyy-MM-dd') : '')
              }
              slotProps={{
                textField: { fullWidth: true, size: 'small' }
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Client</InputLabel>
              <Select
                value={filters.clientId || ''}
                onChange={(e) => handleFilterChange('clientId', e.target.value ? Number(e.target.value) : undefined)}
                label="Client"
              >
                <MenuItem value="">All Clients</MenuItem>
                {clients.map((client) => (
                  <MenuItem key={client.id} value={client.id}>
                    {client.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Employee</InputLabel>
              <Select
                value={filters.employeeId || ''}
                onChange={(e) => handleFilterChange('employeeId', e.target.value ? Number(e.target.value) : undefined)}
                label="Employee"
              >
                <MenuItem value="">All Employees</MenuItem>
                {employees.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Day of Week</InputLabel>
              <Select
                value={filters.dayOfWeek || ''}
                onChange={(e) => handleFilterChange('dayOfWeek', e.target.value || undefined)}
                label="Day of Week"
              >
                <MenuItem value="">All Days</MenuItem>
                {dayOfWeekOptions.map((day) => (
                  <MenuItem key={day} value={day}>
                    {day}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button variant="outlined" onClick={clearFilters}>
            Clear Filters
          </Button>
          
          <Typography variant="body2" color="text.secondary">
            Time Scale:
          </Typography>
          <ToggleButtonGroup
            value={timeScale}
            exclusive
            onChange={(_, newScale) => newScale && setTimeScale(newScale)}
            size="small"
          >
            <ToggleButton value="day">Day</ToggleButton>
            <ToggleButton value="week">Week</ToggleButton>
            <ToggleButton value="month">Month</ToggleButton>
            <ToggleButton value="year">Year</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Paper>

      {/* Loading/Error States */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      {summaryData && !loading && (
        <SummaryCards summary={summaryData} />
      )}

      {/* Time Series Chart */}
      {timeSeriesData.length > 0 && !loading && (
        <TimeSeriesChart
          data={timeSeriesData}
          title={`Hours Over Time (${timeScale})`}
          dataKeys={timeSeriesChartData}
          groupBy={timeScale}
        />
      )}

      {/* Breakdown Charts */}
      {summaryData && !loading && (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={4}>
            <BreakdownChart
              data={summaryData.clientBreakdown.map(c => ({
                name: c.clientName,
                value: c.billableHours,
                billableHours: c.billableHours,
                totalHours: c.totalHours,
                activities: c.activities,
              }))}
              title="Hours by Client"
              dataKey="billableHours"
              height={300}
            />
          </Grid>
          
          <Grid item xs={12} lg={4}>
            <BreakdownChart
              data={summaryData.employeeBreakdown.map(e => ({
                name: e.employeeName,
                value: e.billableHours,
                billableHours: e.billableHours,
                totalHours: e.totalHours,
                activities: e.activities,
              }))}
              title="Hours by Employee"
              dataKey="billableHours"
              height={300}
            />
          </Grid>
          
          <Grid item xs={12} lg={4}>
            <BreakdownChart
              data={summaryData.dayOfWeekBreakdown.map(d => ({
                name: d.dayOfWeek,
                value: d.billableHours,
                billableHours: d.billableHours,
                totalHours: d.totalHours,
                activities: d.activities,
              }))}
              title="Hours by Day of Week"
              dataKey="billableHours"
              height={300}
            />
          </Grid>
        </Grid>
      )}

      {/* No Data Message */}
      {!loading && timeSeriesData.length === 0 && (
        <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            No data found for the selected filters
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your date range or removing some filters
          </Typography>
        </Paper>
      )}
    </Container>
  );
};

export default Reports;
