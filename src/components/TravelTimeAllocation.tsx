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

interface TravelTimeAllocationProps {
  onUpdate: () => void;
}

interface TravelTimeAllocationItem {
  workActivityId: number;
  clientName: string;
  hoursWorked: number;
  originalTravelMinutes: number;
  allocatedTravelMinutes: number;
  newBillableHours: number;
  hasZeroTravel: boolean;
  originalBillableHours?: number;
  billableHourChange?: number;
  minuteChange?: number;
}

interface TravelTimeAllocationResult {
  date: string;
  totalTravelMinutes: number;
  totalWorkHours: number;
  allocations: TravelTimeAllocationItem[];
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

// New interface for date range results
interface TravelTimeAllocationRangeResult {
  startDate: string;
  endDate: string;
  dateResults: TravelTimeAllocationResult[];
  totalUpdatedActivities: number;
  overallSummary: {
    totalDays: number;
    totalTravelMinutes: number;
    totalWorkHours: number;
    totalAllocations: number;
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

export default function TravelTimeAllocation({ onUpdate }: TravelTimeAllocationProps) {
  const [isDateRangeMode, setIsDateRangeMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to today's date
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [startDate, setStartDate] = useState(() => {
    // Default to today's date
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    // Default to today's date
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [previewData, setPreviewData] = useState<TravelTimeAllocationResult | null>(null);
  const [rangePreviewData, setRangePreviewData] = useState<TravelTimeAllocationRangeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Clear preview data when switching modes
  const handleModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsDateRangeMode(event.target.checked);
    setPreviewData(null);
    setRangePreviewData(null);
    setError(null);
    setSuccess(null);
  };

  const handlePreview = async () => {
    if (isDateRangeMode) {
      await handleRangePreview();
    } else {
      await handleSingleDatePreview();
    }
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
      const response = await apiClient.post('/api/travel-time/calculate', {
        date: selectedDate
      });
      const data = await response.json();
      setPreviewData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate travel time allocation');
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
      const response = await apiClient.post('/api/travel-time/calculate-range', {
        startDate,
        endDate
      });
      const data = await response.json();
      setRangePreviewData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate travel time allocation for date range');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (isDateRangeMode) {
      await handleRangeApply();
    } else {
      await handleSingleDateApply();
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
      const response = await apiClient.post('/api/travel-time/apply', {
        date: selectedDate
      });
      const data = await response.json();
      setPreviewData(data);
      setSuccess(`Successfully updated ${data.updatedActivities} work activities`);
      // Refresh the work activities table
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to apply travel time allocation');
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
      const response = await apiClient.post('/api/travel-time/apply-range', {
        startDate,
        endDate
      });
      const data = await response.json();
      setRangePreviewData(data);
      setSuccess(`Successfully updated ${data.totalUpdatedActivities} work activities across ${data.overallSummary.totalDays} days`);
      // Refresh the work activities table
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to apply travel time allocation for date range');
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
      return '0h';
    }
    return `${hours.toFixed(2)}h`;
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Travel Time Proportional Allocation
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Allocate total daily travel time proportionally across work activities based on hours worked.
      </Typography>

      {/* Mode Toggle */}
      <Box sx={{ mb: 3 }}>
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
              <Typography variant="body2">
                {isDateRangeMode ? 'Date Range Mode' : 'Single Date Mode'}
              </Typography>
            </Box>
          }
        />
      </Box>

      {/* Date Selection and Actions */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        {!isDateRangeMode ? (
          <TextField
            label="Date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
        ) : (
          <>
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </>
        )}
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <PreviewIcon />}
          onClick={handlePreview}
          disabled={loading || (!isDateRangeMode && !selectedDate) || (isDateRangeMode && (!startDate || !endDate))}
        >
          Preview Allocation
        </Button>
        {(previewData || rangePreviewData) && (
          <Button
            variant="contained"
            startIcon={applying ? <CircularProgress size={16} /> : <ApplyIcon />}
            onClick={handleApply}
            disabled={applying || (!isDateRangeMode && !selectedDate) || (isDateRangeMode && (!startDate || !endDate))}
            color="primary"
          >
            Apply Changes
          </Button>
        )}
      </Box>

      {/* Preview Results */}
      {!isDateRangeMode && previewData && previewData.allocations && (
        <Box sx={{ mb: 2 }}>
          {/* Single Date Summary */}
          <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle1" gutterBottom>
              Allocation Summary for {previewData.date}
            </Typography>
            <Box sx={{ display: 'flex', gap: 4 }}>
              <Typography variant="body2">
                <strong>Total Travel Time:</strong> {formatMinutes(previewData.totalTravelMinutes)}
              </Typography>
              <Typography variant="body2">
                <strong>Total Billable Hours:</strong> {formatHours(previewData.totalWorkHours)}
              </Typography>
              <Typography variant="body2">
                <strong>Activities:</strong> {previewData.allocations.length}
              </Typography>
              {previewData.totalBillableHourChange !== undefined && (
                <Typography variant="body2">
                  <strong>Total Hour Change:</strong> 
                  <span style={{ color: previewData.totalBillableHourChange >= 0 ? '#4caf50' : '#f44336' }}>
                    {previewData.totalBillableHourChange >= 0 ? '+' : ''}{formatHours(previewData.totalBillableHourChange)}
                  </span>
                </Typography>
              )}
            </Box>
          </Box>

          {/* Client Impact Summary for Single Date */}
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
                      <TableCell align="right">Travel Time Change</TableCell>
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

          {/* Single Date Warnings */}
          {previewData.warnings && previewData.warnings.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
              <Typography variant="subtitle2" gutterBottom>Warnings:</Typography>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {previewData.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </Alert>
          )}

          {/* Single Date Allocation Table */}
          <TableContainer component={Paper} sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Client</TableCell>
                  <TableCell align="right">Billable Hours</TableCell>
                  <TableCell align="right">Original Travel</TableCell>
                  <TableCell align="right">Allocated Travel</TableCell>
                  <TableCell align="right">New Billable Hours</TableCell>
                  <TableCell align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {previewData.allocations.map((allocation) => (
                  <TableRow key={allocation.workActivityId}>
                    <TableCell>{allocation.clientName}</TableCell>
                    <TableCell align="right">{formatHours(allocation.hoursWorked)}</TableCell>
                    <TableCell align="right">{formatMinutes(allocation.originalTravelMinutes)}</TableCell>
                    <TableCell align="right">
                      <strong>{formatMinutes(allocation.allocatedTravelMinutes)}</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{formatHours(allocation.newBillableHours)}</strong>
                    </TableCell>
                    <TableCell align="center">
                      {allocation.hasZeroTravel && (
                        <Chip 
                          label="Zero Travel" 
                          color="warning" 
                          size="small" 
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Single Date Update Status */}
          {previewData.updatedActivities > 0 && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Successfully updated {previewData.updatedActivities} work activities
            </Alert>
          )}
        </Box>
      )}

      {/* Date Range Preview Results */}
      {isDateRangeMode && rangePreviewData && (
        <Box sx={{ mb: 2 }}>
          {/* Range Summary */}
          <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle1" gutterBottom>
              Date Range Allocation Summary ({rangePreviewData.startDate} to {rangePreviewData.endDate})
            </Typography>
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Typography variant="body2">
                <strong>Total Days:</strong> {rangePreviewData.overallSummary.totalDays}
              </Typography>
              <Typography variant="body2">
                <strong>Days with Data:</strong> {rangePreviewData.dateResults.length}
              </Typography>
              <Typography variant="body2">
                <strong>Total Travel Time:</strong> {formatMinutes(rangePreviewData.overallSummary.totalTravelMinutes)}
              </Typography>
              <Typography variant="body2">
                <strong>Total Billable Hours:</strong> {formatHours(rangePreviewData.overallSummary.totalWorkHours)}
              </Typography>
              <Typography variant="body2">
                <strong>Total Allocations:</strong> {rangePreviewData.overallSummary.totalAllocations}
              </Typography>
              <Typography variant="body2">
                <strong>Days with Warnings:</strong> {rangePreviewData.overallSummary.daysWithWarnings}
              </Typography>
              <Typography variant="body2">
                <strong>Days Skipped:</strong> {rangePreviewData.overallSummary.daysWithNoData}
              </Typography>
              {rangePreviewData.totalBillableHourChange !== undefined && (
                <Typography variant="body2">
                  <strong>Total Hour Change:</strong> 
                  <span style={{ color: rangePreviewData.totalBillableHourChange >= 0 ? '#4caf50' : '#f44336' }}>
                    {rangePreviewData.totalBillableHourChange >= 0 ? '+' : ''}{formatHours(rangePreviewData.totalBillableHourChange)}
                  </span>
                </Typography>
              )}
            </Box>
          </Box>

          {/* Range Update Status */}
          {rangePreviewData.totalUpdatedActivities > 0 && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Successfully updated {rangePreviewData.totalUpdatedActivities} work activities across {rangePreviewData.overallSummary.totalDays} days
            </Alert>
          )}

          {/* Client Impact Summary for Date Range */}
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
                      <TableCell align="right">Travel Time Change</TableCell>
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

          {/* Days Skipped Info */}
          {rangePreviewData.overallSummary.daysWithNoData > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Skipped {rangePreviewData.overallSummary.daysWithNoData} days with no work activities. 
              Days with activities but no travel time are still shown below.
            </Alert>
          )}

          {/* Individual Date Results */}
          {rangePreviewData.dateResults.map((dateResult, index) => (
            <Accordion key={dateResult.date} defaultExpanded={rangePreviewData.dateResults.length <= 3}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  <Typography variant="subtitle2">{dateResult.date}</Typography>
                  <Chip 
                    label={`${dateResult.allocations.length} activities`} 
                    size="small" 
                    variant="outlined"
                  />
                  {formatMinutes(dateResult.totalTravelMinutes) !== '0m' && (
                    <Chip 
                      label={formatMinutes(dateResult.totalTravelMinutes)} 
                      size="small" 
                      color="primary"
                    />
                  )}
                  {dateResult.warnings.length > 0 && (
                    <Chip 
                      label={`${dateResult.warnings.length} warnings`} 
                      size="small" 
                      color="warning"
                    />
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {dateResult.allocations.length > 0 ? (
                  <>
                    {/* Date-specific summary */}
                    <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="body2" gutterBottom>
                        <strong>Travel Time:</strong> {formatMinutes(dateResult.totalTravelMinutes)} | 
                        <strong> Billable Hours:</strong> {formatHours(dateResult.totalWorkHours)} | 
                        <strong> Activities:</strong> {dateResult.allocations.length}
                      </Typography>
                    </Box>

                    {/* Date-specific warnings */}
                    {dateResult.warnings.length > 0 && (
                      <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
                        <Typography variant="subtitle2" gutterBottom>Warnings:</Typography>
                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                          {dateResult.warnings.map((warning, wIndex) => (
                            <li key={wIndex}>{warning}</li>
                          ))}
                        </ul>
                      </Alert>
                    )}

                    {/* Date-specific allocation table */}
                    <TableContainer component={Paper}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Client</TableCell>
                            <TableCell align="right">Billable Hours</TableCell>
                            <TableCell align="right">Original Travel</TableCell>
                            <TableCell align="right">Allocated Travel</TableCell>
                            <TableCell align="right">New Billable Hours</TableCell>
                            <TableCell align="center">Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {dateResult.allocations.map((allocation) => (
                            <TableRow key={allocation.workActivityId}>
                              <TableCell>{allocation.clientName}</TableCell>
                              <TableCell align="right">{formatHours(allocation.hoursWorked)}</TableCell>
                              <TableCell align="right">{formatMinutes(allocation.originalTravelMinutes)}</TableCell>
                              <TableCell align="right">
                                <strong>{formatMinutes(allocation.allocatedTravelMinutes)}</strong>
                              </TableCell>
                              <TableCell align="right">
                                <strong>{formatHours(allocation.newBillableHours)}</strong>
                              </TableCell>
                              <TableCell align="center">
                                {allocation.hasZeroTravel && (
                                  <Chip 
                                    label="Zero Travel" 
                                    color="warning" 
                                    size="small" 
                                    variant="outlined"
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                ) : (
                  <Alert severity="info">
                    No work activities found for this date, or no travel time to allocate.
                  </Alert>
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Snackbars for feedback */}
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