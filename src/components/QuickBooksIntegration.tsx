import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardHeader,
  Paper,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Refresh,
  OpenInNew,
  AttachMoney,
  Description,
  Settings,
  Sync,
  Storage,
} from '@mui/icons-material';

interface QBOItem {
  id: number;
  qboId: string;
  name: string;
  description: string;
  type: string;
  unitPrice: number;
  active: boolean;
  lastSyncAt: string;
}

interface AuthStatus {
  isValid: boolean;
  credentialsConfigured: boolean;
  error?: string;
}

const QuickBooksIntegration: React.FC = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [qboItems, setQboItems] = useState<QBOItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    checkAuthStatus();
    fetchQBOItems();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/qbo/auth/status');
      const data = await response.json();
      setAuthStatus(data);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setAuthStatus({ isValid: false, credentialsConfigured: false, error: 'Failed to check authentication status' });
    }
  };

  const fetchQBOItems = async () => {
    try {
      const response = await fetch('/api/qbo/items');
      if (response.ok) {
        const items = await response.json();
        setQboItems(items);
      }
    } catch (error) {
      console.error('Error fetching QBO items:', error);
    }
  };

  const initiateOAuth = async () => {
    try {
      const response = await fetch('/api/qbo/auth/url');
      const data = await response.json();
      
      if (data.authUrl) {
        const popup = window.open(data.authUrl, 'qb_oauth', 'width=600,height=600');
        
        // Listen for the popup to complete OAuth
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            // Check auth status after popup closes
            setTimeout(() => {
              checkAuthStatus();
            }, 1000);
          }
        }, 1000);
        
        // Set up message listener for successful auth
        const messageListener = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          
          if (event.data.type === 'QB_AUTH_SUCCESS') {
            clearInterval(checkClosed);
            popup?.close();
            setSuccess('Successfully connected to QuickBooks!');
            checkAuthStatus();
            window.removeEventListener('message', messageListener);
          } else if (event.data.type === 'QB_AUTH_ERROR') {
            clearInterval(checkClosed);
            popup?.close();
            setError(event.data.error || 'QuickBooks authentication failed');
            window.removeEventListener('message', messageListener);
          }
        };
        
        window.addEventListener('message', messageListener);
      } else {
        const errorMessage = data.error || 'Failed to get authorization URL';
        setError(errorMessage);
      }
    } catch (error) {
      console.error('Error initiating OAuth:', error);
      setError('Failed to initiate QuickBooks authentication');
    }
  };

  const refreshToken = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/qbo/auth/refresh', {
        method: 'POST',
      });
      
      if (response.ok) {
        setSuccess('Access token refreshed successfully');
        checkAuthStatus();
      } else {
        setError('Failed to refresh access token');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      setError('Failed to refresh access token');
    } finally {
      setIsLoading(false);
    }
  };

  const syncItems = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/qbo/items/sync', {
        method: 'POST',
      });
      
      if (response.ok) {
        setSuccess('Items synced successfully from QuickBooks');
        fetchQBOItems();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to sync items');
      }
    } catch (error) {
      console.error('Error syncing items:', error);
      setError('Failed to sync items from QuickBooks');
    } finally {
      setIsLoading(false);
    }
  };



  const seedQuickBooksData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/qbo/seed', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setSuccess(data.message);
        // Refresh items after seeding
        fetchQBOItems();
      } else {
        setError(data.error || 'Failed to seed QuickBooks data');
      }
    } catch (error) {
      console.error('Error seeding QuickBooks data:', error);
      setError('Failed to seed QuickBooks sandbox data');
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            QuickBooks Integration
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your QuickBooks Online integration for invoicing and pricing
          </Typography>
        </Box>
        <Button
          onClick={checkAuthStatus}
          variant="outlined"
          startIcon={isLoading ? <CircularProgress size={16} /> : <Refresh />}
          disabled={isLoading}
        >
          Refresh Status
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={clearMessages}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={clearMessages}>
          {success}
        </Alert>
      )}

      {authStatus?.credentialsConfigured === false && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>QuickBooks credentials are not configured.</strong>
          </Typography>
          <Typography variant="body2">
            To set up QuickBooks integration, add the following environment variables to your .env file:
          </Typography>
          <Typography variant="body2" component="div" sx={{ mt: 1, ml: 2 }}>
            • QBO_CLIENT_ID (from QuickBooks Developer app)<br/>
            • QBO_CLIENT_SECRET (from QuickBooks Developer app)<br/>
            • QBO_ENVIRONMENT=sandbox (for testing)<br/>
            • QBO_REDIRECT_URI=http://localhost:3001/api/qbo/callback
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Then restart the server to apply the changes.
          </Typography>
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Authentication Status */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Settings />
                  <Typography variant="h6">Authentication Status</Typography>
                </Box>
              }
              subheader="QuickBooks Online connection status and authentication management"
            />
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {authStatus?.isValid ? (
                    <>
                      <CheckCircle sx={{ color: 'success.main' }} />
                      <Typography color="success.main">Connected to QuickBooks</Typography>
                      <Chip label="Active" color="success" size="small" />
                    </>
                  ) : authStatus?.credentialsConfigured === false ? (
                    <>
                      <Error sx={{ color: 'warning.main' }} />
                      <Typography color="warning.main">Credentials not configured</Typography>
                      <Chip label="Setup Required" color="warning" size="small" />
                    </>
                  ) : (
                    <>
                      <Error sx={{ color: 'error.main' }} />
                      <Typography color="error.main">Not connected</Typography>
                      <Chip label="Disconnected" color="error" size="small" />
                    </>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {authStatus?.isValid ? (
                    <Button
                      onClick={refreshToken}
                      variant="outlined"
                      startIcon={isLoading ? <CircularProgress size={16} /> : <Refresh />}
                      disabled={isLoading}
                    >
                      Refresh Token
                    </Button>
                  ) : authStatus?.credentialsConfigured === false ? (
                    <Button
                      variant="outlined"
                      disabled
                      startIcon={<Settings />}
                    >
                      Setup Required
                    </Button>
                  ) : (
                    <Button
                      onClick={initiateOAuth}
                      variant="contained"
                      startIcon={<OpenInNew />}
                    >
                      Connect to QuickBooks
                    </Button>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Items Sync */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AttachMoney />
                  <Typography variant="h6">Products & Services</Typography>
                </Box>
              }
              subheader="Sync your QuickBooks products and services to maintain accurate pricing"
            />
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Last synced: {qboItems.length > 0 ? new Date(qboItems[0]?.lastSyncAt || '').toLocaleString() : 'Never'}
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {qboItems.length} items synced
                  </Typography>
                </Box>
                <Button
                  onClick={syncItems}
                  disabled={isLoading || !authStatus?.isValid}
                  variant="contained"
                  startIcon={isLoading ? <CircularProgress size={16} /> : <Sync />}
                >
                  Sync Items
                </Button>
              </Box>

              {qboItems.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Available Products & Services
                  </Typography>
                  <Grid container spacing={2}>
                    {qboItems.map((item) => (
                      <Grid item xs={12} md={6} lg={4} key={item.id}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle1" fontWeight="medium">
                              {item.name}
                            </Typography>
                            <Chip
                              label={item.active ? 'Active' : 'Inactive'}
                              color={item.active ? 'success' : 'default'}
                              size="small"
                            />
                          </Box>
                          {item.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {item.description}
                            </Typography>
                          )}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6" color="success.main">
                              ${item.unitPrice?.toFixed(2) || 'N/A'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {item.type}
                            </Typography>
                          </Box>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Description />
                  <Typography variant="h6">Quick Actions</Typography>
                </Box>
              }
              subheader="Common QuickBooks integration tasks"
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Button
                    variant="outlined"
                    fullWidth
                    sx={{ height: 80, flexDirection: 'column' }}
                    onClick={() => window.location.href = '/invoices'}
                  >
                    <Description sx={{ mb: 1 }} />
                    <Typography>View Invoices</Typography>
                  </Button>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button
                    variant="outlined"
                    fullWidth
                    sx={{ height: 80, flexDirection: 'column' }}
                    onClick={() => window.location.href = '/work-activities'}
                  >
                    <AttachMoney sx={{ mb: 1 }} />
                    <Typography>Create Invoice</Typography>
                  </Button>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button
                    variant="contained"
                    color="secondary"
                    fullWidth
                    sx={{ height: 80, flexDirection: 'column' }}
                    onClick={seedQuickBooksData}
                    disabled={isLoading || !authStatus?.isValid}
                  >
                    {isLoading ? <CircularProgress size={24} sx={{ mb: 1 }} /> : <Storage sx={{ mb: 1 }} />}
                    <Typography>Seed Sample Data</Typography>
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default QuickBooksIntegration; 