import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  CircularProgress, 
  Autocomplete,
  TextField
} from '@mui/material';
import { notionApi, Client } from '../services/api';

interface CreateEntryResponse {
  success: boolean;
  page_url: string;
  carryover_tasks: string[];
  error?: string;
}

const NotionQuickEntry: React.FunctionComponent = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<CreateEntryResponse | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientInputValue, setClientInputValue] = useState<string>('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState<boolean>(true);
  const [showForm, setShowForm] = useState<boolean>(true);

  // Debug logging for iOS troubleshooting
  useEffect(() => {
    console.log('NotionQuickEntry mounted');
    console.log('User Agent:', navigator.userAgent);
    console.log('Is iOS:', /iPad|iPhone|iPod/.test(navigator.userAgent));
    console.log('Window dimensions:', window.innerWidth, 'x', window.innerHeight);
    console.log('Location:', window.location.href);
    console.log('Parent window check:', window.parent !== window ? 'In iframe' : 'Not in iframe');
  }, []);

  // Fetch all clients on component mount
  useEffect(() => {
    const fetchClients = async () => {
      try {
        console.log('Fetching clients from API...');
        const response = await notionApi.getClients();
        console.log('Clients fetched successfully:', response.clients.length, 'clients');
        setClients(response.clients);
              } catch (error) {
          console.error('Error fetching clients:', error);
          console.error('Error details:', (error as any)?.response?.data || (error as Error)?.message);
      } finally {
        setLoadingClients(false);
      }
    };

    fetchClients();
  }, []);

  const createEntry = async () => {
    // Use the client name from either the selected client or the input value (for new clients)
    const clientName = selectedClient ? selectedClient.name : clientInputValue.trim();
    
    if (!clientName) return;
    
    console.log('Creating entry for client:', clientName);
    console.log('API endpoint will be called:', '/api/notion/create-smart-entry');
    
    setShowForm(false);
    setLoading(true);
    setResult(null);

    try {
      console.log('Making API call...');
      const response = await notionApi.createSmartEntry(clientName);
      console.log('API call successful:', response);
      setResult(response);
    } catch (error) {
      console.error('Error creating entry:', error);
      console.error('Error details:', (error as any)?.response?.data || (error as Error)?.message);
      console.error('Error status:', (error as any)?.response?.status);
      setResult({
        success: false,
        page_url: '',
        carryover_tasks: [],
        error: 'Failed to create entry - check console for details',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowForm(true);
    setLoading(false);
    setResult(null);
    setSelectedClient(null);
    setClientInputValue('');
  };

  // iOS-compatible navigation handler
  const handleOpenEntry = (url: string) => {
    try {
      // Try to open in new window/tab - works better on iOS
      const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
      if (!newWindow) {
        // Fallback: try direct navigation if popup blocked
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error opening work entry:', error);
      // Final fallback: copy URL to clipboard and show message
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          alert('Unable to open automatically. URL copied to clipboard - please paste in your browser.');
        }).catch(() => {
          alert('Unable to open automatically. Please navigate to: ' + url);
        });
      } else {
        alert('Unable to open automatically. Please navigate to: ' + url);
      }
    }
  };

  return (
    <Box
      sx={{
        fontFamily: 'system-ui',
        padding: 3,
        maxWidth: 400,
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: 2,
        boxShadow: 1,
        minHeight: '200px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {showForm && (
        <>
          <Typography 
            variant="h5" 
            component="h2" 
            sx={{ 
              marginBottom: 3, 
              color: '#2e7d32',
              textAlign: 'center',
              fontWeight: 600
            }}
          >
            🌱 Quick Work Entry
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Autocomplete
              freeSolo
              options={clients}
              getOptionLabel={(option) => 
                typeof option === 'string' ? option : option.name
              }
              value={selectedClient}
              inputValue={clientInputValue}
              onChange={(event, newValue) => {
                if (typeof newValue === 'string') {
                  // User typed a custom value
                  setSelectedClient(null);
                  setClientInputValue(newValue);
                } else {
                  // User selected from dropdown
                  setSelectedClient(newValue);
                  setClientInputValue(newValue ? newValue.name : '');
                }
              }}
              onInputChange={(event, newInputValue) => {
                setClientInputValue(newInputValue);
                // Clear selected client if input doesn't match exactly
                if (selectedClient && selectedClient.name !== newInputValue) {
                  setSelectedClient(null);
                }
              }}
              loading={loadingClients}
              disabled={loading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select or Enter Client Name"
                  variant="outlined"
                  helperText="Choose from existing clients or type a new client name"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && (selectedClient || clientInputValue.trim())) {
                      createEntry();
                    }
                  }}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingClients ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              filterOptions={(options, { inputValue }) =>
                options.filter((option) =>
                  option.name.toLowerCase().includes(inputValue.toLowerCase())
                )
              }
            />

            <Button
              onClick={createEntry}
              disabled={loading || (!selectedClient && !clientInputValue.trim())}
              variant="contained"
              size="large"
              sx={{
                backgroundColor: '#2e7d32',
                color: 'white',
                '&:hover': {
                  backgroundColor: '#1b5e20',
                },
                '&:disabled': {
                  backgroundColor: '#ccc',
                  color: 'white',
                },
                textTransform: 'none',
                fontSize: '16px',
                padding: '12px 24px',
                minHeight: '48px',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
            >
              Create Work Entry
            </Button>
          </Box>
        </>
      )}

      {loading && (
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: 2,
            textAlign: 'center'
          }}
        >
          <CircularProgress size={48} sx={{ color: '#2e7d32' }} />
          <Typography variant="h6" sx={{ color: '#2e7d32' }}>
            Creating entry for {selectedClient ? selectedClient.name : clientInputValue}...
          </Typography>
          <Typography variant="body2" sx={{ color: '#666' }}>
            Checking for tasks to carry over
          </Typography>
        </Box>
      )}

      {result && !loading && (
        <Box sx={{ textAlign: 'center' }}>
          {result.success ? (
            <Box>
              <Typography variant="h6" sx={{ color: '#2e7d32', marginBottom: 2 }}>
                ✅ Entry Created!
              </Typography>
              <Typography variant="body1" sx={{ marginBottom: 1 }}>
                {selectedClient ? selectedClient.name : clientInputValue}
              </Typography>
              <Typography variant="body2" sx={{ marginBottom: 3, color: '#666' }}>
                📋 {result.carryover_tasks.length} task{result.carryover_tasks.length !== 1 ? 's' : ''} carried over
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  onClick={() => handleOpenEntry(result.page_url)}
                  variant="contained"
                  sx={{
                    backgroundColor: '#0969da',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: '#0550ae',
                    },
                    textTransform: 'none',
                    fontSize: '14px',
                    minHeight: '44px',
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
                    padding: '10px 16px',
                  }}
                >
                  → Open Work Entry
                </Button>
                <Button
                  onClick={resetForm}
                  variant="outlined"
                  sx={{
                    color: '#2e7d32',
                    borderColor: '#2e7d32',
                    '&:hover': {
                      backgroundColor: '#f1f8e9',
                      borderColor: '#2e7d32',
                    },
                    textTransform: 'none',
                    fontSize: '14px',
                    minHeight: '44px',
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
                    padding: '10px 16px',
                  }}
                >
                  Create Another Entry
                </Button>
              </Box>
            </Box>
          ) : (
            <Box>
              <Typography variant="h6" sx={{ color: '#d32f2f', marginBottom: 2 }}>
                ❌ Error Details
              </Typography>
              <Typography variant="body2" sx={{ marginBottom: 1 }}>
                {result.error}
              </Typography>
              <Typography variant="caption" sx={{ 
                display: 'block', 
                marginBottom: 3, 
                fontFamily: 'monospace',
                backgroundColor: '#f5f5f5',
                padding: 1,
                borderRadius: 1,
                fontSize: '12px'
              }}>
                Debug: Check browser console for detailed logs<br/>
                User Agent: {/iPad|iPhone|iPod/.test(navigator.userAgent) ? 'iOS Device' : 'Other Device'}<br/>
                In iframe: {window.parent !== window ? 'Yes' : 'No'}
              </Typography>
              <Button
                onClick={resetForm}
                variant="contained"
                sx={{
                  backgroundColor: '#2e7d32',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: '#1b5e20',
                  },
                  textTransform: 'none',
                }}
              >
                Try Again
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default NotionQuickEntry; 