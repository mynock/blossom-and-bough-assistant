import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Alert,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Preview as PreviewIcon,
  PlayArrow as ApplyIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  DateRange as DateRangeIcon,
  Today as TodayIcon,
} from '@mui/icons-material';
import { apiClient } from '../config/api';

interface BreakTimeAllocationProps {
  onUpdate: () => void;
}

interface BreakTimeAllocationItem {
  workActivityId: number;
  clientName: string;
  hoursWorked: number;
  originalBreakMinutes: number;
  allocatedBreakMinutes: number;
  newBillableHours: number;
  hasZeroBreak: boolean;
  originalBillableHours?: number;
  billableHourChange?: number;
  minuteChange?: number;
}

interface BreakTimeAllocationResult {
  date: string;
  totalBreakMinutes: number;
  totalWorkHours: number;
  allocations: BreakTimeAllocationItem[];
  updatedActivities: number;
  warnings: string[];
  clientSummary?: {
    [clientName: string]: {
      activitiesCount: number;
      totalBillableHourChange: number;
      totalMinuteChange: number;
      originalBillableHours: number;
      newBillableHours: number;
    };
  };
  totalBillableHourChange?: number;
}

interface BreakTimeAllocationRangeResult {
  startDate: string;
  endDate: string;
  dateResults: BreakTimeAllocationResult[];
  totalBreakMinutes: number;
  totalWorkHours: number;
  totalAllocations: number;
  totalUpdatedActivities: number;
  overallSummary: {
    totalDays: number;
    daysWithData: number;
    daysWithWarnings: number;
    daysWithNoData: number;
  };
  clientSummary?: {
    [clientName: string]: {
      activitiesCount: number;
      totalBillableHourChange: number;
      totalMinuteChange: number;
      originalBillableHours: number;
      newBillableHours: number;
      datesAffected: string[];
    };
  };
  totalBillableHourChange?: number;
}

export default function BreakTimeAllocation({ onUpdate }: BreakTimeAllocationProps) {
  const [isDateRangeMode, setIsDateRangeMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<BreakTimeAllocationResult | null>(null);
  const [rangePreviewData, setRangePreviewData] = useState<BreakTimeAllocationRangeResult | null>(null);

  const getCurrentDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const resetForm = () => {
    setSelectedDate('');
    setStartDate('');
    setEndDate('');
    setPreviewData(null);
    setRangePreviewData(null);
    setError(null);
    setSuccess(null);
  };

  const handleModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsDateRangeMode(event.target.checked);
    resetForm();
  };

  const handleSingleDatePreview = async () => {
    if (!selectedDate) {
      setError('Please select a date');
      return;
    }

    setLoading(true);
    setError(null);
    setPreviewData(null);
    setRangePreviewData(null);

    try {
      const response = await apiClient.post('/api/break-time/calculate', {
        date: selectedDate
      });
      const data = await response.json();
      setPreviewData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate break time allocation');
    } finally {
      setLoading(false);
    }
  };

  const handleRangePreview = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date must be before or equal to end date');
      return;
    }

    setLoading(true);
    setError(null);
    setPreviewData(null);
    setRangePreviewData(null);

    try {
      const response = await apiClient.post('/api/break-time/calculate-range', {
        startDate,
        endDate
      });
      const data = await response.json();
      setRangePreviewData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate break time allocation for date range');
    } finally {
      setLoading(false);
    }
  };



  const handleSingleDateApply = async () => {
    if (!selectedDate) {
      setError('Please select a date');
      return;
    }

    setApplying(true);
    setError(null);

    try {
      const response = await apiClient.post('/api/break-time/apply', {
        date: selectedDate
      });
      const data = await response.json();
      setPreviewData(data);
      setSuccess(`Successfully updated ${data.updatedActivities} work activities`);
      // Refresh the work activities table
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to apply break time allocation');
    } finally {
      setApplying(false);
    }
  };

  const handleRangeApply = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date must be before or equal to end date');
      return;
    }

    setApplying(true);
    setError(null);

    try {
      const response = await apiClient.post('/api/break-time/apply-range', {
        startDate,
        endDate
      });
      const data = await response.json();
      setRangePreviewData(data);
      setSuccess(`Successfully updated ${data.totalUpdatedActivities} work activities across ${data.overallSummary.totalDays} days`);
      // Refresh the work activities table
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to apply break time allocation for date range');
    } finally {
      setApplying(false);
    }
  };

  const formatMinutes = (minutes: number | undefined | null) => {
    if (minutes === undefined || minutes === null || isNaN(minutes)) {
      return '0m';
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatHours = (hours: number | undefined | null) => {
    if (hours === undefined || hours === null || isNaN(hours)) {
      return '0.00h';
    }
    return `${hours.toFixed(2)}h`;
  };

  const renderSingleDatePreview = () => {
    if (!previewData) return null;

    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Break Time Allocation Preview - {previewData.date}
        </Typography>
        
        {previewData.warnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Warnings:
            </Typography>
            <ul style={{ marginTop: 0, marginBottom: 0 }}>
              {previewData.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </Alert>
        )}

        <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip 
            label={`Total Break Time: ${formatMinutes(previewData.totalBreakMinutes)}`}
            color="primary"
            variant="outlined"
          />
          <Chip 
            label={`Total Work Hours: ${formatHours(previewData.totalWorkHours)}`}
            color="secondary"
            variant="outlined"
          />
          <Chip 
            label={`Activities: ${previewData.allocations.length}`}
            color="default"
            variant="outlined"
          />
          {previewData.totalBillableHourChange !== undefined && (
            <Chip 
              label={`Total Hour Change: ${previewData.totalBillableHourChange >= 0 ? '+' : ''}${formatHours(previewData.totalBillableHourChange)}`}
              color={previewData.totalBillableHourChange >= 0 ? "success" : "error"}
              variant="outlined"
            />
          )}
        </Box>

        {previewData.clientSummary && Object.keys(previewData.clientSummary).length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Client Impact Summary
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Client</TableCell>
                    <TableCell align="right">Activities</TableCell>
                    <TableCell align="right">Billable Hour Change</TableCell>
                    <TableCell align="right">Break Time Change</TableCell>
                    <TableCell align="right">Original Hours</TableCell>
                    <TableCell align="right">New Hours</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(previewData.clientSummary).map(([clientName, summary]) => (
                    <TableRow key={clientName}>
                      <TableCell><strong>{clientName}</strong></TableCell>
                      <TableCell align="right">{summary.activitiesCount}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ color: summary.totalBillableHourChange >= 0 ? 'success.main' : 'error.main' }}>
                          {summary.totalBillableHourChange >= 0 ? '+' : ''}{formatHours(summary.totalBillableHourChange)}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ color: summary.totalMinuteChange >= 0 ? 'primary.main' : 'warning.main' }}>
                          {summary.totalMinuteChange >= 0 ? '+' : ''}{formatMinutes(summary.totalMinuteChange)}
                        </Box>
                      </TableCell>
                      <TableCell align="right">{formatHours(summary.originalBillableHours)}</TableCell>
                      <TableCell align="right">{formatHours(summary.newBillableHours)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Client</TableCell>
                <TableCell align="right">Work Hours</TableCell>
                <TableCell align="right">Original Break</TableCell>
                <TableCell align="right">Allocated Break</TableCell>
                <TableCell align="right">New Billable Hours</TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {previewData.allocations.map((allocation) => (
                <TableRow key={allocation.workActivityId}>
                  <TableCell>{allocation.clientName}</TableCell>
                  <TableCell align="right">{formatHours(allocation.hoursWorked)}</TableCell>
                  <TableCell align="right">{formatMinutes(allocation.originalBreakMinutes)}</TableCell>
                  <TableCell align="right">{formatMinutes(allocation.allocatedBreakMinutes)}</TableCell>
                  <TableCell align="right">{formatHours(allocation.newBillableHours)}</TableCell>
                  <TableCell align="center">
                    {allocation.hasZeroBreak ? (
                      <Chip 
                        icon={<WarningIcon />}
                        label="No Break" 
                        color="warning" 
                        size="small"
                      />
                    ) : (
                      <Chip 
                        label="Ready" 
                        color="success" 
                        size="small"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const renderRangePreview = () => {
    if (!rangePreviewData) return null;

    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Break Time Allocation Preview - {rangePreviewData.startDate} to {rangePreviewData.endDate}
        </Typography>
        
        <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip 
            label={`Total Break Time: ${formatMinutes(rangePreviewData.totalBreakMinutes)}`}
            color="primary"
            variant="outlined"
          />
          <Chip 
            label={`Total Work Hours: ${formatHours(rangePreviewData.totalWorkHours)}`}
            color="secondary"
            variant="outlined"
          />
          <Chip 
            label={`Days with Data: ${rangePreviewData.overallSummary.daysWithData}`}
            color="default"
            variant="outlined"
          />
          <Chip 
            label={`Total Activities: ${rangePreviewData.totalAllocations}`}
            color="default"
            variant="outlined"
          />
          {rangePreviewData.totalBillableHourChange !== undefined && (
            <Chip 
              label={`Total Hour Change: ${rangePreviewData.totalBillableHourChange >= 0 ? '+' : ''}${formatHours(rangePreviewData.totalBillableHourChange)}`}
              color={rangePreviewData.totalBillableHourChange >= 0 ? "success" : "error"}
              variant="outlined"
            />
          )}
        </Box>

        {rangePreviewData.overallSummary.daysWithWarnings > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {rangePreviewData.overallSummary.daysWithWarnings} day(s) have warnings. 
            Check individual date details below.
          </Alert>
        )}

        {rangePreviewData.clientSummary && Object.keys(rangePreviewData.clientSummary).length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Client Impact Summary (Across All Dates)
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Client</TableCell>
                    <TableCell align="right">Total Activities</TableCell>
                    <TableCell align="right">Billable Hour Change</TableCell>
                    <TableCell align="right">Break Time Change</TableCell>
                    <TableCell align="right">Dates Affected</TableCell>
                    <TableCell align="right">Original Hours</TableCell>
                    <TableCell align="right">New Hours</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(rangePreviewData.clientSummary).map(([clientName, summary]) => (
                    <TableRow key={clientName}>
                      <TableCell><strong>{clientName}</strong></TableCell>
                      <TableCell align="right">{summary.activitiesCount}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ color: summary.totalBillableHourChange >= 0 ? 'success.main' : 'error.main' }}>
                          {summary.totalBillableHourChange >= 0 ? '+' : ''}{formatHours(summary.totalBillableHourChange)}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ color: summary.totalMinuteChange >= 0 ? 'primary.main' : 'warning.main' }}>
                          {summary.totalMinuteChange >= 0 ? '+' : ''}{formatMinutes(summary.totalMinuteChange)}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Chip 
                          label={`${summary.datesAffected.length} days`} 
                          size="small" 
                          variant="outlined"
                          title={summary.datesAffected.join(', ')}
                        />
                      </TableCell>
                      <TableCell align="right">{formatHours(summary.originalBillableHours)}</TableCell>
                      <TableCell align="right">{formatHours(summary.newBillableHours)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {rangePreviewData.dateResults.map((dateResult, index) => (
          <Accordion key={dateResult.date} sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1 }}>
                <Typography variant="subtitle1">
                  {dateResult.date}
                </Typography>
                <Chip 
                  size="small"
                  label={`${formatMinutes(dateResult.totalBreakMinutes)}`}
                  color="primary"
                  variant="outlined"
                />
                <Chip 
                  size="small"
                  label={`${dateResult.allocations.length} activities`}
                  color="default"
                  variant="outlined"
                />
                {dateResult.warnings.length > 0 && (
                  <Chip 
                    size="small"
                    icon={<WarningIcon />}
                    label={`${dateResult.warnings.length} warnings`}
                    color="warning"
                    variant="outlined"
                  />
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {dateResult.warnings.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <ul style={{ marginTop: 0, marginBottom: 0 }}>
                    {dateResult.warnings.map((warning, wIndex) => (
                      <li key={wIndex}>{warning}</li>
                    ))}
                  </ul>
                </Alert>
              )}
              
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Client</TableCell>
                      <TableCell align="right">Work Hours</TableCell>
                      <TableCell align="right">Original Break</TableCell>
                      <TableCell align="right">Allocated Break</TableCell>
                      <TableCell align="right">New Billable Hours</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dateResult.allocations.map((allocation) => (
                      <TableRow key={allocation.workActivityId}>
                        <TableCell>{allocation.clientName}</TableCell>
                        <TableCell align="right">{formatHours(allocation.hoursWorked)}</TableCell>
                        <TableCell align="right">{formatMinutes(allocation.originalBreakMinutes)}</TableCell>
                        <TableCell align="right">{formatMinutes(allocation.allocatedBreakMinutes)}</TableCell>
                        <TableCell align="right">{formatHours(allocation.newBillableHours)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        ☕ Break Time Allocation
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Distribute break time proportionally across work activities based on billable hours.
        This helps ensure fair allocation of break time when multiple clients share the same day.
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={isDateRangeMode}
              onChange={handleModeChange}
              color="primary"
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isDateRangeMode ? <DateRangeIcon /> : <TodayIcon />}
              <Typography>
                {isDateRangeMode ? 'Date Range Mode' : 'Single Date Mode'}
              </Typography>
            </Box>
          }
        />

        {!isDateRangeMode ? (
          <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'end', flexWrap: 'wrap' }}>
            <TextField
              label="Date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 200 }}
            />
            <Button
              onClick={() => setSelectedDate(getCurrentDate())}
              variant="outlined"
              size="small"
            >
              Today
            </Button>
            <Button
              variant="contained"
              onClick={handleSingleDatePreview}
              disabled={loading || applying}
              startIcon={loading ? <CircularProgress size={20} /> : <PreviewIcon />}
            >
              {loading ? 'Calculating...' : 'Preview Allocation'}
            </Button>
            
            {previewData && (
              <Button
                variant="contained"
                color="primary"
                onClick={handleSingleDateApply}
                disabled={loading || applying}
                startIcon={applying ? <CircularProgress size={20} /> : <ApplyIcon />}
              >
                {applying ? 'Applying...' : 'Apply Allocation'}
              </Button>
            )}
          </Box>
        ) : (
          <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'end', flexWrap: 'wrap' }}>
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 200 }}
            />
            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 200 }}
            />
            <Button
              variant="contained"
              onClick={handleRangePreview}
              disabled={loading || applying}
              startIcon={loading ? <CircularProgress size={20} /> : <PreviewIcon />}
            >
              {loading ? 'Calculating...' : 'Preview Range'}
            </Button>
            
            {rangePreviewData && (
              <Button
                variant="contained"
                color="primary"
                onClick={handleRangeApply}
                disabled={loading || applying}
                startIcon={applying ? <CircularProgress size={20} /> : <ApplyIcon />}
              >
                {applying ? 'Applying...' : 'Apply to Range'}
              </Button>
            )}
          </Box>
        )}
      </Paper>

      {renderSingleDatePreview()}
      {renderRangePreview()}

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={4000}
        onClose={() => setSuccess(null)}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
}