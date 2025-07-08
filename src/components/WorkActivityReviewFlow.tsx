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
  DirectionsCar,
  Warning,
  OpenInNew,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS, apiClient } from '../config/api';
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
  adjustedTravelTimeMinutes?: number;
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

interface TravelTimeAllocationItem {
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
  allocations: TravelTimeAllocationItem[];
  updatedActivities: number;
  warnings: string[];
}

interface BulkTravelTimeDate {
  date: string;
  activitiesCount: number;
  totalTravelMinutes: number;
  hasUnallocatedTravel: boolean;
  clientsInvolved: string[];
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
  
  // Travel time allocation state
  const [travelTimePreview, setTravelTimePreview] = useState<TravelTimeAllocationResult | null>(null);
  const [travelTimeDialogOpen, setTravelTimeDialogOpen] = useState(false);
  const [allocatingTravelTime, setAllocatingTravelTime] = useState(false);
  const [completionTravelSummary, setCompletionTravelSummary] = useState<{ 
    datesWithUnallocatedTravel: string[]; 
    totalUnallocatedMinutes: number;
    activitiesWithTravel: number;
  } | null>(null);
  
  // Bulk travel time allocation state
  const [showBulkTravelAllocation, setShowBulkTravelAllocation] = useState(false);
  const [bulkTravelDates, setBulkTravelDates] = useState<BulkTravelTimeDate[]>([]);
  const [bulkAllocationResults, setBulkAllocationResults] = useState<Record<string, TravelTimeAllocationResult>>({});
  const [selectedBulkDates, setSelectedBulkDates] = useState<Set<string>>(new Set());

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
      const activities = Array.isArray(data) ? data : [];
      setActivitiesNeedingReview(activities);
      
      // Analyze activities for bulk travel time allocation
      analyzeBulkTravelTimeNeeds(activities);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, []);

  const analyzeBulkTravelTimeNeeds = (activities: WorkActivity[]) => {
    const dateMap = new Map<string, BulkTravelTimeDate>();
    
    activities.forEach(activity => {
      if (!dateMap.has(activity.date)) {
        dateMap.set(activity.date, {
          date: activity.date,
          activitiesCount: 0,
          totalTravelMinutes: 0,
          hasUnallocatedTravel: false,
          clientsInvolved: []
        });
      }
      
      const dateInfo = dateMap.get(activity.date)!;
      dateInfo.activitiesCount++;
      
      if (activity.travelTimeMinutes && activity.travelTimeMinutes > 0) {
        dateInfo.totalTravelMinutes += activity.travelTimeMinutes;
        if (!activity.adjustedTravelTimeMinutes) {
          dateInfo.hasUnallocatedTravel = true;
        }
      }
      
      if (activity.clientName && !dateInfo.clientsInvolved.includes(activity.clientName)) {
        dateInfo.clientsInvolved.push(activity.clientName);
      }
    });
    
    const datesNeedingAllocation = Array.from(dateMap.values())
      .filter(date => date.hasUnallocatedTravel && date.totalTravelMinutes > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    
    setBulkTravelDates(datesNeedingAllocation);
    
    // Show bulk allocation step if there are dates needing allocation
    if (datesNeedingAllocation.length > 0) {
      setShowBulkTravelAllocation(true);
    }
  };

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

  const handleTravelTimePreview = async () => {
    if (!currentActivity) return;

    try {
      setAllocatingTravelTime(true);
      const response = await apiClient.post('/api/travel-time/calculate', {
        date: currentActivity.date
      });
      const data = await response.json();
      setTravelTimePreview(data);
      setTravelTimeDialogOpen(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to preview travel time allocation');
    } finally {
      setAllocatingTravelTime(false);
    }
  };

  const handleTravelTimeApply = async () => {
    if (!currentActivity) return;

    try {
      setAllocatingTravelTime(true);
      await apiClient.post('/api/travel-time/apply', {
        date: currentActivity.date
      });
      
      // Refresh activities to show updated travel time allocations
      await fetchActivitiesNeedingReview();
      
      setTravelTimeDialogOpen(false);
      setTravelTimePreview(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to apply travel time allocation');
    } finally {
      setAllocatingTravelTime(false);
    }
  };

  const formatMinutes = (minutes: number | undefined | null) => {
    if (minutes === undefined || minutes === null || isNaN(minutes)) {
      return '0 min';
    }
    return `${minutes} min`;
  };

  const handleEmployeeHoursChange = (employeeIndex: number, newHours: number) => {
    setEditedActivity(prev => {
      const updatedEmployeesList = [...(prev.employeesList || [])];
      if (updatedEmployeesList[employeeIndex]) {
        updatedEmployeesList[employeeIndex] = {
          ...updatedEmployeesList[employeeIndex],
          hours: newHours
        };
      }
      
      // Calculate new total hours from employee hours
      const newTotalHours = updatedEmployeesList.reduce((sum, emp) => sum + (emp.hours || 0), 0);
      const roundedTotalHours = Math.round(newTotalHours * 4) / 4;
      
      // Calculate billable hours by subtracting non-billable time
      const newBillableHours = calculateBillableHours(roundedTotalHours, prev.nonBillableTimeMinutes || 0);
      
      return {
        ...prev,
        employeesList: updatedEmployeesList,
        totalHours: roundedTotalHours,
        billableHours: newBillableHours
      };
    });
  };

  const handleNonBillableTimeChange = (newNonBillableMinutes: number) => {
    setEditedActivity(prev => {
      const totalHours = prev.totalHours || 0;
      const newBillableHours = calculateBillableHours(totalHours, newNonBillableMinutes);
      
      return {
        ...prev,
        nonBillableTimeMinutes: newNonBillableMinutes,
        billableHours: newBillableHours
      };
    });
  };

  const calculateEmployeeHoursTotal = () => {
    if (!editedActivity.employeesList) return 0;
    return editedActivity.employeesList.reduce((sum, employee) => sum + (employee.hours || 0), 0);
  };

  const calculateBillableHours = (totalHours: number, nonBillableMinutes: number = 0) => {
    const nonBillableHours = nonBillableMinutes / 60;
    const billableHours = Math.max(0, totalHours - nonBillableHours);
    return Math.round(billableHours * 4) / 4; // Round to quarter hour
  };

  const distributeHoursProportionally = () => {
    if (!editedActivity.employeesList || editedActivity.employeesList.length === 0) return;
    
    const totalHours = editedActivity.totalHours || 0;
    const currentEmployeeTotal = calculateEmployeeHoursTotal();
    
    if (currentEmployeeTotal === 0) {
      // If no current hours, distribute equally
      const hoursPerEmployee = totalHours / editedActivity.employeesList.length;
      setEditedActivity(prev => ({
        ...prev,
        employeesList: prev.employeesList?.map(emp => ({
          ...emp,
          hours: Math.round(hoursPerEmployee * 4) / 4 // Round to nearest quarter hour
        })) || []
      }));
    } else {
      // Distribute proportionally based on current distribution
      setEditedActivity(prev => ({
        ...prev,
        employeesList: prev.employeesList?.map(emp => {
          const proportion = (emp.hours || 0) / currentEmployeeTotal;
          const newHours = totalHours * proportion;
          return {
            ...emp,
            hours: Math.round(newHours * 4) / 4 // Round to nearest quarter hour
          };
        }) || []
      }));
    }
  };

  const calculateTravelTimeSummary = useCallback(() => {
    const approvedActivities = activitiesNeedingReview.filter(activity => 
      approvedActivityIds.has(activity.id)
    );

    const datesWithUnallocatedTravel: string[] = [];
    const datesProcessed = new Set<string>();
    let totalUnallocatedMinutes = 0;
    let activitiesWithTravel = 0;

    approvedActivities.forEach(activity => {
      if (activity.travelTimeMinutes && activity.travelTimeMinutes > 0) {
        activitiesWithTravel++;
        if (!activity.adjustedTravelTimeMinutes && !datesProcessed.has(activity.date)) {
          datesWithUnallocatedTravel.push(activity.date);
          datesProcessed.add(activity.date);
          
          // Calculate total unallocated travel for this date
          const dateActivities = approvedActivities.filter(a => a.date === activity.date);
          const dateUnallocatedMinutes = dateActivities.reduce((sum, a) => {
            return sum + ((a.travelTimeMinutes && !a.adjustedTravelTimeMinutes) ? a.travelTimeMinutes : 0);
          }, 0);
          totalUnallocatedMinutes += dateUnallocatedMinutes;
        }
      }
    });

    setCompletionTravelSummary({
      datesWithUnallocatedTravel,
      totalUnallocatedMinutes,
      activitiesWithTravel
    });
  }, [activitiesNeedingReview, approvedActivityIds]);

  const handleBatchTravelTimeAllocation = async () => {
    if (!completionTravelSummary || completionTravelSummary.datesWithUnallocatedTravel.length === 0) {
      return;
    }

    try {
      setAllocatingTravelTime(true);
      
      // Apply travel time allocation for each date with unallocated travel
      for (const date of completionTravelSummary.datesWithUnallocatedTravel) {
        await apiClient.post('/api/travel-time/apply', { date });
      }
      
      // Refresh activities to show updated allocations
      await fetchActivitiesNeedingReview();
      
      // Recalculate summary
      calculateTravelTimeSummary();
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to apply batch travel time allocation');
    } finally {
      setAllocatingTravelTime(false);
    }
  };

  // Calculate travel time summary when completion state is reached
  useEffect(() => {
    if (remainingCount === 0 && totalActivities > 0) {
      calculateTravelTimeSummary();
    }
  }, [remainingCount, totalActivities, calculateTravelTimeSummary]);

  const handleBulkTravelTimePreview = async (date: string) => {
    try {
      setAllocatingTravelTime(true);
      const response = await apiClient.post('/api/travel-time/calculate', { date });
      const data = await response.json();
      setBulkAllocationResults(prev => ({ ...prev, [date]: data }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to preview travel time allocation');
    } finally {
      setAllocatingTravelTime(false);
    }
  };

  const handleBulkTravelTimeApply = async (dates: string[]) => {
    try {
      setAllocatingTravelTime(true);
      
      for (const date of dates) {
        await apiClient.post('/api/travel-time/apply', { date });
      }
      
      // Refresh activities to show updated allocations
      await fetchActivitiesNeedingReview();
      
      // Clear bulk allocation state and proceed to normal review
      setShowBulkTravelAllocation(false);
      setBulkAllocationResults({});
      setSelectedBulkDates(new Set());
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to apply bulk travel time allocation');
    } finally {
      setAllocatingTravelTime(false);
    }
  };

  const handleSkipBulkAllocation = () => {
    setShowBulkTravelAllocation(false);
  };

  const handleSelectAllBulkDates = () => {
    const allDates = new Set(bulkTravelDates.map(d => d.date));
    setSelectedBulkDates(allDates);
  };

  const handleDeselectAllBulkDates = () => {
    setSelectedBulkDates(new Set());
  };

  const toggleBulkDateSelection = (date: string) => {
    setSelectedBulkDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
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

  // Show bulk travel time allocation step first
  if (showBulkTravelAllocation && bulkTravelDates.length > 0) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper sx={{ p: 4 }}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" gutterBottom>
              Bulk Travel Time Allocation
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Allocate travel time for multiple dates before reviewing individual activities
            </Typography>
          </Box>

          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Found {bulkTravelDates.length} date(s) with unallocated travel time. You can allocate travel time in bulk here, or skip to review activities individually.
            </Typography>
          </Alert>

          <Box sx={{ mb: 3 }}>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <Button 
                variant="outlined" 
                size="small" 
                onClick={handleSelectAllBulkDates}
                disabled={selectedBulkDates.size === bulkTravelDates.length}
              >
                Select All
              </Button>
              <Button 
                variant="outlined" 
                size="small" 
                onClick={handleDeselectAllBulkDates}
                disabled={selectedBulkDates.size === 0}
              >
                Deselect All
              </Button>
            </Stack>

            <Grid container spacing={2}>
              {bulkTravelDates.map((dateInfo) => (
                <Grid item xs={12} md={6} key={dateInfo.date}>
                  <Card 
                    sx={{ 
                      border: selectedBulkDates.has(dateInfo.date) ? '2px solid' : '1px solid',
                      borderColor: selectedBulkDates.has(dateInfo.date) ? 'primary.main' : 'grey.200',
                      cursor: 'pointer',
                      '&:hover': { boxShadow: 2 }
                    }}
                    onClick={() => toggleBulkDateSelection(dateInfo.date)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Typography variant="h6">
                          {formatDateLongPacific(dateInfo.date)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {selectedBulkDates.has(dateInfo.date) && (
                            <CheckCircle color="primary" />
                          )}
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBulkTravelTimePreview(dateInfo.date);
                            }}
                            disabled={allocatingTravelTime}
                          >
                            Preview
                          </Button>
                        </Box>
                      </Box>
                      
                      <Grid container spacing={1} sx={{ mb: 2 }}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Activities
                          </Typography>
                          <Typography variant="body1">
                            {dateInfo.activitiesCount}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Travel Time
                          </Typography>
                          <Typography variant="body1">
                            {formatMinutes(dateInfo.totalTravelMinutes)}
                          </Typography>
                        </Grid>
                      </Grid>

                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Clients: {dateInfo.clientsInvolved.join(', ')}
                      </Typography>

                      {bulkAllocationResults[dateInfo.date] && (
                        <Alert severity="success" sx={{ mt: 2 }}>
                          <Typography variant="body2">
                            Preview: {bulkAllocationResults[dateInfo.date].allocations.length} activities will be updated
                          </Typography>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>

          <Stack direction="row" spacing={2} sx={{ justifyContent: 'center' }}>
            <Button
              variant="contained"
              startIcon={<DirectionsCar />}
              onClick={() => handleBulkTravelTimeApply(Array.from(selectedBulkDates))}
              disabled={selectedBulkDates.size === 0 || allocatingTravelTime}
              size="large"
            >
              {allocatingTravelTime ? <CircularProgress size={20} /> : `Allocate Travel Time (${selectedBulkDates.size} dates)`}
            </Button>
            <Button
              variant="outlined"
              onClick={handleSkipBulkAllocation}
              disabled={allocatingTravelTime}
              size="large"
            >
              Skip & Review Individually
            </Button>
          </Stack>
        </Paper>
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
        <Paper sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h4" gutterBottom>
              Review Session Complete! 🎉
            </Typography>
            <Typography variant="body1" color="text.secondary">
              You've reviewed and approved all {totalActivities} work activities.
            </Typography>
          </Box>

          {/* Travel Time Summary */}
          {completionTravelSummary && completionTravelSummary.activitiesWithTravel > 0 && (
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DirectionsCar color="primary" />
                  Travel Time Allocation Summary
                </Typography>
                
                <Grid container spacing={3} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="text.secondary">
                      Activities with Travel Time
                    </Typography>
                    <Typography variant="h6">
                      {completionTravelSummary.activitiesWithTravel}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="text.secondary">
                      Dates Needing Allocation
                    </Typography>
                    <Typography variant="h6" color={completionTravelSummary.datesWithUnallocatedTravel.length > 0 ? 'warning.main' : 'success.main'}>
                      {completionTravelSummary.datesWithUnallocatedTravel.length}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="text.secondary">
                      Unallocated Travel Time
                    </Typography>
                    <Typography variant="h6" color={completionTravelSummary.totalUnallocatedMinutes > 0 ? 'warning.main' : 'success.main'}>
                      {formatMinutes(completionTravelSummary.totalUnallocatedMinutes)}
                    </Typography>
                  </Grid>
                </Grid>

                {completionTravelSummary.datesWithUnallocatedTravel.length > 0 ? (
                  <Box>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Travel time allocation needed for {completionTravelSummary.datesWithUnallocatedTravel.length} date(s):
                      </Typography>
                      <Typography variant="body2">
                        {completionTravelSummary.datesWithUnallocatedTravel.map(date => formatDateLongPacific(date)).join(', ')}
                      </Typography>
                    </Alert>
                    <Button
                      variant="contained"
                      startIcon={<DirectionsCar />}
                      onClick={handleBatchTravelTimeAllocation}
                      disabled={allocatingTravelTime}
                      color="warning"
                      fullWidth
                    >
                      {allocatingTravelTime ? <CircularProgress size={20} /> : 'Allocate Travel Time for All Dates'}
                    </Button>
                  </Box>
                ) : (
                  <Alert severity="success">
                    <Typography variant="body2">
                      ✅ All travel time has been properly allocated!
                    </Typography>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

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
                  <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
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
                    {currentActivity.notionPageId && (
                      <Chip
                        label="View in Notion"
                        icon={<OpenInNew />}
                        size="small"
                        clickable
                        onClick={() => window.open(`https://www.notion.so/${currentActivity.notionPageId}`, '_blank')}
                        sx={{ 
                          bgcolor: 'grey.100',
                          '&:hover': { bgcolor: 'grey.200' }
                        }}
                      />
                    )}
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
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <DirectionsCar fontSize="small" />
                    Original Travel Time
                  </Typography>
                  <Typography variant="body1">
                    {currentActivity.travelTimeMinutes ? `${currentActivity.travelTimeMinutes} min` : 'None'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <DirectionsCar fontSize="small" />
                    Allocated Travel Time
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1">
                      {currentActivity.adjustedTravelTimeMinutes ? `${currentActivity.adjustedTravelTimeMinutes} min` : 'Not allocated'}
                    </Typography>
                    {(currentActivity.travelTimeMinutes || 0) > 0 && !currentActivity.adjustedTravelTimeMinutes && (
                      <Chip 
                        label="Needs Allocation" 
                        color="warning" 
                        size="small" 
                        icon={<Warning />}
                        sx={{ fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AccessTime fontSize="small" />
                    Non-Billable Time
                  </Typography>
                  <Typography variant="body1">
                    {currentActivity.nonBillableTimeMinutes ? `${currentActivity.nonBillableTimeMinutes} min` : 'None'}
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

                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<DirectionsCar />}
                  onClick={handleTravelTimePreview}
                  disabled={allocatingTravelTime}
                  color="info"
                >
                  {allocatingTravelTime ? <CircularProgress size={20} /> : 'Allocate Travel Time'}
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
                onChange={(e) => {
                  const newTotalHours = parseFloat(e.target.value) || 0;
                  const newBillableHours = calculateBillableHours(newTotalHours, editedActivity.nonBillableTimeMinutes || 0);
                  setEditedActivity(prev => ({ 
                    ...prev, 
                    totalHours: newTotalHours,
                    billableHours: newBillableHours
                  }));
                }}
                inputProps={{ step: 0.25, min: 0 }}
                helperText="Automatically updates billable hours"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Billable Hours"
                type="number"
                fullWidth
                value={editedActivity.billableHours || ''}
                disabled
                inputProps={{ step: 0.25, min: 0 }}
                helperText="Auto-calculated: Total - Non-billable"
                InputProps={{
                  sx: { bgcolor: 'grey.100' }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Travel Time (minutes)"
                type="number"
                fullWidth
                value={editedActivity.travelTimeMinutes || ''}
                onChange={(e) => setEditedActivity(prev => ({ ...prev, travelTimeMinutes: parseInt(e.target.value) || 0 }))}
                inputProps={{ step: 1, min: 0 }}
                InputProps={{
                  startAdornment: <DirectionsCar sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                helperText="Original travel time from work notes"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Allocated Travel Time (minutes)"
                type="number"
                fullWidth
                value={editedActivity.adjustedTravelTimeMinutes || ''}
                onChange={(e) => setEditedActivity(prev => ({ ...prev, adjustedTravelTimeMinutes: parseInt(e.target.value) || 0 }))}
                inputProps={{ step: 1, min: 0 }}
                InputProps={{
                  startAdornment: <DirectionsCar sx={{ mr: 1, color: 'primary.main' }} />
                }}
                helperText="Proportionally allocated travel time"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Non-Billable Time (minutes)"
                type="number"
                fullWidth
                value={editedActivity.nonBillableTimeMinutes || ''}
                onChange={(e) => handleNonBillableTimeChange(parseInt(e.target.value) || 0)}
                inputProps={{ step: 1, min: 0 }}
                InputProps={{
                  startAdornment: <AccessTime sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                helperText="Automatically updates billable hours"
              />
            </Grid>

            
            {/* Employee Hours Section */}
            {editedActivity.employeesList && editedActivity.employeesList.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                  <Person color="primary" />
                  Employee Hours
                </Typography>
                <Paper sx={{ p: 2, border: '1px solid', borderColor: 'grey.200' }}>
                  <Grid container spacing={2}>
                    {editedActivity.employeesList.map((employee, index) => (
                      <Grid item xs={12} sm={6} key={employee.employeeId}>
                        <TextField
                          label={employee.employeeName || `Employee ${employee.employeeId}`}
                          type="number"
                          fullWidth
                          size="small"
                          value={employee.hours || ''}
                          onChange={(e) => handleEmployeeHoursChange(index, parseFloat(e.target.value) || 0)}
                          inputProps={{ step: 0.25, min: 0 }}
                          InputProps={{
                            endAdornment: <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>hours</Typography>
                          }}
                        />
                      </Grid>
                    ))}
                    <Grid item xs={12}>
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Employee Total: <strong>{calculateEmployeeHoursTotal()}h</strong> | Activity Total: <strong>{editedActivity.totalHours || 0}h</strong> | Billable: <strong>{editedActivity.billableHours || 0}h</strong>
                          </Typography>
                          <Typography variant="body2" color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <CheckCircle fontSize="small" />
                            Totals automatically calculated from employee hours
                          </Typography>
                        </Box>
                        {Math.abs((calculateEmployeeHoursTotal() || 0) - (editedActivity.totalHours || 0)) > 0.01 && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={distributeHoursProportionally}
                            sx={{ 
                              minWidth: 'auto',
                              px: 2
                            }}
                          >
                            Reset Distribution
                          </Button>
                        )}
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            )}
            
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

      {/* Travel Time Allocation Dialog */}
      <Dialog 
        open={travelTimeDialogOpen} 
        onClose={() => setTravelTimeDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Travel Time Allocation Preview
          <IconButton
            onClick={() => setTravelTimeDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {travelTimePreview && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Date: {formatDateLongPacific(travelTimePreview.date)}
              </Typography>
              
              {/* Summary */}
              <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Allocation Summary
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">
                      Total Travel Time
                    </Typography>
                    <Typography variant="h6">
                      {formatMinutes(travelTimePreview.totalTravelMinutes)}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">
                      Total Work Hours
                    </Typography>
                    <Typography variant="h6">
                      {travelTimePreview.totalWorkHours}h
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">
                      Activities Updated
                    </Typography>
                    <Typography variant="h6">
                      {travelTimePreview.updatedActivities}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Warnings */}
              {travelTimePreview.warnings.length > 0 && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Warnings:
                  </Typography>
                  {travelTimePreview.warnings.map((warning, index) => (
                    <Typography key={index} variant="body2">
                      • {warning}
                    </Typography>
                  ))}
                </Alert>
              )}

              {/* Allocation Details */}
              <Typography variant="subtitle1" gutterBottom>
                Allocation Details
              </Typography>
              <Stack spacing={2}>
                {travelTimePreview.allocations.map((allocation, index) => (
                  <Paper key={index} sx={{ p: 2, border: '1px solid', borderColor: 'grey.200' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {allocation.clientName}
                      </Typography>
                      {allocation.hasZeroTravel && (
                        <Chip label="Zero Travel" size="small" color="info" />
                      )}
                    </Box>
                    <Grid container spacing={1}>
                      <Grid item xs={3}>
                        <Typography variant="body2" color="text.secondary">
                          Work Hours
                        </Typography>
                        <Typography variant="body2">
                          {allocation.hoursWorked}h
                        </Typography>
                      </Grid>
                      <Grid item xs={3}>
                        <Typography variant="body2" color="text.secondary">
                          Original Travel
                        </Typography>
                        <Typography variant="body2">
                          {formatMinutes(allocation.originalTravelMinutes)}
                        </Typography>
                      </Grid>
                      <Grid item xs={3}>
                        <Typography variant="body2" color="text.secondary">
                          Allocated Travel
                        </Typography>
                        <Typography variant="body2" color="primary.main" sx={{ fontWeight: 'medium' }}>
                          {formatMinutes(allocation.allocatedTravelMinutes)}
                        </Typography>
                      </Grid>
                      <Grid item xs={3}>
                        <Typography variant="body2" color="text.secondary">
                          New Billable Hours
                        </Typography>
                        <Typography variant="body2" color="success.main" sx={{ fontWeight: 'medium' }}>
                          {allocation.newBillableHours}h
                        </Typography>
                      </Grid>
                    </Grid>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTravelTimeDialogOpen(false)} startIcon={<Cancel />}>
            Cancel
          </Button>
          <Button 
            onClick={handleTravelTimeApply} 
            variant="contained" 
            startIcon={<DirectionsCar />}
            disabled={allocatingTravelTime}
            color="primary"
          >
            {allocatingTravelTime ? <CircularProgress size={20} /> : 'Apply Allocation'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default WorkActivityReviewFlow; 