import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Alert, 
  CircularProgress, 
  Autocomplete,
  TextField
} from '@mui/material';
import { notionApi, clientsApi, Client } from '../services/api';

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

  // Fetch all clients on component mount
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await notionApi.getClients();
        setClients(response.clients);
      } catch (error) {
        console.error('Error fetching clients:', error);
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
    
    setLoading(true);
    setResult(null);

    try {
      const response = await notionApi.createSmartEntry(clientName);
      setResult(response);
    } catch (error) {
      console.error('Error creating entry:', error);
      setResult({
        success: false,
        page_url: '',
        carryover_tasks: [],
        error: 'Failed to create entry',
      });
    } finally {
      setLoading(false);
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
      }}
    >
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
            backgroundColor: loading ? '#ccc' : '#2e7d32',
            color: 'white',
            '&:hover': {
              backgroundColor: loading ? '#ccc' : '#1b5e20',
            },
            '&:disabled': {
              backgroundColor: '#ccc',
              color: 'white',
            },
            textTransform: 'none',
            fontSize: '16px',
            padding: '12px 24px',
          }}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {loading ? 'Creating Entry...' : 'Create Work Entry'}
        </Button>
      </Box>

      {result && (
        <Box sx={{ marginTop: 3 }}>
          {result.success ? (
            <Alert 
              severity="success" 
              sx={{ 
                '& .MuiAlert-message': { 
                  width: '100%' 
                }
              }}
            >
              <Box>
                <Typography variant="body2" sx={{ marginBottom: 1 }}>
                  ✅ Created entry for {selectedClient ? selectedClient.name : clientInputValue} successfully
                </Typography>
                <Typography variant="body2" sx={{ marginBottom: 2 }}>
                  📋 Carried over {result.carryover_tasks.length} task{result.carryover_tasks.length !== 1 ? 's' : ''}
                </Typography>
                <Button
                  href={result.page_url}
                  target="_parent"
                  variant="contained"
                  size="small"
                  sx={{
                    backgroundColor: '#0969da',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: '#0550ae',
                    },
                    textTransform: 'none',
                    fontSize: '14px',
                  }}
                >
                  → Open Work Entry
                </Button>
              </Box>
            </Alert>
          ) : (
            <Alert severity="error">
              <Typography variant="body2">
                ❌ Error: {result.error}
              </Typography>
            </Alert>
          )}
        </Box>
      )}
    </Box>
  );
};

export default NotionQuickEntry; 