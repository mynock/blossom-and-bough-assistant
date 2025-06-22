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
} from '@mui/material';
import {
  Refresh,
  Storage,
  CloudUpload,
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

  useEffect(() => {
    loadStatus();
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

  const executeScript = async (endpoint: string, actionName: string) => {
    setLoading(true);
    setResult(null);
    
    try {
      const response = await api.post(`/admin/${endpoint}`);
      setResult({
        success: response.data.success,
        message: response.data.message,
        duration: response.data.duration
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

      {/* Notion Integration */}
      <Card sx={{ mb: 3 }}>
        <CardHeader 
          title="Notion Integration" 
          subheader="Manage Notion database integration and sync work activities"
        />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="contained"
                color="secondary"
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
              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={() => window.open('/notion-sync', '_blank')}
                sx={{ p: 2, height: 80 }}
              >
                <Box sx={{ textAlign: 'left', width: '100%' }}>
                  <Typography variant="subtitle1">Notion Sync</Typography>
                  <Typography variant="body2" color="inherit" sx={{ opacity: 0.8 }}>
                    Sync Notion pages to CRM
                  </Typography>
                </Box>
              </Button>
            </Grid>
          </Grid>
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