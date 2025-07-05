import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Grid,
  Paper,
  TableSortLabel,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
  Update as UpdateIcon,
} from '@mui/icons-material';
import { formatDateShortPacific, formatTimestampPacific } from '../utils/dateUtils';

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

interface WorkActivitiesTableProps {
  activities: WorkActivity[];
  onEdit?: (activity: WorkActivity) => void;
  onDelete?: (activity: WorkActivity) => void;
  showClientColumn?: boolean;
  emptyMessage?: string;
}

type SortColumn = 'date' | 'workType' | 'status' | 'clientName' | 'totalHours' | 'adjustedTravelTimeMinutes' | 'totalCharges' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

export const WorkActivitiesTable: React.FC<WorkActivitiesTableProps> = ({
  activities,
  onEdit,
  onDelete,
  showClientColumn = true,
  emptyMessage = "No work activities found"
}) => {
  const navigate = useNavigate();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');



  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'warning';
      case 'planned': return 'info';
      case 'invoiced': return 'primary';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const toggleRowExpansion = (activityId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId);
    } else {
      newExpanded.add(activityId);
    }
    setExpandedRows(newExpanded);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedActivities = useMemo(() => {
    const sorted = [...activities].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'date':
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case 'workType':
          aValue = a.workType;
          bValue = b.workType;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'clientName':
          aValue = a.clientName || '';
          bValue = b.clientName || '';
          break;
        case 'totalHours':
          aValue = a.totalHours;
          bValue = b.totalHours;
          break;
        case 'totalCharges':
          aValue = a.totalCharges;
          bValue = b.totalCharges;
          break;
        case 'updatedAt':
          aValue = new Date(a.updatedAt || 0);
          bValue = new Date(b.updatedAt || 0);
          break;
        default:
          aValue = '';
          bValue = '';
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [activities, sortColumn, sortDirection]);

  if (activities.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          {emptyMessage}
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
      <Table sx={{ minWidth: 800 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: '10%' }}>
              <TableSortLabel
                active={sortColumn === 'date'}
                direction={sortColumn === 'date' ? sortDirection : 'asc'}
                onClick={() => handleSort('date')}
              >
                Date
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ width: '10%' }}>
              <TableSortLabel
                active={sortColumn === 'workType'}
                direction={sortColumn === 'workType' ? sortDirection : 'asc'}
                onClick={() => handleSort('workType')}
              >
                Type
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ width: '10%' }}>
              <TableSortLabel
                active={sortColumn === 'status'}
                direction={sortColumn === 'status' ? sortDirection : 'asc'}
                onClick={() => handleSort('status')}
              >
                Status
              </TableSortLabel>
            </TableCell>
            {showClientColumn && (
              <TableCell sx={{ width: '12%' }}>
                <TableSortLabel
                  active={sortColumn === 'clientName'}
                  direction={sortColumn === 'clientName' ? sortDirection : 'asc'}
                  onClick={() => handleSort('clientName')}
                >
                  Client
                </TableSortLabel>
              </TableCell>
            )}
            <TableCell sx={{ width: '12%' }}>Time</TableCell>
            <TableCell sx={{ width: '8%' }}>
              <TableSortLabel
                active={sortColumn === 'totalHours'}
                direction={sortColumn === 'totalHours' ? sortDirection : 'asc'}
                onClick={() => handleSort('totalHours')}
              >
                Hours
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ width: '8%' }}>
              <TableSortLabel
                active={sortColumn === 'adjustedTravelTimeMinutes'}
                direction={sortColumn === 'adjustedTravelTimeMinutes' ? sortDirection : 'asc'}
                onClick={() => handleSort('adjustedTravelTimeMinutes')}
              >
                Adj Travel
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ width: '20%' }}>Employees</TableCell>
            <TableCell sx={{ width: '10%' }}>
              <TableSortLabel
                active={sortColumn === 'totalCharges'}
                direction={sortColumn === 'totalCharges' ? sortDirection : 'asc'}
                onClick={() => handleSort('totalCharges')}
              >
                Charges
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ width: '15%' }}>
              <TableSortLabel
                active={sortColumn === 'updatedAt'}
                direction={sortColumn === 'updatedAt' ? sortDirection : 'asc'}
                onClick={() => handleSort('updatedAt')}
              >
                Last Updated
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ width: '10%' }}>Notes/Tasks</TableCell>
            {(onEdit || onDelete) && (
              <TableCell sx={{ width: '10%', textAlign: 'center' }}>Actions</TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedActivities.map((activity) => (
            <React.Fragment key={activity.id}>
              <TableRow sx={{ '&:nth-of-type(odd)': { backgroundColor: 'action.hover' } }}>
                <TableCell>{formatDateShortPacific(activity.date)}</TableCell>
                <TableCell>
                  <Chip 
                    label={activity.workType.replace('_', ' ').toUpperCase()} 
                    size="small" 
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={activity.status.replace('_', ' ').toUpperCase()} 
                    color={getStatusColor(activity.status) as any} 
                    size="small" 
                  />
                </TableCell>
                {showClientColumn && (
                  <TableCell>
                    {activity.clientName && activity.clientId ? (
                      <Button 
                        variant="text" 
                        onClick={() => navigate(`/clients/${activity.clientId}`)}
                        sx={{ 
                          textAlign: 'left', 
                          justifyContent: 'flex-start', 
                          textTransform: 'none',
                          fontWeight: 600,
                          minHeight: 'auto',
                          p: 0,
                          fontSize: '0.875rem'
                        }}
                      >
                        {activity.clientName}
                      </Button>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No Client
                      </Typography>
                    )}
                    {activity.projectName && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {activity.projectName}
                      </Typography>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  {activity.startTime && activity.endTime 
                    ? `${activity.startTime} - ${activity.endTime}`
                    : '-'
                  }
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {activity.totalHours.toFixed(1)}h
                    </Typography>
                    {activity.billableHours && activity.billableHours !== activity.totalHours && (
                      <Typography variant="caption" color="text.secondary">
                        ({activity.billableHours.toFixed(1)}h bill)
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  {activity.adjustedTravelTimeMinutes !== null && activity.adjustedTravelTimeMinutes !== undefined ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        {Math.floor(activity.adjustedTravelTimeMinutes / 60) > 0 
                          ? `${Math.floor(activity.adjustedTravelTimeMinutes / 60)}h ${activity.adjustedTravelTimeMinutes % 60}m`
                          : `${activity.adjustedTravelTimeMinutes}m`
                        }
                      </Typography>
                      {activity.travelTimeMinutes && activity.travelTimeMinutes !== activity.adjustedTravelTimeMinutes && (
                        <Typography variant="caption" color="text.secondary">
                          (was {Math.floor(activity.travelTimeMinutes / 60) > 0 
                            ? `${Math.floor(activity.travelTimeMinutes / 60)}h ${activity.travelTimeMinutes % 60}m`
                            : `${activity.travelTimeMinutes}m`
                          })
                        </Typography>
                      )}
                    </Box>
                  ) : activity.travelTimeMinutes ? (
                    <Typography variant="body2" color="text.secondary">
                      {Math.floor(activity.travelTimeMinutes / 60) > 0 
                        ? `${Math.floor(activity.travelTimeMinutes / 60)}h ${activity.travelTimeMinutes % 60}m`
                        : `${activity.travelTimeMinutes}m`
                      }
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">-</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {activity.employeesList.map((emp, index) => (
                      <Chip 
                        key={index}
                        label={`${emp.employeeName || 'Unknown'} (${emp.hours.toFixed(1)}h)`}
                        size="small"
                        icon={<PersonIcon sx={{ fontSize: 14 }} />}
                        variant="outlined"
                        sx={{ fontSize: '0.75rem', height: '24px' }}
                      />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>{formatCurrency(activity.totalCharges)}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                    <UpdateIcon sx={{ fontSize: 14, color: 'text.secondary', mt: 0.1 }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                        {formatTimestampPacific(activity.updatedAt)}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                          by {activity.lastUpdatedBy === 'web_app' ? 'User' : 'Notion Sync'}
                        </Typography>
                        {activity.lastUpdatedBy === 'web_app' && (
                          <Chip 
                            label="🛡️" 
                            size="small" 
                            variant="outlined"
                            sx={{ 
                              fontSize: '0.6rem', 
                              height: '16px',
                              minWidth: '16px',
                              '& .MuiChip-label': { px: 0.5 },
                              color: 'warning.main',
                              borderColor: 'warning.main'
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  {(activity.notes || activity.tasks) ? (
                    <Button 
                      variant="text" 
                      size="small" 
                      onClick={() => toggleRowExpansion(activity.id)}
                      sx={{ minWidth: 'auto', p: 0.5, fontSize: '0.75rem' }}
                    >
                      {expandedRows.has(activity.id) ? 'Hide' : 'View'}
                    </Button>
                  ) : (
                    <Typography variant="body2" color="text.secondary">-</Typography>
                  )}
                </TableCell>
                {(onEdit || onDelete) && (
                  <TableCell sx={{ textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
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
                  </TableCell>
                )}
              </TableRow>
              {expandedRows.has(activity.id) && (activity.notes || activity.tasks) && (
                <TableRow>
                  <TableCell colSpan={showClientColumn ? (onEdit || onDelete ? 11 : 10) : (onEdit || onDelete ? 10 : 9)} sx={{ p: 0, borderBottom: 'none' }}>
                    <Box sx={{ p: 3, backgroundColor: 'grey.50', borderRadius: 1, m: 1 }}>
                      <Grid container spacing={3}>
                        {activity.notes && (
                          <Grid item xs={12} md={activity.tasks ? 6 : 12}>
                            <Box>
                              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1, fontSize: '1rem' }}>
                                📝 Notes
                              </Typography>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  whiteSpace: 'pre-wrap', 
                                  lineHeight: 1.6,
                                  fontSize: '0.875rem'
                                }}
                                dangerouslySetInnerHTML={{ __html: activity.notes }}
                              />
                            </Box>
                          </Grid>
                        )}
                        {activity.tasks && (
                          <Grid item xs={12} md={activity.notes ? 6 : 12}>
                            <Box>
                              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1, fontSize: '1rem' }}>
                                ✓ Tasks
                              </Typography>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  whiteSpace: 'pre-wrap', 
                                  lineHeight: 1.6,
                                  fontSize: '0.875rem'
                                }}
                                dangerouslySetInnerHTML={{ __html: activity.tasks }}
                              />
                            </Box>
                          </Grid>
                        )}
                      </Grid>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}; 