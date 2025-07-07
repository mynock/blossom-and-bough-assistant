import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  CheckCircle as CheckCircleIcon,
  Note as NoteIcon,
} from '@mui/icons-material';
import { formatDatePacific } from '../utils/dateUtils';

interface WorkActivity {
  id: number;
  workType: string;
  date: string;
  status: string;
  notes: string | null;
  tasks: string | null;
  billableHours: number | null;
  totalHours: number;
  employeesList: Array<{ employeeId: number; employeeName: string | null; hours: number }>;
}

interface ClientTasksListProps {
  activities: WorkActivity[];
  emptyMessage?: string;
}

export const ClientTasksList: React.FC<ClientTasksListProps> = ({
  activities,
  emptyMessage = "No tasks found for this client.",
}) => {
  // Filter activities that have actual tasks/notes and group by date
  const groupedTasks = useMemo(() => {
    const activitiesWithTasks = activities.filter(activity => 
      (activity.notes && activity.notes.trim()) || (activity.tasks && activity.tasks.trim())
    );

    const groups: { [key: string]: WorkActivity[] } = {};
    
    activitiesWithTasks.forEach(activity => {
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
      activities: groups[date]
    }));
  }, [activities]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'warning';
      case 'planned': return 'info';
      case 'invoiced': return 'primary';
      default: return 'default';
    }
  };

  if (groupedTasks.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="h6" color="text.secondary">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxHeight: '600px', overflowY: 'auto' }}>
      <Stack spacing={3}>
        {groupedTasks.map(({ date, activities: dateActivities }) => (
          <Box key={date}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, position: 'sticky', top: 0, bgcolor: 'background.default', zIndex: 1, py: 1 }}>
              <CalendarIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                {formatDatePacific(date)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ({dateActivities.length} {dateActivities.length === 1 ? 'activity' : 'activities'})
              </Typography>
            </Box>

            <Stack spacing={2}>
              {dateActivities.map((activity) => (
                <Card key={activity.id} variant="outlined" sx={{ 
                  bgcolor: 'grey.50',
                  border: '1px solid',
                  borderColor: 'grey.200',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' }
                }}>
                  <CardContent sx={{ pb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 1 }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Chip 
                            label={activity.workType.replace('_', ' ').toUpperCase()} 
                            size="small" 
                            variant="outlined"
                            color="primary"
                            sx={{ fontSize: '0.75rem' }}
                          />
                          <Chip 
                            label={activity.status.replace('_', ' ').toUpperCase()} 
                            color={getStatusColor(activity.status) as any} 
                            size="small"
                            sx={{ fontSize: '0.75rem' }}
                          />
                          {activity.billableHours && (
                            <Chip 
                              label={`${activity.billableHours.toFixed(1)}h`} 
                              size="small" 
                              variant="outlined"
                              sx={{ fontSize: '0.75rem' }}
                            />
                          )}
                        </Box>

                        {activity.employeesList.length > 0 && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Team: {activity.employeesList.map(emp => emp.employeeName || 'Unknown').join(', ')}
                          </Typography>
                        )}

                        {activity.notes && (
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="body2" sx={{ 
                              color: 'text.primary', 
                              lineHeight: 1.6,
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 1
                            }}>
                              <NoteIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.2, flexShrink: 0 }} />
                              {activity.notes}
                            </Typography>
                          </Box>
                        )}

                        {activity.tasks && (
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="body2" sx={{ 
                              color: 'text.primary', 
                              lineHeight: 1.6,
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 1
                            }}>
                              <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main', mt: 0.2, flexShrink: 0 }} />
                              {activity.tasks}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};