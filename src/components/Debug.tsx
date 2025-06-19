import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  FormControlLabel,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  ExpandMore,
  Refresh,
  BugReport,
  Memory,
  TextFields,
  Settings,
  Storage,
  CloudDownload,
  Warning,
} from '@mui/icons-material';

interface SystemPromptData {
  meta: {
    showType: string;
    showFullContent: boolean;
    timestamp: string;
  };
  current: {
    type: string;
    length: number;
    estimatedTokens: number;
    content: string;
  };
  tokenSavings: {
    characters: number;
    estimatedTokens: number;
    percentReduction: number;
  };
}

const Debug: React.FC = () => {
  const [data, setData] = useState<SystemPromptData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullContent, setShowFullContent] = useState(false);

  // Database management state
  const [migrationStatus, setMigrationStatus] = useState<any>(null);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    action: () => {}
  });

  const fetchDebugData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (showFullContent) {
        params.append('fullContent', 'true');
      }
      
      const url = `/api/debug/system-prompt${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch debug data');
    } finally {
      setLoading(false);
    }
  }, [showFullContent]);

  // Database management functions
  const fetchMigrationStatus = useCallback(async () => {
    setMigrationLoading(true);
    setMigrationError(null);
    
    try {
      const response = await fetch('/api/migration/status');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      setMigrationStatus(result);
    } catch (err) {
      setMigrationError(err instanceof Error ? err.message : 'Failed to fetch migration status');
    } finally {
      setMigrationLoading(false);
    }
  }, []);

  const handleSeedReset = async () => {
    setMigrationLoading(true);
    setMigrationError(null);
    
    try {
      const response = await fetch('/api/migration/seed-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirm: 'RESET_AND_SEED' }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setMigrationError(null);
        // Refresh migration status
        await fetchMigrationStatus();
        alert(`Success: ${result.message}\n\nEmployees imported: ${result.employeesImported}\nClients imported: ${result.clientsImported}`);
      } else {
        setMigrationError(result.error || 'Seed/reset operation failed');
      }
    } catch (err) {
      setMigrationError(err instanceof Error ? err.message : 'Failed to perform seed/reset');
    } finally {
      setMigrationLoading(false);
      setConfirmDialog({ ...confirmDialog, open: false });
    }
  };

  const showConfirmDialog = (title: string, message: string, action: () => void) => {
    setConfirmDialog({
      open: true,
      title,
      message,
      action
    });
  };

  useEffect(() => {
    fetchDebugData();
    fetchMigrationStatus();
  }, [fetchDebugData, fetchMigrationStatus]);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <BugReport sx={{ mr: 2, color: 'primary.main' }} />
        <Typography variant="h4" component="h1">
          System Prompt Debug
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchDebugData}
          disabled={loading}
          sx={{ ml: 'auto' }}
        >
          Refresh
        </Button>
      </Box>

      {/* Controls */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Settings sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">Debug Controls</Typography>
        </Box>
        
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={showFullContent}
                  onChange={(e) => setShowFullContent(e.target.checked)}
                  color="primary"
                />
              }
              label="Show Full Content (No Truncation)"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            {data?.meta && (
              <Typography variant="body2" color="text.secondary">
                Last updated: {new Date(data.meta.timestamp).toLocaleTimeString()}
              </Typography>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Database Management */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Storage sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">Database Management</Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Refresh />}
            onClick={fetchMigrationStatus}
            disabled={migrationLoading}
            sx={{ ml: 'auto' }}
          >
            Refresh Status
          </Button>
        </Box>
        
        {migrationError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>Error:</strong> {migrationError}
          </Alert>
        )}
        
        <Grid container spacing={3}>
          {/* Database Status */}
          <Grid item xs={12} md={8}>
            {migrationLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                <Typography>Loading status...</Typography>
              </Box>
            ) : migrationStatus ? (
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="h6" color="primary">
                        {migrationStatus.employeesCount}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Employees
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={4}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="h6" color="primary">
                        {migrationStatus.clientsCount}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Clients
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={4}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="h6" color="primary">
                        {migrationStatus.workActivitiesCount}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Work Activities
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            ) : (
              <Typography color="text.secondary">No status data available</Typography>
            )}
          </Grid>
          
          {/* Actions */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<CloudDownload />}
                onClick={() => showConfirmDialog(
                  'Reset and Seed Database',
                  'This will DELETE ALL existing data and replace it with fresh data from Google Sheets. This action cannot be undone.',
                  handleSeedReset
                )}
                disabled={migrationLoading}
                color="warning"
                fullWidth
              >
                Seed/Reset from Sheets
              </Button>
              
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                Clears database and imports fresh data from Google Sheets
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <strong>Error:</strong> {error}
        </Alert>
      )}

      {data && (
        <>
          {/* Overview Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Memory sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">Token Usage</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">
                    {data.current.estimatedTokens.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    tokens
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TextFields sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">Characters</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">
                    {data.current.length.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    characters
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <BugReport sx={{ mr: 1, color: 'success.main' }} />
                    <Typography variant="h6">Mode</Typography>
                  </Box>
                  <Typography variant="h4" color="success.main">
                    Clean
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    natural mode
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Full Content Warning */}
          {showFullContent && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <strong>Full Content Mode:</strong> Displaying complete prompt without truncation. 
              Large prompts may impact browser performance.
            </Alert>
          )}

          {/* System Prompt */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              System Prompt
            </Typography>
            
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    Current Prompt (Natural Mode)
                  </Typography>
                  <Chip 
                    label={`${data.current.estimatedTokens.toLocaleString()} tokens`}
                    size="small"
                    color="primary"
                    sx={{ mr: 2 }}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {!showFullContent && data.current.content.includes('[truncated for display]') && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Showing preview only. Enable "Show Full Content" above to see the complete prompt.
                  </Alert>
                )}
                <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                  <Typography 
                    variant="body2" 
                    component="pre" 
                    sx={{ 
                      fontFamily: 'monospace', 
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.875rem',
                      lineHeight: 1.4
                    }}
                  >
                    {data.current.content}
                  </Typography>
                </Box>
              </AccordionDetails>
            </Accordion>
          </Paper>
        </>
      )}
      
      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <Warning sx={{ mr: 1, color: 'warning.main' }} />
          {confirmDialog.title}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmDialog.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
            color="primary"
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmDialog.action}
            color="warning"
            variant="contained"
            disabled={migrationLoading}
          >
            {migrationLoading ? 'Processing...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Debug; 