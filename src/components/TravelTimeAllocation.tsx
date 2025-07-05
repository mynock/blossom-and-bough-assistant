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
} from '@mui/material';
import {
  Preview as PreviewIcon,
  PlayArrow as ApplyIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { API_ENDPOINTS, apiClient } from '../config/api';

interface TravelTimeAllocationProps {
  onUpdate: () => void;
}

interface TravelTimeAllocation {
  workActivityId: number;
  clientName: string;
  hoursWorked: number;
  originalTravelMinutes: number;
  allocatedTravelMinutes: number;
  newBillableHours: number;
  hasZeroTravel: boolean;
}

interface TravelTimeAllocationResult {
  date: string;
  totalTravelMinutes: number;
  totalWorkHours: number;
  allocations: TravelTimeAllocation[];
  updatedActivities: number;
  warnings: string[];
}

export default function TravelTimeAllocation({ onUpdate }: TravelTimeAllocationProps) {
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to today's date
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [previewData, setPreviewData] = useState<TravelTimeAllocationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePreview = async () => {
    if (!selectedDate) {
      setError('Please select a date');
      return;
    }

    setLoading(true);
    setError(null);
    setPreviewData(null);

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

  const handleApply = async () => {
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

      {/* Date Selection and Actions */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
        <TextField
          label="Date"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <PreviewIcon />}
          onClick={handlePreview}
          disabled={loading || !selectedDate}
        >
          Preview Allocation
        </Button>
        {previewData && (
          <Button
            variant="contained"
            startIcon={applying ? <CircularProgress size={16} /> : <ApplyIcon />}
            onClick={handleApply}
            disabled={applying || !selectedDate}
            color="primary"
          >
            Apply Changes
          </Button>
        )}
      </Box>

      {/* Preview Results */}
      {previewData && previewData.allocations && (
        <Box sx={{ mb: 2 }}>
          {/* Summary */}
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
            </Box>
          </Box>

          {/* Warnings */}
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

          {/* Allocation Table */}
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

          {/* Update Status */}
          {previewData.updatedActivities > 0 && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Successfully updated {previewData.updatedActivities} work activities
            </Alert>
          )}
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