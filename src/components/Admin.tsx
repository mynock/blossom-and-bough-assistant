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
  Chip,
  Divider,
  Paper,
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

const Admin: React.FC = () => {
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [showConfirmation, setShowConfirmation] = useState<string | null>(null);

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

  const getActionColor = (action: string) => {
    const level = getDangerLevel(action);
    if (level === 'extreme') return 'error';
    if (level === 'high') return 'warning';
    return 'primary';
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
    </Container>
  );
};

export default Admin; 