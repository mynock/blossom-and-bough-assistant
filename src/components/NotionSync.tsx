import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Box,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material';
import {
  Sync,
  CheckCircle,
  Error,
  Info,
  Assignment,
  Warning,
  ExpandMore,
  Shield,
} from '@mui/icons-material';

const API_BASE = process.env.REACT_APP_API_URL || '/api';
const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface SyncStats {
  created: number;
  updated: number;
  errors: number;
  warnings?: string[];
}

interface SyncStatus {
  configured: boolean;
  hasNotionToken: boolean;
  hasNotionDatabase: boolean;
  hasAnthropicKey?: boolean;
  aiParsingEnabled?: boolean;
  databaseId: string | null;
}

interface ImportStats {
  totalWorkActivities: number;
  notionImported: number;
  percentage: number;
}

export const NotionSync: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [lastSyncStats, setLastSyncStats] = useState<SyncStats | null>(null);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [lastSyncWarnings, setLastSyncWarnings] = useState<string[]>([]);

  useEffect(() => {
    loadSyncStatus();
    loadImportStats();
  }, []);

  const loadSyncStatus = async () => {
    try {
      const response = await api.get('/notion-sync/status');
      setSyncStatus(response.data);
    } catch (err) {
      console.error('Error loading sync status:', err);
      setError('Failed to load sync status');
    }
  };

  const loadImportStats = async () => {
    try {
      const response = await api.get('/notion-sync/stats');
      setImportStats(response.data.stats);
    } catch (err) {
      console.error('Error loading import stats:', err);
      // Don't set error for stats loading failure, it's not critical
    }
  };

  const handleSync = async () => {
    setIsLoading(true);
    setMessage('');
    setError('');
    setLastSyncWarnings([]);
    
    try {
      const response = await api.post('/notion-sync/sync');
      setLastSyncStats(response.data.stats);
      setMessage(response.data.message);
      
      // Handle warnings from AI parsing
      if (response.data.warnings && response.data.warnings.length > 0) {
        setLastSyncWarnings(response.data.warnings);
      }
      
      // Reload status and stats after sync
      await loadSyncStatus();
      await loadImportStats();
    } catch (err: any) {
      console.error('Error during sync:', err);
      setError(err.response?.data?.error || 'Sync failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (!syncStatus) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
          <CircularProgress sx={{ mr: 2 }} />
          <Typography>Loading sync status...</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Card>
        <CardHeader
          title="Notion Sync with AI Parsing"
          subheader="Sync work activities between Notion and your CRM using intelligent AI parsing"
          avatar={<Assignment color="primary" />}
        />
        <CardContent>
          {/* Configuration Status */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Configuration Status
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    icon={syncStatus.hasNotionToken ? <CheckCircle /> : <Error />}
                    label={`Notion Token: ${syncStatus.hasNotionToken ? 'Configured' : 'Missing'}`}
                    color={syncStatus.hasNotionToken ? 'success' : 'error'}
                    variant="outlined"
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    icon={syncStatus.hasNotionDatabase ? <CheckCircle /> : <Error />}
                    label={`Notion Database: ${syncStatus.hasNotionDatabase ? 'Configured' : 'Missing'}`}
                    color={syncStatus.hasNotionDatabase ? 'success' : 'error'}
                    variant="outlined"
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    icon={syncStatus.hasAnthropicKey ? <CheckCircle /> : <Error />}
                    label={`AI Parsing: ${syncStatus.hasAnthropicKey ? 'Enabled' : 'Disabled'}`}
                    color={syncStatus.hasAnthropicKey ? 'success' : 'error'}
                    variant="outlined"
                  />
                </Box>
              </Grid>
            </Grid>
            {syncStatus.databaseId && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Database ID: {syncStatus.databaseId}
              </Typography>
            )}
            {syncStatus.aiParsingEnabled && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>AI Parsing Enabled:</strong> Notion pages will be converted to natural text and parsed by AI for more robust field extraction and data cleaning.
                </Typography>
              </Alert>
            )}
          </Box>

          {/* Import Statistics */}
          {importStats && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Import Statistics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.50' }}>
                    <Typography variant="h4" color="primary.main">
                      {importStats.totalWorkActivities}
                    </Typography>
                    <Typography variant="body2" color="primary.dark">
                      Total Work Activities
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.50' }}>
                    <Typography variant="h4" color="success.main">
                      {importStats.notionImported}
                    </Typography>
                    <Typography variant="body2" color="success.dark">
                      From Notion
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.50' }}>
                    <Typography variant="h4" color="info.main">
                      {importStats.percentage}%
                    </Typography>
                    <Typography variant="body2" color="info.dark">
                      Notion Coverage
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
              
              {/* Progress bar for visual representation */}
              <Box sx={{ mt: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Notion Coverage Progress
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {importStats.notionImported} of {importStats.totalWorkActivities} activities
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={importStats.percentage} 
                  sx={{ 
                    height: 8, 
                    borderRadius: 4,
                    bgcolor: 'grey.200',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: importStats.percentage > 75 ? 'success.main' : 
                             importStats.percentage > 50 ? 'warning.main' : 'error.main'
                    }
                  }}
                />
              </Box>
            </Box>
          )}

          {/* Sync Controls */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Sync Controls
            </Typography>
            <Button
              variant="contained"
              startIcon={isLoading ? <CircularProgress size={20} /> : <Sync />}
              onClick={handleSync}
              disabled={!syncStatus.configured || isLoading}
              size="large"
              sx={{ mb: 2 }}
            >
              {isLoading ? 'Syncing with AI...' : 'Sync Notion Pages'}
            </Button>
            
            {!syncStatus.configured && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Please configure Notion token, database ID, and Anthropic API key in environment variables to enable sync.
              </Alert>
            )}
          </Box>

          {/* Messages */}
          {message && (
            <Alert severity="success" sx={{ mb: 3 }} icon={<CheckCircle />}>
              {message}
            </Alert>
          )}
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} icon={<Error />}>
              {error}
            </Alert>
          )}

          {/* Warnings from AI Parsing */}
          {lastSyncWarnings.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Warning color="warning" />
                    <Typography variant="h6">
                      Sync Warnings ({lastSyncWarnings.length})
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    The following issues occurred during sync. Items may have been skipped to protect your local changes:
                  </Typography>
                  {lastSyncWarnings.some(w => w.includes('Skipped sync')) && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        🛡️ <strong>Data Protection Active:</strong> Some items were skipped because you have local 
                        changes that are newer than the last Notion sync. Your edits are safe!
                      </Typography>
                    </Alert>
                  )}
                  <List dense>
                    {lastSyncWarnings.map((warning, index) => {
                      const isSkipped = warning.includes('Skipped sync');
                      return (
                        <ListItem key={index} sx={{ pl: 0 }}>
                          <ListItemIcon>
                            {isSkipped ? (
                              <Shield color="info" fontSize="small" />
                            ) : (
                              <Warning color="warning" fontSize="small" />
                            )}
                          </ListItemIcon>
                          <ListItemText 
                            primary={warning}
                            primaryTypographyProps={{ 
                              variant: 'body2',
                              color: isSkipped ? 'info.main' : 'warning.main'
                            }}
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                </AccordionDetails>
              </Accordion>
            </Box>
          )}

          {/* Last Sync Stats */}
          {lastSyncStats && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Last Sync Results
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.50' }}>
                    <Typography variant="h4" color="success.main">
                      {lastSyncStats.created}
                    </Typography>
                    <Typography variant="body2" color="success.dark">
                      Created
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.50' }}>
                    <Typography variant="h4" color="info.main">
                      {lastSyncStats.updated}
                    </Typography>
                    <Typography variant="body2" color="info.dark">
                      Updated
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.50' }}>
                    <Typography variant="h4" color="error.main">
                      {lastSyncStats.errors}
                    </Typography>
                    <Typography variant="body2" color="error.dark">
                      Errors
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Instructions */}
          <Box sx={{ mt: 4 }}>
            <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Info color="primary" />
                How AI-Powered Sync Works
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Fetches Notion pages from your configured database" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Converts Notion page content to natural text format" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Uses AI to intelligently parse and extract work activity data" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Validates and imports activities using the same logic as work notes import" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Handles inconsistent data entry and cleans up field mapping automatically" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Provides detailed warnings for parsing issues" />
                </ListItem>
              </List>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary">
                <strong>Benefits of AI Parsing:</strong> More robust field extraction, better handling of missing data, 
                automatic data cleaning, and consistent parsing logic across all import methods.
              </Typography>
            </Paper>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}; 