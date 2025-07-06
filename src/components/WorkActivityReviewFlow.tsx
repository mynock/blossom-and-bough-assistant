import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  LinearProgress,
  Stack,
  Divider,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Paper,
} from '@mui/material';
import {
  CheckCircle,
  NavigateNext,
  NavigateBefore,
  Edit,
  PendingActions,
  AccessTime,
  Person,
  Close,
  Save,
  Cancel,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS } from '../config/api';
import { formatDateLongPacific } from '../utils/dateUtils';

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
  clientId?: number;
  clientName?: string;
  travelTimeMinutes?: number;
  breakTimeMinutes?: number;
  nonBillableTimeMinutes?: number;
  notes: string | null;
  tasks: string | null;
  notionPageId?: string;
  lastNotionSyncAt?: string;
  employeesList: Array<{ employeeId: number; employeeName: string | null; hours: number }>;
  chargesList: Array<any>;
  plantsList: Array<any>;
  totalCharges: number;
}



const WORK_TYPES = [
  'maintenance',
  'installation',
  'repair',
  'consultation',
  'design',
  'cleanup',
  'office_work',
  'travel',
  'other'
];

const WorkActivityReviewFlow: React.FC = () => {
  const navigate = useNavigate();
  const [activitiesNeedingReview, setActivitiesNeedingReview] = useState<WorkActivity[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editedActivity, setEditedActivity] = useState<Partial<WorkActivity>>({});
  const [approvedActivityIds, setApprovedActivityIds] = useState<Set<number>>(new Set());

  const currentActivity = activitiesNeedingReview[currentIndex];
  const isLastActivity = currentIndex === activitiesNeedingReview.length - 1;
  const totalActivities = activitiesNeedingReview.length;
  const processedCount = approvedActivityIds.size;
  const progress = totalActivities > 0 ? (processedCount / totalActivities) * 100 : 0;
  const remainingCount = totalActivities - processedCount;
  const isCurrentActivityApproved = currentActivity ? approvedActivityIds.has(currentActivity.id) : false;

  const fetchActivitiesNeedingReview = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_ENDPOINTS.WORK_ACTIVITIES}?status=needs_review`);
      if (!response.ok) {
        throw new Error('Failed to fetch activities needing review');
      }
      const data = await response.json();
      setActivitiesNeedingReview(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivitiesNeedingReview();
  }, [fetchActivitiesNeedingReview]);

  const handleApprove = async (activityId: number) => {
    try {
      setSaving(true);
      const response = await fetch(`${API_ENDPOINTS.WORK_ACTIVITIES}/${activityId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'completed'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve activity');
      }

      // Mark as approved locally (keep in list for navigation)
      setApprovedActivityIds(prev => new Set([...prev, activityId]));
      
      // Move to next unprocessed activity if available
      const nextUnprocessedIndex = findNextUnprocessedActivity();
      if (nextUnprocessedIndex !== null) {
        setCurrentIndex(nextUnprocessedIndex);
      } else if (!isLastActivity) {
        handleNext();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve activity');
    } finally {
      setSaving(false);
    }
  };

  const handleUnapprove = async (activityId: number) => {
    try {
      setSaving(true);
      const response = await fetch(`${API_ENDPOINTS.WORK_ACTIVITIES}/${activityId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'needs_review'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to unapprove activity');
      }

      // Remove from approved set
      setApprovedActivityIds(prev => {
        const newSet = new Set([...prev]);
        newSet.delete(activityId);
        return newSet;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unapprove activity');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    setEditedActivity({
      ...currentActivity,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!currentActivity) return;

    try {
      setSaving(true);
      
      // Determine status based on whether it's already approved
      const newStatus = isCurrentActivityApproved ? 'completed' : 'completed';
      
      const response = await fetch(`${API_ENDPOINTS.WORK_ACTIVITIES}/${currentActivity.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...editedActivity,
          status: newStatus
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      // Update local activity data
      setActivitiesNeedingReview(prev => 
        prev.map(activity => 
          activity.id === currentActivity.id 
            ? { ...activity, ...editedActivity }
            : activity
        )
      );
      
      // Mark as approved if it wasn't already
      if (!isCurrentActivityApproved) {
        setApprovedActivityIds(prev => new Set([...prev, currentActivity.id]));
      }

      setEditDialogOpen(false);
      setEditedActivity({});
      
      // Move to next unprocessed activity if available (only if this wasn't already approved)
      if (!isCurrentActivityApproved) {
        const nextUnprocessedIndex = findNextUnprocessedActivity();
        if (nextUnprocessedIndex !== null) {
          setCurrentIndex(nextUnprocessedIndex);
        } else if (!isLastActivity) {
          handleNext();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const findNextUnprocessedActivity = () => {
    for (let i = currentIndex + 1; i < activitiesNeedingReview.length; i++) {
      if (!approvedActivityIds.has(activitiesNeedingReview[i].id)) {
        return i;
      }
    }
    return null;
  };

  const handleNext = () => {
    if (currentIndex < activitiesNeedingReview.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSkipToNextUnprocessed = () => {
    const nextUnprocessedIndex = findNextUnprocessedActivity();
    if (nextUnprocessedIndex !== null) {
      setCurrentIndex(nextUnprocessedIndex);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading activities to review...</Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </Container>
    );
  }

  if (activitiesNeedingReview.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            All Caught Up! 🎉
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            There are no work activities that need review right now.
          </Typography>
          <Button variant="contained" onClick={() => navigate('/work-activities')}>
            View All Activities
          </Button>
        </Paper>
      </Container>
    );
  }

  // Show completion state when all activities are processed
  if (remainingCount === 0) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            Review Session Complete! 🎉
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            You've reviewed and approved all {totalActivities} work activities.
          </Typography>
          <Stack direction="row" spacing={2} sx={{ justifyContent: 'center' }}>
            <Button variant="contained" onClick={() => navigate('/work-activities')}>
              View All Activities
            </Button>
            <Button variant="outlined" onClick={() => window.location.reload()}>
              Check for New Reviews
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  if (!currentActivity) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">
          No activity selected for review.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Review Work Activities
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Review and approve work activities synced from Notion
        </Typography>
      </Box>

      {/* Progress */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Activity {currentIndex + 1} of {totalActivities}
            </Typography>
            <Chip 
              label={`${remainingCount} remaining`} 
              color={remainingCount === 0 ? "success" : "warning"} 
              icon={<PendingActions />} 
            />
          </Box>
          <LinearProgress variant="determinate" value={progress} sx={{ mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {Math.round(progress)}% complete ({processedCount} of {totalActivities} approved)
          </Typography>
        </CardContent>
      </Card>

      {/* Activity Details */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h5" gutterBottom>
                      {currentActivity.clientName}
                    </Typography>
                    {isCurrentActivityApproved && (
                      <Chip 
                        label="Approved" 
                        color="success" 
                        size="small" 
                        icon={<CheckCircle />}
                      />
                    )}
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    <Chip 
                      label={formatDateLongPacific(currentActivity.date)} 
                      icon={<AccessTime />} 
                      size="small" 
                    />
                    <Chip 
                      label={currentActivity.workType.replace('_', ' ').toUpperCase()} 
                      variant="outlined" 
                      size="small" 
                    />
                    <Chip 
                      label={`${currentActivity.totalHours}h`} 
                      color="primary" 
                      size="small" 
                    />
                  </Stack>
                </Box>
                <IconButton onClick={handleEdit} color="primary" size="large">
                  <Edit />
                </IconButton>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Time Details */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Start Time
                  </Typography>
                  <Typography variant="body1">
                    {currentActivity.startTime || 'Not specified'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    End Time
                  </Typography>
                  <Typography variant="body1">
                    {currentActivity.endTime || 'Not specified'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Billable Hours
                  </Typography>
                  <Typography variant="body1">
                    {currentActivity.billableHours || 0}h
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Hours
                  </Typography>
                  <Typography variant="body1">
                    {currentActivity.totalHours}h
                  </Typography>
                </Grid>
              </Grid>

              {/* Employees */}
              {currentActivity.employeesList.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Team Members
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {currentActivity.employeesList.map((emp, index) => (
                      <Chip
                        key={index}
                        label={`${emp.employeeName} (${emp.hours}h)`}
                        icon={<Person />}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Tasks */}
              {currentActivity.tasks && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Tasks Completed
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {currentActivity.tasks}
                  </Typography>
                </Box>
              )}

              {/* Notes */}
              {currentActivity.notes && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Notes
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {currentActivity.notes}
                  </Typography>
                </Box>
              )}

              {/* Charges */}
              {currentActivity.chargesList.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Additional Charges
                  </Typography>
                  <Stack spacing={1}>
                    {currentActivity.chargesList.map((charge, index) => (
                      <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">
                          {charge.description} {charge.quantity && `(${charge.quantity})`}
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {charge.totalCost ? formatCurrency(charge.totalCost) : 'N/A'}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle2">Total Charges:</Typography>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {formatCurrency(currentActivity.totalCharges)}
                    </Typography>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Actions Panel */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Review Actions
              </Typography>
              
              <Stack spacing={2}>
                {isCurrentActivityApproved ? (
                  <Button
                    variant="outlined"
                    color="warning"
                    fullWidth
                    size="large"
                    startIcon={<Cancel />}
                    onClick={() => handleUnapprove(currentActivity.id)}
                    disabled={saving}
                  >
                    {saving ? <CircularProgress size={20} /> : 'Unapprove'}
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="success"
                    fullWidth
                    size="large"
                    startIcon={<CheckCircle />}
                    onClick={() => handleApprove(currentActivity.id)}
                    disabled={saving}
                  >
                    {saving ? <CircularProgress size={20} /> : 'Approve'}
                  </Button>
                )}

                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Edit />}
                  onClick={handleEdit}
                  disabled={saving}
                >
                  {isCurrentActivityApproved ? 'Edit' : 'Edit & Approve'}
                </Button>

                {findNextUnprocessedActivity() !== null && (
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={handleSkipToNextUnprocessed}
                    disabled={saving}
                    color="primary"
                  >
                    Skip to Next Unprocessed
                  </Button>
                )}

                <Divider />

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<NavigateBefore />}
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    sx={{ flex: 1 }}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outlined"
                    endIcon={<NavigateNext />}
                    onClick={handleNext}
                    disabled={isLastActivity}
                    sx={{ flex: 1 }}
                  >
                    Next
                  </Button>
                </Box>

                <Button
                  variant="text"
                  onClick={() => navigate('/work-activities')}
                  fullWidth
                >
                  View All Activities
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Edit Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Edit Work Activity
          <IconButton
            onClick={() => setEditDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Work Type</InputLabel>
                <Select
                  value={editedActivity.workType || ''}
                  onChange={(e) => setEditedActivity(prev => ({ ...prev, workType: e.target.value }))}
                  label="Work Type"
                >
                  {WORK_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.replace('_', ' ').toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Date"
                type="date"
                fullWidth
                value={editedActivity.date || ''}
                onChange={(e) => setEditedActivity(prev => ({ ...prev, date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Start Time"
                type="time"
                fullWidth
                value={editedActivity.startTime || ''}
                onChange={(e) => setEditedActivity(prev => ({ ...prev, startTime: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="End Time"
                type="time"
                fullWidth
                value={editedActivity.endTime || ''}
                onChange={(e) => setEditedActivity(prev => ({ ...prev, endTime: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Total Hours"
                type="number"
                fullWidth
                value={editedActivity.totalHours || ''}
                onChange={(e) => setEditedActivity(prev => ({ ...prev, totalHours: parseFloat(e.target.value) || 0 }))}
                inputProps={{ step: 0.25, min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Billable Hours"
                type="number"
                fullWidth
                value={editedActivity.billableHours || ''}
                onChange={(e) => setEditedActivity(prev => ({ ...prev, billableHours: parseFloat(e.target.value) || 0 }))}
                inputProps={{ step: 0.25, min: 0 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Tasks"
                fullWidth
                multiline
                rows={3}
                value={editedActivity.tasks || ''}
                onChange={(e) => setEditedActivity(prev => ({ ...prev, tasks: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes"
                fullWidth
                multiline
                rows={3}
                value={editedActivity.notes || ''}
                onChange={(e) => setEditedActivity(prev => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} startIcon={<Cancel />}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveEdit} 
            variant="contained" 
            startIcon={<Save />}
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} /> : isCurrentActivityApproved ? 'Save Changes' : 'Save & Approve'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default WorkActivityReviewFlow; 