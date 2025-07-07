import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
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
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Filter activities that have actual tasks and group by date
  const groupedTasks = useMemo(() => {
    const activitiesWithTasks = activities.filter(activity => 
      activity.tasks && activity.tasks.trim()
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

  // Initialize expanded state with all recent dates expanded (last 3 dates)
  React.useEffect(() => {
    if (groupedTasks.length > 0) {
      const recentDates = groupedTasks.slice(0, 3).map(group => group.date);
      setExpandedDates(new Set(recentDates));
    }
  }, [groupedTasks]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'warning';
      case 'planned': return 'info';
      case 'invoiced': return 'primary';
      default: return 'default';
    }
  };

  // Helper function to parse tasks into individual items
  const parseTasksIntoList = (tasks: string): string[] => {
    if (!tasks || !tasks.trim()) return [];
    
    // Split by common delimiters and clean up
    const taskItems = tasks
      .split(/[•·\n\r]+|(?:\d+\.)|(?:-\s)|(?:\*\s)/)
      .map(task => task.trim())
      .filter(task => task.length > 0 && task !== '.' && task !== '-' && task !== '*');
    
    return taskItems;
  };

  const handleDateToggle = (date: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  };

  const expandAll = () => {
    setExpandedDates(new Set(groupedTasks.map(group => group.date)));
  };

  const collapseAll = () => {
    setExpandedDates(new Set());
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
      {/* Expand/Collapse All Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
        <Chip 
          label="Expand All" 
          variant="outlined" 
          size="small" 
          onClick={expandAll}
          sx={{ cursor: 'pointer' }}
        />
        <Chip 
          label="Collapse All" 
          variant="outlined" 
          size="small" 
          onClick={collapseAll}
          sx={{ cursor: 'pointer' }}
        />
      </Box>

      <Stack spacing={1}>
        {groupedTasks.map(({ date, activities: dateActivities }) => (
          <Accordion 
            key={date} 
            expanded={expandedDates.has(date)}
            onChange={() => handleDateToggle(date)}
            sx={{
              '&:before': { display: 'none' },
              boxShadow: 'none',
              border: '1px solid',
              borderColor: 'divider',
              '&.Mui-expanded': {
                margin: 0,
              }
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                bgcolor: 'primary.50',
                borderBottom: expandedDates.has(date) ? '1px solid' : 'none',
                borderColor: 'divider',
                minHeight: 48,
                '&.Mui-expanded': {
                  minHeight: 48,
                },
                '&:hover': {
                  bgcolor: 'primary.100',
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  {formatDatePacific(date)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ({dateActivities.length} {dateActivities.length === 1 ? 'activity' : 'activities'})
                </Typography>
              </Box>
            </AccordionSummary>
            
            <AccordionDetails sx={{ p: 2 }}>
              <Stack spacing={2}>
                {dateActivities.map((activity) => {
                  const taskItems = parseTasksIntoList(activity.tasks || '');
                  
                  return (
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

                            {taskItems.length > 0 && (
                              <Box sx={{ mb: 1 }}>
                                <Typography variant="body2" sx={{ 
                                  fontWeight: 600, 
                                  color: 'success.main',
                                  mb: 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1
                                }}>
                                  <CheckCircleIcon sx={{ fontSize: 16 }} />
                                  Tasks Completed:
                                </Typography>
                                <List dense sx={{ pl: 2 }}>
                                  {taskItems.map((task, index) => (
                                    <ListItem key={index} sx={{ py: 0.25, px: 0 }}>
                                      <ListItemIcon sx={{ minWidth: 24 }}>
                                        <CheckCircleIcon sx={{ fontSize: 12, color: 'success.main' }} />
                                      </ListItemIcon>
                                      <ListItemText 
                                        primary={task} 
                                        primaryTypographyProps={{
                                          variant: 'body2',
                                          sx: { lineHeight: 1.4 }
                                        }}
                                      />
                                    </ListItem>
                                  ))}
                                </List>
                              </Box>
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
        ))}
      </Stack>
    </Box>
  );
};