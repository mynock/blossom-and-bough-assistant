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
  Link,
  Checkbox,
  Toolbar,
  Alert,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
  Update as UpdateIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as VisibilityIcon,
  Business as BusinessIcon,
  AttachMoney as AttachMoneyIcon,
  Timeline as TimelineIcon,
  Receipt as ReceiptIcon,
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

interface WorkActivitiesTableProps {
  activities: WorkActivity[];
  onEdit?: (activity: WorkActivity) => void;
  onDelete?: (activity: WorkActivity) => void;
  showClientColumn?: boolean;
  emptyMessage?: string;
  allowSelection?: boolean;
  onCreateInvoice?: (selectedActivities: WorkActivity[]) => void;
}

type SortColumn = 'date' | 'workType' | 'status' | 'billableHours' | 'totalCharges';
type SortDirection = 'asc' | 'desc';

export const WorkActivitiesTable: React.FC<WorkActivitiesTableProps> = ({
  activities,
  onEdit,
  onDelete,
  showClientColumn = true,
  emptyMessage = "No work activities found",
  allowSelection = false,
  onCreateInvoice,
}) => {
  const navigate = useNavigate();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedActivities, setSelectedActivities] = useState<Set<number>>(new Set());

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
        case 'billableHours':
          aValue = a.billableHours || 0;
          bValue = b.billableHours || 0;
          break;
        case 'totalCharges':
          aValue = a.totalCharges;
          bValue = b.totalCharges;
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

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              {allowSelection && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={someCompletedSelected && !allCompletedSelected}
                    checked={allCompletedSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    disabled={completedActivities.length === 0}
                  />
                </TableCell>
              )}
              <TableCell sx={{ width: '12%' }}>
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
              <TableCell sx={{ width: '8%' }}>
                <TableSortLabel
                  active={sortColumn === 'status'}
                  direction={sortColumn === 'status' ? sortDirection : 'asc'}
                  onClick={() => handleSort('status')}
                >
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ width: '15%' }}>Client</TableCell>
              <TableCell sx={{ width: '10%' }}>
                <TableSortLabel
                  active={sortColumn === 'billableHours'}
                  direction={sortColumn === 'billableHours' ? sortDirection : 'asc'}
                  onClick={() => handleSort('billableHours')}
                >
                  Billable Hours
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ width: '20%' }}>Employees</TableCell>
              <TableCell sx={{ width: '15%', textAlign: 'center' }}>Actions</TableCell>
              <TableCell sx={{ width: '8%', textAlign: 'center' }}>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedActivities.map((activity) => {
              const isExpanded = expandedRows.has(activity.id);
              const isCompleted = activity.status === 'completed' && activity.billableHours && activity.billableHours > 0;
              const isSelected = selectedActivities.has(activity.id);
              
              return (
                <React.Fragment key={activity.id}>
                  <TableRow hover>
                    {allowSelection && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isSelected}
                          onChange={(e) => handleSelectActivity(activity.id, e.target.checked)}
                          disabled={!isCompleted}
                        />
                      </TableCell>
                    )}
                    <TableCell>{formatDateShortPacific(activity.date)}</TableCell>
                    <TableCell>
                      <Chip 
                        label={activity.workType.replace('_', ' ').toUpperCase()} 
                        size="small" 
                        variant="outlined"
                        sx={{ fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={activity.status.replace('_', ' ').toUpperCase()} 
                        color={getStatusColor(activity.status) as any} 
                        size="small"
                        sx={{ fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      {activity.clientName && activity.clientId ? (
                        <Link
                          component="button"
                          onClick={() => navigate(`/clients/${activity.clientId}`)}
                          sx={{
                            textDecoration: 'none',
                            color: 'primary.main',
                            fontWeight: 500,
                            fontSize: '0.875rem',
                            '&:hover': {
                              textDecoration: 'underline',
                            },
                          }}
                        >
                          {activity.clientName}
                        </Link>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No Client
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {activity.billableHours ? `${activity.billableHours.toFixed(1)}h` : '-'}
                        </Typography>
                        {activity.totalHours && activity.totalHours !== activity.billableHours && (
                          <Typography variant="caption" color="text.secondary">
                            ({activity.totalHours.toFixed(1)}h total)
                          </Typography>
                        )}
                      </Box>
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
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', alignItems: 'center' }}>
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
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <IconButton 
                        onClick={() => toggleRowExpansion(activity.id)}
                        size="small"
                        sx={{ color: 'text.secondary' }}
                      >
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ p: 0, borderBottom: 'none' }}>
                        <Box sx={{ p: 3, backgroundColor: 'grey.50', borderRadius: 1, m: 1 }}>
                          <Grid container spacing={3}>
                            {/* Client & Project Info */}
                            <Grid item xs={12} md={6}>
                              <Box sx={{ mb: 2 }}>
                                <Typography variant="subtitle2" sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <BusinessIcon sx={{ fontSize: 16 }} />
                                  Client & Project
                                </Typography>
                                <Box sx={{ pl: 2 }}>
                                  <Typography variant="body2" color="text.secondary">
                                    Client: {activity.clientName || 'No Client'}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    Project: {activity.projectName || 'No Project'}
                                  </Typography>
                                </Box>
                              </Box>
                            </Grid>

                            {/* Time & Travel Info */}
                            <Grid item xs={12} md={6}>
                              <Box sx={{ mb: 2 }}>
                                <Typography variant="subtitle2" sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <TimelineIcon sx={{ fontSize: 16 }} />
                                  Time Details
                                </Typography>
                                <Box sx={{ pl: 2 }}>
                                  <Typography variant="body2" color="text.secondary">
                                    Time: {activity.startTime && activity.endTime 
                                      ? `${activity.startTime} - ${activity.endTime}`
                                      : 'Not specified'
                                    }
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    Travel: {activity.adjustedTravelTimeMinutes !== null && activity.adjustedTravelTimeMinutes !== undefined
                                      ? `${Math.floor(activity.adjustedTravelTimeMinutes / 60)}h ${activity.adjustedTravelTimeMinutes % 60}m`
                                      : activity.travelTimeMinutes 
                                        ? `${Math.floor(activity.travelTimeMinutes / 60)}h ${activity.travelTimeMinutes % 60}m`
                                        : 'None'
                                  }
                                  </Typography>
                                </Box>
                              </Box>
                            </Grid>

                            {/* Charges */}
                            <Grid item xs={12} md={6}>
                              <Box sx={{ mb: 2 }}>
                                <Typography variant="subtitle2" sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <AttachMoneyIcon sx={{ fontSize: 16 }} />
                                  Charges
                                </Typography>
                                <Box sx={{ pl: 2 }}>
                                  <Typography variant="body2" color="text.secondary">
                                    Total: {formatCurrency(activity.totalCharges)}
                                  </Typography>
                                </Box>
                              </Box>
                            </Grid>

                            {/* Last Updated */}
                            <Grid item xs={12} md={6}>
                              <Box sx={{ mb: 2 }}>
                                <Typography variant="subtitle2" sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <UpdateIcon sx={{ fontSize: 16 }} />
                                  Last Updated
                                </Typography>
                                <Box sx={{ pl: 2 }}>
                                  <Typography variant="body2" color="text.secondary">
                                    {activity.updatedAt 
                                      ? formatTimestampPacific(activity.updatedAt)
                                      : 'Unknown'
                                    }
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    by {activity.lastUpdatedBy === 'notion_sync' ? 'Notion Sync' : 'Web App'}
                                  </Typography>
                                </Box>
                              </Box>
                            </Grid>

                            {/* Notes */}
                            {activity.notes && (
                              <Grid item xs={12} md={activity.tasks ? 6 : 12}>
                                <Box>
                                  <Typography variant="subtitle2" sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    📝 Notes
                                  </Typography>
                                  <Box sx={{ pl: 2 }}>
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
                                </Box>
                              </Grid>
                            )}

                            {/* Tasks */}
                            {activity.tasks && (
                              <Grid item xs={12} md={activity.notes ? 6 : 12}>
                                <Box>
                                  <Typography variant="subtitle2" sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    ✓ Tasks
                                  </Typography>
                                  <Box sx={{ pl: 2 }}>
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
                                </Box>
                              </Grid>
                            )}
                          </Grid>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}; 