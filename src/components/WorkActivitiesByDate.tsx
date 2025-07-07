import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Stack,
  Checkbox,
  Alert,
  Toolbar,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as VisibilityIcon,
  AttachMoney as AttachMoneyIcon,
  Receipt as ReceiptIcon,
  CalendarToday as CalendarIcon,
  Work as WorkIcon,
  Note as NoteIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { formatDatePacific } from '../utils/dateUtils';

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
  nonBillableTimeMinutes?: number;
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
  chargesList: Array<any>;
  plantsList: Array<any>;
  totalCharges: number;
}

interface WorkActivitiesByDateProps {
  activities: WorkActivity[];
  onEdit?: (activity: WorkActivity) => void;
  onDelete?: (activity: WorkActivity) => void;
  showClientColumn?: boolean;
  emptyMessage?: string;
  allowSelection?: boolean;
  onCreateInvoice?: (selectedActivities: WorkActivity[]) => void;
}

export const WorkActivitiesByDate: React.FC<WorkActivitiesByDateProps> = ({
  activities,
  onEdit,
  onDelete,
  showClientColumn = true,
  emptyMessage = "No work activities found",
  allowSelection = false,
  onCreateInvoice,
}) => {
  const navigate = useNavigate();
  const [selectedActivities, setSelectedActivities] = useState<Set<number>>(new Set());

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'needs_review': return 'warning';
      case 'completed': return 'success';
      case 'in_progress': return 'secondary';
      case 'planned': return 'info';
      case 'invoiced': return 'primary';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups: { [key: string]: WorkActivity[] } = {};
    
    activities.forEach(activity => {
      const date = activity.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
    });

    // Sort dates in descending order (newest first)
    const sortedDates = Object.keys(groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    return sortedDates.map(date => ({
      date,
      activities: groups[date].sort((a, b) => {
        // Sort activities within the same date by start time if available
        if (a.startTime && b.startTime) {
          return a.startTime.localeCompare(b.startTime);
        }
        return 0;
      })
    }));
  }, [activities]);

  const completedActivities = activities.filter(activity => 
    activity.status === 'completed' && activity.billableHours && activity.billableHours > 0
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedActivities(new Set(completedActivities.map(a => a.id)));
    } else {
      setSelectedActivities(new Set());
    }
  };

  const handleSelectActivity = (activityId: number, checked: boolean) => {
    const newSelected = new Set(selectedActivities);
    if (checked) {
      newSelected.add(activityId);
    } else {
      newSelected.delete(activityId);
    }
    setSelectedActivities(newSelected);
  };

  const handleCreateInvoiceClick = () => {
    const selectedActivityObjects = activities.filter(a => selectedActivities.has(a.id));
    if (onCreateInvoice) {
      onCreateInvoice(selectedActivityObjects);
    }
  };

  const selectedCount = selectedActivities.size;
  const allCompletedSelected = completedActivities.length > 0 && 
    completedActivities.every(a => selectedActivities.has(a.id));
  const someCompletedSelected = completedActivities.some(a => selectedActivities.has(a.id));

  if (activities.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="h6" color="text.secondary">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {allowSelection && selectedCount > 0 && (
        <Toolbar sx={{ bgcolor: 'primary.50', mb: 2, borderRadius: 1 }}>
          <Typography variant="h6" component="div" sx={{ flex: '1 1 100%' }}>
            {selectedCount} activities selected
          </Typography>
          <Button
            variant="contained"
            startIcon={<ReceiptIcon />}
            onClick={handleCreateInvoiceClick}
          >
            Create Invoice
          </Button>
        </Toolbar>
      )}

      {allowSelection && completedActivities.length > 0 && selectedCount === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Select completed work activities to create invoices. Only activities with billable hours can be invoiced.
        </Alert>
      )}

      {allowSelection && completedActivities.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Checkbox
            indeterminate={someCompletedSelected && !allCompletedSelected}
            checked={allCompletedSelected}
            onChange={(e) => handleSelectAll(e.target.checked)}
          />
          <Typography variant="body2" color="text.secondary">
            Select all billable activities
          </Typography>
        </Box>
      )}

      <Stack spacing={2}>
        {groupedActivities.map(({ date, activities: dateActivities }) => {
          const totalHours = dateActivities.reduce((sum, act) => sum + (act.billableHours || 0), 0);
          const totalCharges = dateActivities.reduce((sum, act) => sum + act.totalCharges, 0);
          
          return (
            <Accordion key={date} defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  <CalendarIcon sx={{ color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {formatDatePacific(date)}
                  </Typography>
                  <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip
                      icon={<WorkIcon sx={{ fontSize: 14 }} />}
                      label={`${dateActivities.length} ${dateActivities.length === 1 ? 'activity' : 'activities'}`}
                      size="small"
                      variant="outlined"
                      color="primary"
                    />
                    {totalHours > 0 && (
                      <Chip
                        icon={<TimeIcon sx={{ fontSize: 14 }} />}
                        label={`${totalHours.toFixed(1)}h billable`}
                        size="small"
                        variant="outlined"
                        color="success"
                      />
                    )}
                    {totalCharges > 0 && (
                      <Chip
                        icon={<AttachMoneyIcon sx={{ fontSize: 14 }} />}
                        label={formatCurrency(totalCharges)}
                        size="small"
                        variant="outlined"
                        color="secondary"
                      />
                    )}
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {dateActivities.map((activity, index) => {
                    const isCompleted = activity.status === 'completed' && activity.billableHours && activity.billableHours > 0;
                    const isSelected = selectedActivities.has(activity.id);
                    
                    return (
                      <Card key={activity.id} variant="outlined" sx={{ bgcolor: 'grey.50' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                            {allowSelection && (
                              <Checkbox
                                checked={isSelected}
                                onChange={(e) => handleSelectActivity(activity.id, e.target.checked)}
                                disabled={!isCompleted}
                                sx={{ mt: -1 }}
                              />
                            )}
                            
                            <Box sx={{ flexGrow: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Chip 
                                  label={activity.workType.replace('_', ' ').toUpperCase()} 
                                  size="small" 
                                  variant="outlined"
                                  sx={{ fontSize: '0.75rem' }}
                                />
                                <Chip 
                                  label={activity.status.replace('_', ' ').toUpperCase()} 
                                  color={getStatusColor(activity.status) as any} 
                                  size="small"
                                  sx={{ fontSize: '0.75rem' }}
                                />
                                {activity.startTime && activity.endTime && (
                                  <Chip
                                    icon={<TimeIcon sx={{ fontSize: 12 }} />}
                                    label={`${activity.startTime} - ${activity.endTime}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.75rem' }}
                                  />
                                )}
                              </Box>

                              <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                  <Box sx={{ mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                      Hours & Billing
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      Billable: {activity.billableHours ? `${activity.billableHours.toFixed(1)}h` : 'None'}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      Total: {activity.totalHours.toFixed(1)}h
                                    </Typography>
                                    {activity.hourlyRate && (
                                      <Typography variant="body2" color="text.secondary">
                                        Rate: {formatCurrency(activity.hourlyRate)}/hour
                                      </Typography>
                                    )}
                                  </Box>
                                </Grid>

                                <Grid item xs={12} md={6}>
                                  <Box sx={{ mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                      Team
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                      {activity.employeesList.map((emp, empIndex) => (
                                        <Chip 
                                          key={empIndex}
                                          label={`${emp.employeeName || 'Unknown'} (${emp.hours.toFixed(1)}h)`}
                                          size="small"
                                          icon={<PersonIcon sx={{ fontSize: 14 }} />}
                                          variant="outlined"
                                          sx={{ fontSize: '0.75rem' }}
                                        />
                                      ))}
                                    </Box>
                                  </Box>
                                </Grid>

                                {(activity.notes || activity.tasks) && (
                                  <Grid item xs={12}>
                                    <Divider sx={{ mb: 1 }} />
                                    {activity.notes && (
                                      <Box sx={{ mb: 1 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <NoteIcon sx={{ fontSize: 16 }} />
                                          Notes
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                          {activity.notes}
                                        </Typography>
                                      </Box>
                                    )}
                                    {activity.tasks && (
                                      <Box sx={{ mb: 1 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <CheckCircleIcon sx={{ fontSize: 16 }} />
                                          Tasks
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                          {activity.tasks}
                                        </Typography>
                                      </Box>
                                    )}
                                  </Grid>
                                )}

                                {activity.totalCharges > 0 && (
                                  <Grid item xs={12}>
                                    <Divider sx={{ mb: 1 }} />
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <AttachMoneyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                        Total Charges: {formatCurrency(activity.totalCharges)}
                                      </Typography>
                                    </Box>
                                  </Grid>
                                )}
                              </Grid>
                            </Box>

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<VisibilityIcon />}
                                onClick={() => navigate(`/work-activities/${activity.id}`)}
                                sx={{ minWidth: 'auto', fontSize: '0.75rem' }}
                              >
                                View
                              </Button>
                              {onEdit && (
                                <IconButton onClick={() => onEdit(activity)} size="small" color="primary">
                                  <EditIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                              )}
                              {onDelete && (
                                <IconButton onClick={() => onDelete(activity)} size="small" color="error">
                                  <DeleteIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                              )}
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Stack>
    </Box>
  );
};