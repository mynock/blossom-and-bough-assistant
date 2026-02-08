import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  FormControlLabel,
  Checkbox,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Switch,
  Tooltip,
} from '@mui/material';
import {
  Refresh,
  Storage,
  CloudUpload,
  CloudDownload,
  DeleteForever,
  Warning,
  CheckCircle,
  Error,
  Settings,
  History,
  PlayArrow,
  ExpandMore,
  ExpandLess,
  Timeline,
  Cancel,
  Schedule,
} from '@mui/icons-material';

// Use proxy in development, direct URL in production
const API_BASE = process.env.NODE_ENV === 'production' 
  ? (process.env.REACT_APP_API_URL || '/api')
  : '/api'; // Use proxy in development

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface DatabaseStatus {
  employeesCount: number;
  clientsCount: number;
  projectsCount: number;
  workActivitiesCount: number;
  employeeAssignmentsCount: number;
  chargesCount: number;
}

interface ScriptResult {
  success: boolean;
  message: string;
  duration: number;
  error?: string;
  details?: string;
}

interface WorkActivityImportOptions {
  client: string;
  dryRun?: boolean;
  interactive?: boolean;
  batchSize?: number;
  maxBatches?: number;
  startBatch?: number;
  startDate?: string;
  endDate?: string;
  force?: boolean;
}

interface ImportProgress {
  phase: 'loading' | 'parsing' | 'filtering' | 'saving' | 'complete' | 'error';
  message: string;
  progress?: number;
  total?: number;
  details?: any;
}

interface CronJobInfo {
  id: string;
  name: string;
  schedule: string;
  description: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  status: 'scheduled' | 'running' | 'error' | 'disabled';
}

interface ImportResult {
  success: boolean;
  message: string;
  duration: number;
  error?: string;
  details?: {
    totalFound: number;
    totalSaved: number;
    duplicatesSkipped: number;
    errors: string[];
  };
}

const Admin: React.FC = () => {
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [showConfirmation, setShowConfirmation] = useState<string | null>(null);
  
  // Maintenance Entries State
  const [maintenanceEntryDate, setMaintenanceEntryDate] = useState<string>('');
  
  // Cron Jobs State
  const [cronJobs, setCronJobs] = useState<CronJobInfo[]>([]);
  const [cronLoading, setCronLoading] = useState(false);
  
  // Work Activities Import State
  const [availableClients, setAvailableClients] = useState<string[]>([]);
  const [importOptions, setImportOptions] = useState<WorkActivityImportOptions>({
    client: '',
    dryRun: true,
    batchSize: 8,
    force: false
  });
  const [isImporting, setIsImporting] = useState(false);
  const [, setImportSessionId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress[]>([]);
  const [, setImportResult] = useState<ImportResult | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showProgressDetails, setShowProgressDetails] = useState(false);

  // Production Pull State
  const [pullStartDate, setPullStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [pullEndDate, setPullEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [pullDryRun, setPullDryRun] = useState(true);
  const [pullForce, setPullForce] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<ImportProgress[]>([]);
  const [pullResult, setPullResult] = useState<any>(null);
  const [showPullDetails, setShowPullDetails] = useState(false);

  useEffect(() => {
    loadStatus();
    loadCronStatus();
  }, []);

  const loadStatus = async () => {
    try {
      console.log('Loading admin status from:', `${API_BASE}/admin/status`);
      const response = await api.get('/admin/status');
      console.log('Status response:', response.data);
      setStatus(response.data.data);
    } catch (error: any) {
      console.error('Error loading status:', error);
      setResult({
        success: false,
        message: 'Failed to load database status',
        duration: 0,
        error: error?.message || String(error)
      });
    }
  };

  const loadCronStatus = async () => {
    try {
      setCronLoading(true);
      const response = await api.get('/cron/status');
      setCronJobs(response.data.jobs || []);
    } catch (error: any) {
      console.error('Error loading cron status:', error);
      setResult({
        success: false,
        message: 'Failed to load cron job status',
        duration: 0,
        error: error?.message || String(error)
      });
    } finally {
      setCronLoading(false);
    }
  };

  const toggleCronJob = async (jobId: string, enabled: boolean) => {
    try {
      setCronLoading(true);
      await api.post(`/cron/toggle/${jobId}`, { enabled });
      
      // Update local state
      setCronJobs(prev => prev.map(job => 
        job.id === jobId 
          ? { ...job, enabled, status: enabled ? 'scheduled' : 'disabled' }
          : job
      ));
      
      setResult({
        success: true,
        message: `Cron job ${enabled ? 'enabled' : 'disabled'} successfully`,
        duration: 0
      });
    } catch (error: any) {
      console.error('Error toggling cron job:', error);
      setResult({
        success: false,
        message: `Failed to ${enabled ? 'enable' : 'disable'} cron job`,
        duration: 0,
        error: error?.message || String(error)
      });
    } finally {
      setCronLoading(false);
    }
  };

  const executeScript = async (endpoint: string, actionName: string, additionalData?: any) => {
    setLoading(true);
    setResult(null);
    
    try {
      // Handle special cron endpoints differently
      const apiPath = endpoint.startsWith('cron/') ? `/${endpoint}` : `/admin/${endpoint}`;
      
      // Prepare request body for cron endpoints with date
      let requestBody = {};
      if (endpoint.startsWith('cron/') && additionalData) {
        requestBody = additionalData;
      }
      
      const response = await api.post(apiPath, requestBody);
      
      setResult({
        success: response.data.success,
        message: response.data.message,
        duration: response.data.duration,
        details: response.data.triggeredBy ? `Triggered by: ${response.data.triggeredBy}` : undefined
      });
      
      if (response.data.success) {
        await loadStatus();
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: `Failed to ${actionName}`,
        duration: 0,
        error: error.response?.data?.error || error.message,
        details: error.response?.data?.details
      });
    } finally {
      setLoading(false);
      setShowConfirmation(null);
    }
  };

  const handleActionClick = (endpoint: string, actionName: string, requiresConfirmation = true) => {
    if (requiresConfirmation) {
      setShowConfirmation(`${endpoint}|${actionName}`);
    } else {
      executeScript(endpoint, actionName);
    }
  };

  const handleMaintenanceEntriesClick = () => {
    const additionalData = maintenanceEntryDate ? { date: maintenanceEntryDate } : {};
    const actionName = maintenanceEntryDate ? 
      `create maintenance entries for ${maintenanceEntryDate}` : 
      'create maintenance entries for tomorrow';
    
    executeScript('cron/maintenance-entries', actionName, additionalData);
  };

  const confirmAction = () => {
    if (showConfirmation) {
      const [endpoint, actionName] = showConfirmation.split('|');
      executeScript(endpoint, actionName);
    }
  };

  const cancelAction = () => {
    setShowConfirmation(null);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getDangerLevel = (action: string) => {
    if (action.includes('clear-all-data')) return 'extreme';
    if (action.includes('clear-projects') || action.includes('clear-work-activities')) return 'high';
    if (action.includes('cron/')) return 'safe'; // Cron jobs are safe operations
    return 'safe';
  };

  // Work Activities Import Functions
  const loadAvailableClients = async () => {
    try {
      const response = await api.get('/admin/import-work-activities/clients');
      setAvailableClients(response.data.clients || []);
    } catch (error: any) {
      console.error('Error loading available clients:', error);
      setResult({
        success: false,
        message: 'Failed to load available clients',
        duration: 0,
        error: error?.message || String(error)
      });
    }
  };

  const startWorkActivityImport = async () => {
    if (!importOptions.client) {
      setResult({
        success: false,
        message: 'Please select a client',
        duration: 0
      });
      return;
    }

    setIsImporting(true);
    setImportProgress([]);
    setImportResult(null);
    setResult(null);

    try {
      const response = await api.post('/admin/import-work-activities', importOptions);
      
      if (response.data.success) {
        setImportSessionId(response.data.sessionId);
        // Close the modal when import starts
        setShowImportDialog(false);
        // Start polling for progress
        pollImportProgress(response.data.sessionId);
      } else {
        setResult({
          success: false,
          message: 'Failed to start import',
          duration: 0,
          error: response.data.error
        });
        setIsImporting(false);
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: 'Failed to start import',
        duration: 0,
        error: error?.message || String(error)
      });
      setIsImporting(false);
    }
  };

  const pollImportProgress = async (sessionId: string) => {
    try {
      const response = await api.get(`/admin/import-work-activities/progress/${sessionId}`);
      
      if (response.data.success) {
        setImportProgress(response.data.progress);
        
        if (response.data.isComplete) {
          setImportResult(response.data.result);
          setIsImporting(false);
          setImportSessionId(null);
          
          // Also update the main result display
          setResult({
            success: response.data.result.success,
            message: response.data.result.message,
            duration: response.data.result.duration,
            error: response.data.result.error,
            details: response.data.result.details ? JSON.stringify(response.data.result.details, null, 2) : undefined
          });
          
          // Refresh database status
          await loadStatus();
        } else {
          // Continue polling
          setTimeout(() => pollImportProgress(sessionId), 1000);
        }
      }
    } catch (error: any) {
      console.error('Error polling import progress:', error);
      setIsImporting(false);
      setImportSessionId(null);
    }
  };

  const cancelImport = () => {
    setIsImporting(false);
    setImportSessionId(null);
    setImportProgress([]);
    setImportResult(null);
    // Reset import options for next time
    setImportOptions({
      client: '',
      dryRun: true,
      batchSize: 8,
      force: false
    });
  };

  // Production Pull Functions
  const startProductionPull = async () => {
    setIsPulling(true);
    setPullProgress([]);
    setPullResult(null);

    try {
      const response = await api.post('/admin/pull-from-production', {
        startDate: pullStartDate,
        endDate: pullEndDate,
        dryRun: pullDryRun,
        force: pullForce,
      });

      if (response.data.sessionId) {
        pollPullProgress(response.data.sessionId);
      }
    } catch (error: any) {
      console.error('Error starting production pull:', error);
      setPullResult({
        success: false,
        message: 'Failed to start pull',
        error: error?.response?.data?.error || error?.message || String(error),
      });
      setIsPulling(false);
    }
  };

  const pollPullProgress = async (sessionId: string) => {
    try {
      const response = await api.get(`/admin/pull-from-production/progress/${sessionId}`);

      if (response.data.progress) {
        setPullProgress(response.data.progress);
      }

      if (response.data.isComplete) {
        setPullResult(response.data.result);
        setIsPulling(false);
        await loadStatus();
      } else {
        setTimeout(() => pollPullProgress(sessionId), 1000);
      }
    } catch (error: any) {
      console.error('Error polling pull progress:', error);
      setIsPulling(false);
    }
  };

  const getPullProgressPercentage = () => {
    const lastProgress = pullProgress[pullProgress.length - 1];
    if (!lastProgress || !lastProgress.total) return 0;
    return Math.round((lastProgress.progress || 0) / lastProgress.total * 100);
  };

  const openImportDialog = async () => {
    await loadAvailableClients();
    setShowImportDialog(true);
  };

  const closeImportDialog = () => {
    if (!isImporting) {
      setShowImportDialog(false);
      // Only reset options if not importing
      setImportOptions({
        client: '',
        dryRun: true,
        batchSize: 8,
        force: false
      });
    }
  };

  const getProgressPercentage = () => {
    const lastProgress = importProgress[importProgress.length - 1];
    if (!lastProgress || !lastProgress.total) return 0;
    return Math.round((lastProgress.progress || 0) / lastProgress.total * 100);
  };

  const formatImportOptionValue = (key: string, value: any) => {
    switch (key) {
      case 'dryRun':
        return value ? 'Yes (Safe Preview)' : 'No (Will Save Data)';
      case 'force':
        return value ? 'Yes (Overwrite Duplicates)' : 'No (Skip Duplicates)';
      case 'batchSize':
        return `${value} activities per batch`;
      default:
        return value || 'Not set';
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Settings color="primary" />
          Database Administration
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Manage database imports, migrations, and maintenance operations.
        </Typography>
        
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Production Environment Warning
          </Typography>
          These operations can permanently modify or delete data. Always verify the current database state before proceeding.
        </Alert>
      </Box>

      {/* Database Status */}
      <Card sx={{ mb: 3 }}>
        <CardHeader 
          title="Current Database Status"
          action={
            <Button
              startIcon={<Refresh />}
              onClick={loadStatus}
              variant="outlined"
            >
              Refresh
            </Button>
          }
        />
        <CardContent>
          {status ? (
            <Grid container spacing={2}>
              <Grid item xs={6} md={2}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.50' }}>
                  <Typography variant="h4" color="primary.main">{status.employeesCount}</Typography>
                  <Typography variant="body2" color="primary.dark">Employees</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={2}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.50' }}>
                  <Typography variant="h4" color="success.main">{status.clientsCount}</Typography>
                  <Typography variant="body2" color="success.dark">Clients</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={2}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'secondary.50' }}>
                  <Typography variant="h4" color="secondary.main">{status.projectsCount}</Typography>
                  <Typography variant="body2" color="secondary.dark">Projects</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={2}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.50' }}>
                  <Typography variant="h4" color="warning.main">{status.workActivitiesCount}</Typography>
                  <Typography variant="body2" color="warning.dark">Work Activities</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={2}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.50' }}>
                  <Typography variant="h4" color="info.main">{status.employeeAssignmentsCount}</Typography>
                  <Typography variant="body2" color="info.dark">Assignments</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={2}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.50' }}>
                  <Typography variant="h4" color="error.main">{status.chargesCount}</Typography>
                  <Typography variant="body2" color="error.dark">Charges</Typography>
                </Paper>
              </Grid>
            </Grid>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={20} />
              <Typography color="text.secondary">Loading status...</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Import Operations */}
      <Card sx={{ mb: 3 }}>
        <CardHeader title="Import Operations" />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<CloudUpload />}
                onClick={() => handleActionClick('import-employees', 'import employees', false)}
                disabled={loading}
                sx={{ p: 2, height: 80 }}
              >
                <Box sx={{ textAlign: 'left', width: '100%' }}>
                  <Typography variant="subtitle1">Import Employees</Typography>
                  <Typography variant="body2" color="inherit" sx={{ opacity: 0.8 }}>
                    Load employee data from Google Sheets
                  </Typography>
                </Box>
              </Button>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Button
                fullWidth
                variant="contained"
                color="success"
                startIcon={<CloudUpload />}
                onClick={() => handleActionClick('import-clients', 'import clients', false)}
                disabled={loading}
                sx={{ p: 2, height: 80 }}
              >
                <Box sx={{ textAlign: 'left', width: '100%' }}>
                  <Typography variant="subtitle1">Import Clients</Typography>
                  <Typography variant="body2" color="inherit" sx={{ opacity: 0.8 }}>
                    Load client data from Google Sheets
                  </Typography>
                </Box>
              </Button>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Button
                fullWidth
                variant="contained"
                color="secondary"
                startIcon={<CloudUpload />}
                onClick={() => handleActionClick('import-all-basic', 'import all basic data', false)}
                disabled={loading}
                sx={{ p: 2, height: 80 }}
              >
                <Box sx={{ textAlign: 'left', width: '100%' }}>
                  <Typography variant="subtitle1">Import All Basic Data</Typography>
                  <Typography variant="body2" color="inherit" sx={{ opacity: 0.8 }}>
                    Import both employees and clients
                  </Typography>
                </Box>
              </Button>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Button
                fullWidth
                variant="contained"
                color="info"
                startIcon={<Storage />}
                onClick={() => handleActionClick('run-migrations', 'run database migrations', false)}
                disabled={loading}
                sx={{ p: 2, height: 80 }}
              >
                <Box sx={{ textAlign: 'left', width: '100%' }}>
                  <Typography variant="subtitle1">Run Migrations</Typography>
                  <Typography variant="body2" color="inherit" sx={{ opacity: 0.8 }}>
                    Apply database schema changes
                  </Typography>
                </Box>
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Work Activities Import */}
      <Card sx={{ mb: 3 }}>
        <CardHeader 
          title="Work Activities Import" 
          subheader="Import historical work activity data from Google Sheets with AI parsing"
        />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                startIcon={<History />}
                onClick={openImportDialog}
                disabled={loading || isImporting}
                sx={{ p: 2, height: 80 }}
              >
                <Box sx={{ textAlign: 'left', width: '100%' }}>
                  <Typography variant="subtitle1">Import Work Activities</Typography>
                  <Typography variant="body2" color="inherit" sx={{ opacity: 0.8 }}>
                    Parse and import historical work activity data with AI assistance
                  </Typography>
                </Box>
              </Button>
            </Grid>
          </Grid>

          {/* Import Progress Display */}
          {isImporting && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Timeline color="primary" />
                  Import Progress - {importOptions.client}
                </Typography>
                <Button
                  size="small"
                  color="error"
                  onClick={cancelImport}
                  startIcon={<Cancel />}
                >
                  Cancel
                </Button>
              </Box>

              {/* Import Settings Summary */}
              <Box sx={{ mb: 2, p: 1, bgcolor: 'white', borderRadius: 1, fontSize: '0.875rem' }}>
                <Typography variant="caption" color="text.secondary">
                  <strong>Settings:</strong> {importOptions.dryRun ? 'Dry Run' : 'Live Import'} • 
                  Batch Size: {importOptions.batchSize} • 
                  {importOptions.maxBatches ? `Max Batches: ${importOptions.maxBatches} • ` : ''}
                  {importOptions.force ? 'Force Overwrite' : 'Skip Duplicates'}
                  {(importOptions.startDate || importOptions.endDate) && (
                    ` • Date Range: ${importOptions.startDate || 'Start'} to ${importOptions.endDate || 'End'}`
                  )}
                </Typography>
              </Box>

              {importProgress.length > 0 && (
                <>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {importProgress[importProgress.length - 1]?.message}
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={getProgressPercentage()} 
                      sx={{ mt: 1 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {getProgressPercentage()}% complete
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">
                      Phase: {importProgress[importProgress.length - 1]?.phase}
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => setShowProgressDetails(!showProgressDetails)}
                      endIcon={showProgressDetails ? <ExpandLess /> : <ExpandMore />}
                    >
                      {showProgressDetails ? 'Hide' : 'Show'} Details
                    </Button>
                  </Box>

                  <Collapse in={showProgressDetails}>
                    <Box sx={{ mt: 2, maxHeight: 200, overflow: 'auto' }}>
                      <List dense>
                        {importProgress.map((progress, index) => (
                          <ListItem key={index}>
                            <ListItemIcon>
                              {progress.phase === 'error' ? (
                                <Error color="error" />
                              ) : progress.phase === 'complete' ? (
                                <CheckCircle color="success" />
                              ) : (
                                <CircularProgress size={20} />
                              )}
                            </ListItemIcon>
                            <ListItemText
                              primary={progress.message}
                              secondary={progress.phase}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  </Collapse>
                </>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Data Import Tools */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          title="Data Import Tools"
          subheader="Import work activities from various sources"
        />
        <CardContent>
          <Grid container spacing={2}>

            <Grid item xs={12} md={6}>
              <Button
                fullWidth
                variant="contained"
                color="secondary"
                onClick={() => window.open('/notion-sync', '_blank')}
                sx={{ p: 2, height: 80 }}
              >
                <Box sx={{ textAlign: 'left', width: '100%' }}>
                  <Typography variant="subtitle1">Sync from Notion</Typography>
                  <Typography variant="body2" color="inherit" sx={{ opacity: 0.8 }}>
                    Import work activities directly from your configured Notion database
                  </Typography>
                </Box>
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Pull from Production */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          title="Pull from Production"
          subheader="Import work activities, clients, and employees from the production server"
        />
        <CardContent>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={pullStartDate}
                onChange={(e) => setPullStartDate(e.target.value)}
                disabled={isPulling}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={pullEndDate}
                onChange={(e) => setPullEndDate(e.target.value)}
                disabled={isPulling}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={pullDryRun}
                    onChange={(e) => setPullDryRun(e.target.checked)}
                    disabled={isPulling}
                  />
                }
                label="Dry Run"
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={pullForce}
                    onChange={(e) => setPullForce(e.target.checked)}
                    disabled={isPulling}
                  />
                }
                label="Force Overwrite"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={startProductionPull}
                disabled={isPulling}
                startIcon={isPulling ? <CircularProgress size={20} /> : <CloudDownload />}
                sx={{ height: '100%', minHeight: 40 }}
              >
                {isPulling ? 'Pulling...' : pullDryRun ? 'Preview Pull' : 'Pull'}
              </Button>
            </Grid>
          </Grid>

          {!pullDryRun && !pullForce && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Duplicate activities will be skipped. Enable "Force Overwrite" to replace existing entries.
            </Alert>
          )}
          {!pullDryRun && pullForce && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Force overwrite is enabled. Existing matching activities will be deleted and re-created.
            </Alert>
          )}

          {/* Pull Progress Display */}
          {(isPulling || pullProgress.length > 0) && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Timeline color="primary" />
                  Pull Progress
                </Typography>
              </Box>

              {pullProgress.length > 0 && (
                <>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {pullProgress[pullProgress.length - 1]?.message}
                    </Typography>
                    {getPullProgressPercentage() > 0 && (
                      <>
                        <LinearProgress
                          variant="determinate"
                          value={getPullProgressPercentage()}
                          sx={{ mt: 1 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {getPullProgressPercentage()}% complete
                        </Typography>
                      </>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">
                      Phase: {pullProgress[pullProgress.length - 1]?.phase}
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => setShowPullDetails(!showPullDetails)}
                      endIcon={showPullDetails ? <ExpandLess /> : <ExpandMore />}
                    >
                      {showPullDetails ? 'Hide' : 'Show'} Details
                    </Button>
                  </Box>

                  <Collapse in={showPullDetails}>
                    <Box sx={{ mt: 2, maxHeight: 200, overflow: 'auto' }}>
                      <List dense>
                        {pullProgress.map((progress, index) => (
                          <ListItem key={index}>
                            <ListItemIcon>
                              {progress.phase === 'error' ? (
                                <Error color="error" />
                              ) : progress.phase === 'complete' ? (
                                <CheckCircle color="success" />
                              ) : (
                                <CircularProgress size={20} />
                              )}
                            </ListItemIcon>
                            <ListItemText
                              primary={progress.message}
                              secondary={progress.phase}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  </Collapse>
                </>
              )}
            </Box>
          )}

          {/* Pull Result Display */}
          {pullResult && (
            <Alert severity={pullResult.success ? 'success' : 'error'} sx={{ mt: 2 }}>
              <Typography variant="subtitle2">{pullResult.message}</Typography>
              {pullResult.details && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Clients: {pullResult.details.clientsCreated} created, {pullResult.details.clientsSkipped} skipped
                  {' | '}
                  Employees: {pullResult.details.employeesCreated} created, {pullResult.details.employeesSkipped} skipped
                  {' | '}
                  Activities: {pullResult.details.activitiesCreated} created, {pullResult.details.activitiesSkipped} skipped
                  {pullResult.details.activitiesErrored > 0 && `, ${pullResult.details.activitiesErrored} errors`}
                </Typography>
              )}
              {pullResult.details?.errors?.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="error">
                    Errors: {pullResult.details.errors.slice(0, 5).join('; ')}
                    {pullResult.details.errors.length > 5 && ` (+${pullResult.details.errors.length - 5} more)`}
                  </Typography>
                </Box>
              )}
              {pullResult.error && (
                <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                  {pullResult.error}
                </Typography>
              )}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Notion Integration */}
      <Card sx={{ mb: 3 }}>
        <CardHeader 
          title="Notion Integration" 
          subheader="Manage Notion database integration"
        />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="contained"
                color="info"
                onClick={() => window.open(process.env.REACT_APP_NOTION_DATABASE_URL || '#', '_blank')}
                sx={{ p: 2, height: 80 }}
              >
                <Box sx={{ textAlign: 'left', width: '100%' }}>
                  <Typography variant="subtitle1">Work Activities Database</Typography>
                  <Typography variant="body2" color="inherit" sx={{ opacity: 0.8 }}>
                    Open Notion database in new tab
                  </Typography>
                </Box>
              </Button>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="contained"
                color="info"
                onClick={() => window.open('/notion-embed', '_blank')}
                sx={{ p: 2, height: 80 }}
              >
                <Box sx={{ textAlign: 'left', width: '100%' }}>
                  <Typography variant="subtitle1">Notion Quick Entry</Typography>
                  <Typography variant="body2" color="inherit" sx={{ opacity: 0.8 }}>
                    Embeddable page for field use
                  </Typography>
                </Box>
              </Button>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                  Access your Notion database directly or use the embedded quick entry form for field data entry.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Automated Tasks */}
      <Card sx={{ mb: 3 }}>
        <CardHeader 
          title="Automated Tasks" 
          subheader="Manually trigger scheduled jobs and automated processes"
        />
        <CardContent>
          <Grid container spacing={2}>
            {/* Maintenance Entries */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Target Date (Optional)"
                  type="date"
                  value={maintenanceEntryDate}
                  onChange={(e) => setMaintenanceEntryDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  helperText={maintenanceEntryDate ? 
                    `Create entries for ${maintenanceEntryDate}` : 
                    "Leave empty to create entries for tomorrow"
                  }
                  size="small"
                  disabled={loading}
                />
                <Button
                  fullWidth
                  variant="contained"
                  color="success"
                  onClick={handleMaintenanceEntriesClick}
                  disabled={loading}
                  sx={{ p: 2, height: 80 }}
                >
                  <Box sx={{ textAlign: 'left', width: '100%' }}>
                    <Typography variant="subtitle1">
                      🌱 Create {maintenanceEntryDate ? `${maintenanceEntryDate}` : "Tomorrow's"} Maintenance Entries
                    </Typography>
                    <Typography variant="body2" color="inherit" sx={{ opacity: 0.8 }}>
                      Generate Notion maintenance entries for {maintenanceEntryDate || "tomorrow's"} calendar events
                    </Typography>
                  </Box>
                </Button>
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                  <strong>Scheduled:</strong> Daily at 8PM Pacific
                </Typography>
              </Box>
            </Grid>
            
            {/* Notion Sync */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ height: 56 }} /> {/* Spacer to align with date field */}
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  onClick={() => executeScript('cron/notion-sync', 'sync Notion pages', {})}
                  disabled={loading}
                  sx={{ p: 2, height: 80 }}
                >
                  <Box sx={{ textAlign: 'left', width: '100%' }}>
                    <Typography variant="subtitle1">
                      🔄 Sync Notion Pages
                    </Typography>
                    <Typography variant="body2" color="inherit" sx={{ opacity: 0.8 }}>
                      Import updated Notion pages into work activities
                    </Typography>
                  </Box>
                </Button>
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                  <strong>Scheduled:</strong> Twice daily (6AM & 6PM UTC)
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Cron Jobs Management */}
      <Card sx={{ mb: 3 }}>
        <CardHeader 
          title="Scheduled Jobs Status" 
          subheader="View and manage automated task schedules"
          action={
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadCronStatus}
              disabled={cronLoading}
              size="small"
            >
              Refresh
            </Button>
          }
        />
        <CardContent>
          {cronLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Job Name</TableCell>
                    <TableCell>Schedule</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Last Run</TableCell>
                    <TableCell>Next Run</TableCell>
                    <TableCell align="center">Enabled</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cronJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <Box>
                          <Typography variant="subtitle2">{job.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {job.description}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Schedule fontSize="small" color="action" />
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {job.schedule}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={job.status} 
                          size="small"
                          color={
                            job.status === 'scheduled' ? 'success' :
                            job.status === 'running' ? 'warning' :
                            job.status === 'error' ? 'error' : 'default'
                          }
                          icon={
                            job.status === 'running' ? <CircularProgress size={12} /> : undefined
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {job.lastRun ? (
                          <Typography variant="body2">
                            {new Date(job.lastRun).toLocaleString()}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Never
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {job.nextRun && job.enabled ? (
                          <Typography variant="body2">
                            {new Date(job.nextRun).toLocaleString()}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {job.enabled ? 'Calculating...' : 'Disabled'}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title={job.enabled ? 'Disable job' : 'Enable job'}>
                          <Switch
                            checked={job.enabled}
                            onChange={(e) => toggleCronJob(job.id, e.target.checked)}
                            disabled={cronLoading}
                            color="primary"
                          />
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          
          {cronJobs.length === 0 && !cronLoading && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography color="text.secondary">
                No cron jobs configured
              </Typography>
            </Box>
          )}
          
          <Box sx={{ mt: 2 }}>
            <Alert severity="info" sx={{ mb: 1 }}>
              <Typography variant="body2">
                <strong>Schedule Format:</strong> Uses standard cron expressions (minute hour day month weekday)
              </Typography>
            </Alert>
            <Alert severity="warning">
              <Typography variant="body2">
                <strong>Note:</strong> Disabling jobs will stop them until manually re-enabled. 
                Changes take effect immediately and persist until the next server restart.
              </Typography>
            </Alert>
          </Box>
        </CardContent>
      </Card>

      {/* Clear Operations */}
      <Card sx={{ mb: 3 }}>
        <CardHeader 
          title="Clear Operations" 
          subheader="These operations permanently delete data. Use with extreme caution."
        />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Button
                fullWidth
                variant="outlined"
                color="warning"
                startIcon={<DeleteForever />}
                onClick={() => handleActionClick('clear-work-activities', 'clear work activities')}
                disabled={loading}
                sx={{ p: 2, height: 80 }}
              >
                <Box sx={{ textAlign: 'left', width: '100%' }}>
                  <Typography variant="subtitle1">Clear Work Activities</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Remove all work activities, assignments, and charges (keeps clients, employees, projects)
                  </Typography>
                </Box>
              </Button>
            </Grid>
            
            <Grid item xs={12}>
              <Button
                fullWidth
                variant="outlined"
                color="warning"
                startIcon={<DeleteForever />}
                onClick={() => handleActionClick('clear-projects-and-work', 'clear projects and work data')}
                disabled={loading}
                sx={{ p: 2, height: 80 }}
              >
                <Box sx={{ textAlign: 'left', width: '100%' }}>
                  <Typography variant="subtitle1">Clear Projects & Work Data</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Remove all work data and projects (keeps clients and employees)
                  </Typography>
                </Box>
              </Button>
            </Grid>
            
            <Grid item xs={12}>
              <Button
                fullWidth
                variant="outlined"
                color="error"
                startIcon={<Warning />}
                onClick={() => handleActionClick('clear-all-data', 'clear ALL data')}
                disabled={loading}
                sx={{ p: 2, height: 80 }}
              >
                <Box sx={{ textAlign: 'left', width: '100%' }}>
                  <Typography variant="subtitle1">⚠️ Clear ALL Data</Typography>
                  <Typography variant="body2" color="text.secondary">
                    DANGER: Remove everything from the database (clients, employees, projects, work activities)
                  </Typography>
                </Box>
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Alert
          severity={result.success ? 'success' : 'error'}
          icon={result.success ? <CheckCircle /> : <Error />}
          sx={{ mb: 3 }}
        >
          <Typography variant="subtitle2" gutterBottom>
            {result.success ? 'Operation Completed' : 'Operation Failed'}
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {result.message}
          </Typography>
          {result.error && (
            <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
              Error: {result.error}
            </Typography>
          )}
          {result.details && (
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Details: {result.details}
            </Typography>
          )}
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            Completed in {formatDuration(result.duration)}
          </Typography>
        </Alert>
      )}

      {/* Loading indicator */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
          <CircularProgress sx={{ mr: 2 }} />
          <Typography color="primary">Processing operation...</Typography>
        </Box>
      )}

      {/* Confirmation Dialog */}
      <Dialog
        open={!!showConfirmation}
        onClose={cancelAction}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="error" />
          Confirm Operation
        </DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to {showConfirmation?.split('|')[1]}? This operation cannot be undone.
          </Typography>
          {showConfirmation && getDangerLevel(showConfirmation.split('|')[0]) === 'extreme' && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                ⚠️ EXTREME DANGER: This will delete ALL data in the database including clients, employees, projects, and work activities.
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelAction} color="inherit">
            Cancel
          </Button>
          <Button onClick={confirmAction} color="error" variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Work Activities Import Dialog */}
      <Dialog
        open={showImportDialog}
        onClose={closeImportDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <History color="primary" />
          Import Work Activities
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Client Selection */}
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Select Client</InputLabel>
                <Select
                  value={importOptions.client}
                  label="Select Client"
                  onChange={(e) => setImportOptions({ ...importOptions, client: e.target.value })}
                  disabled={isImporting}
                >
                  {availableClients.map((client) => (
                    <MenuItem key={client} value={client}>
                      {client}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Import Mode */}
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={importOptions.dryRun}
                    onChange={(e) => setImportOptions({ ...importOptions, dryRun: e.target.checked })}
                    disabled={isImporting}
                  />
                }
                label="Dry Run (Preview Only)"
              />
              <Typography variant="caption" color="text.secondary" display="block">
                Preview import without saving data to database
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={importOptions.force}
                    onChange={(e) => setImportOptions({ ...importOptions, force: e.target.checked })}
                    disabled={isImporting}
                  />
                }
                label="Force Overwrite"
              />
              <Typography variant="caption" color="text.secondary" display="block">
                Overwrite existing activities with same date
              </Typography>
            </Grid>

            {/* Batch Configuration */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Batch Size"
                type="number"
                value={importOptions.batchSize}
                onChange={(e) => setImportOptions({ ...importOptions, batchSize: parseInt(e.target.value) || 8 })}
                disabled={isImporting}
                InputProps={{ inputProps: { min: 1, max: 20 } }}
                helperText="Number of activities to process at once"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Max Batches (Optional)"
                type="number"
                value={importOptions.maxBatches || ''}
                onChange={(e) => setImportOptions({ 
                  ...importOptions, 
                  maxBatches: e.target.value ? parseInt(e.target.value) : undefined 
                })}
                disabled={isImporting}
                InputProps={{ inputProps: { min: 1 } }}
                helperText="Limit number of batches to process"
              />
            </Grid>

            {/* Date Range */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Start Date (Optional)"
                type="date"
                value={importOptions.startDate || ''}
                onChange={(e) => setImportOptions({ ...importOptions, startDate: e.target.value || undefined })}
                disabled={isImporting}
                InputLabelProps={{ shrink: true }}
                helperText="Import activities from this date onwards"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="End Date (Optional)"
                type="date"
                value={importOptions.endDate || ''}
                onChange={(e) => setImportOptions({ ...importOptions, endDate: e.target.value || undefined })}
                disabled={isImporting}
                InputLabelProps={{ shrink: true }}
                helperText="Import activities up to this date"
              />
            </Grid>

            {/* Summary */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Import Configuration Summary:
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">
                      <strong>Client:</strong> {importOptions.client || 'Not selected'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">
                      <strong>Mode:</strong> {formatImportOptionValue('dryRun', importOptions.dryRun)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">
                      <strong>Duplicates:</strong> {formatImportOptionValue('force', importOptions.force)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">
                      <strong>Batch Size:</strong> {formatImportOptionValue('batchSize', importOptions.batchSize)}
                    </Typography>
                  </Grid>
                  {(importOptions.startDate || importOptions.endDate) && (
                    <Grid item xs={12}>
                      <Typography variant="body2">
                        <strong>Date Range:</strong> {importOptions.startDate || 'Beginning'} to {importOptions.endDate || 'End'}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Grid>

            {/* Warning for live import */}
            {!importOptions.dryRun && (
              <Grid item xs={12}>
                <Alert severity="warning">
                  <Typography variant="body2">
                    <strong>Live Import Mode:</strong> This will save data to the database. 
                    Consider running a dry run first to preview the results.
                  </Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeImportDialog} disabled={isImporting}>
            Cancel
          </Button>
          <Button 
            onClick={startWorkActivityImport} 
            variant="contained" 
            disabled={!importOptions.client || isImporting}
            startIcon={isImporting ? <CircularProgress size={20} /> : <PlayArrow />}
          >
            {isImporting ? 'Importing...' : importOptions.dryRun ? 'Preview Import' : 'Start Import'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Admin; 