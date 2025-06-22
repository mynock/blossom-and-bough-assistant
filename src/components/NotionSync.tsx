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
} from '@mui/material';
import {
  Sync,
  CheckCircle,
  Error,
  Info,
  Assignment,
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
}

interface SyncStatus {
  configured: boolean;
  hasNotionToken: boolean;
  hasNotionDatabase: boolean;
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
    
    try {
      const response = await api.post('/notion-sync/sync');
      setLastSyncStats(response.data.stats);
      setMessage(response.data.message);
      
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
          title="Notion Sync"
          subheader="Sync work activities between Notion and your CRM"
          avatar={<Assignment color="primary" />}
        />
        <CardContent>
          {/* Configuration Status */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Configuration Status
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    icon={syncStatus.hasNotionToken ? <CheckCircle /> : <Error />}
                    label={`Notion Token: ${syncStatus.hasNotionToken ? 'Configured' : 'Missing'}`}
                    color={syncStatus.hasNotionToken ? 'success' : 'error'}
                    variant="outlined"
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    icon={syncStatus.hasNotionDatabase ? <CheckCircle /> : <Error />}
                    label={`Notion Database: ${syncStatus.hasNotionDatabase ? 'Configured' : 'Missing'}`}
                    color={syncStatus.hasNotionDatabase ? 'success' : 'error'}
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
              {isLoading ? 'Syncing...' : 'Sync Notion Pages'}
            </Button>
            
            {!syncStatus.configured && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Please configure Notion token and database ID in environment variables to enable sync.
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
                How it Works
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Syncs Notion pages from your configured database" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Creates new work activities for pages not yet imported" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Updates existing work activities if Notion page was modified" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Extracts client name, date, work type, tasks, notes, and materials" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Automatically creates client records if they don't exist" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Uses Notion page ID to prevent duplicates" />
                </ListItem>
              </List>
            </Paper>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}; 