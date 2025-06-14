import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Paper,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import { ContentCopy, Event } from '@mui/icons-material';
import { helpersApi, clientsApi, Helper, Client } from '../services/api';

/**
 * Calendar Template Generator for Maintenance Events
 * 
 * TITLE STRUCTURE RECOMMENDATION:
 * Format: "[Status] Client Name - Service Type [+ Andrea]"
 * Example: "[Tentative] Smith Property - Maintenance + Andrea"
 * 
 * Why this format:
 * - Status in brackets for quick identification of confirmation level
 * - Client name first for easy scanning in calendar view
 * - Service type for quick identification of work type
 * - Andrea indicator when she's on-site for supervision/consultation
 * 
 * DESCRIPTION STRUCTURE:
 * Contains all detailed operational information:
 * - Client & Helper details (IDs for reference)
 * - Service specifics (type, hours, timing)
 * - Logistics (location, zone, flexibility)
 * - Status tracking (confirmation, notifications)
 * - Special requirements (gate codes, materials, weather sensitivity)
 * - Notes for additional context
 * 
 * This separation keeps the calendar view clean while ensuring all
 * necessary information is available when viewing event details.
 */

interface TemplateOptions {
  clientId: string;
  helperId: string;
  serviceType: string;
  clientName: string;
  helperName: string;
  andreaOnSite: boolean;
  hours: string;
  flexibility: string;
  priority: string;
  location: string;
  zone: string;
  clientNotified: boolean;
  status: string;
  notes: string;
  // Optional fields
  projectId?: string;
  projectName?: string;
  weatherSensitive: boolean;
}

const CalendarTemplateGenerator: React.FC = () => {
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [template, setTemplate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [options, setOptions] = useState<TemplateOptions>({
    clientId: '',
    helperId: '',
    serviceType: 'Maintenance',
    clientName: '',
    helperName: '',
    andreaOnSite: true,
    hours: '4.0',
    flexibility: '',
    priority: 'Medium',
    location: '',
    zone: '',
    clientNotified: false,
    status: '',
    notes: '',
    weatherSensitive: false,
    projectId: '',
    projectName: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [helpersData, clientsData] = await Promise.all([
          helpersApi.getAll(),
          clientsApi.getAll(),
        ]);
        setHelpers(helpersData.helpers);
        setClients(clientsData.clients);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const handleClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setOptions(prev => ({
        ...prev,
        clientId,
        clientName: client.name,
        location: client.address,
        zone: client.zone,
        priority: client.priority,
        // Note: Gate codes and special requirements need to be entered manually
        // as they're not available in the current frontend Client interface
        gateCode: '',
      }));
    }
  };

  const handleHelperChange = (helperId: string) => {
    const helper = helpers.find(h => h.id === helperId);
    if (helper) {
      setOptions(prev => ({
        ...prev,
        helperId,
        helperName: helper.name,
      }));
    }
  };

  const generateTemplate = async () => {
    if (!options.clientId || !options.helperId || !options.serviceType) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/calendar/template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: options.clientId,
          helperId: options.helperId,
          serviceType: options.serviceType,
          options: {
            clientName: options.clientName,
            helperName: options.helperName,
            hours: options.hours,
            priority: options.priority,
            location: options.location,
            zone: options.zone,
            projectId: options.projectId,
            projectName: options.projectName,
            weatherSensitive: options.weatherSensitive,
            clientNotified: options.clientNotified,
            notes: options.notes,
          },
        }),
      });

      const data = await response.json();
      setTemplate(data.template);
    } catch (error) {
      console.error('Error generating template:', error);
      // Fallback to client-side generation
      generateClientSideTemplate();
    } finally {
      setLoading(false);
    }
  };

  const generateClientSideTemplate = () => {
    // TITLE RECOMMENDATION: Keep it concise with most critical info
    // Format: "[Status] Client - Service [+ Andrea]"
    const andreaIndicator = options.andreaOnSite ? ' + Andrea' : '';
    const statusPrefix = options.status ? `[${options.status}] ` : '[Tentative] ';
    const title = `${statusPrefix}${options.clientName} - ${options.serviceType}${andreaIndicator}`;
    
    // DESCRIPTION: Include all detailed information
    const description = `CLIENT: ${options.clientName} (${options.clientId})
HELPER: ${options.helperName} (${options.helperId})
SERVICE: ${options.serviceType}
ANDREA ON-SITE: ${options.andreaOnSite ? 'Yes' : 'No'}
HOURS: ${options.hours}
FLEXIBILITY: ${options.flexibility || 'Standard'}
PRIORITY: ${options.priority}

LOCATION: ${options.location}
ZONE: ${options.zone}
${options.projectId ? `PROJECT: ${options.projectName || '[Project Name]'} (${options.projectId})` : ''}

STATUS: ${options.status || 'Tentative'}
CLIENT NOTIFIED: ${options.clientNotified ? 'Yes' : 'No'}
WEATHER SENSITIVE: ${options.weatherSensitive ? 'Yes' : 'No'}

NOTES: ${options.notes || '[Additional notes]'}`;

    const template = `TITLE: ${title}

DESCRIPTION:
${description}

LOCATION: ${options.location}`;

    setTemplate(template);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(template);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const serviceTypes = ['Maintenance', 'Install', 'Pruning', 'Design', 'Repair', 'Consultation'];
  const priorities = ['High', 'Medium', 'Low'];
  const flexibilityOptions = ['Fixed', 'Preferred', 'Flexible'];
  const statusOptions = ['Tentative', 'Self-Confirmed', 'Client-Confirmed', 'Rescheduled'];

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={3}>
          <Event color="primary" />
          <Typography variant="h6">
            Calendar Event Template Generator
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Client Selection */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Client</InputLabel>
              <Select
                value={options.clientId}
                label="Client"
                onChange={(e) => handleClientChange(e.target.value)}
              >
                {clients.map((client) => (
                  <MenuItem key={client.id} value={client.id}>
                    {client.name} ({client.id}) - {client.zone}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Helper Selection */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Helper</InputLabel>
              <Select
                value={options.helperId}
                label="Helper"
                onChange={(e) => handleHelperChange(e.target.value)}
              >
                {helpers.map((helper) => (
                  <MenuItem key={helper.id} value={helper.id}>
                    {helper.name} ({helper.id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Service Type */}
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Service Type</InputLabel>
              <Select
                value={options.serviceType}
                label="Service Type"
                onChange={(e) => setOptions(prev => ({ ...prev, serviceType: e.target.value }))}
              >
                {serviceTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Hours */}
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Estimated Hours"
              value={options.hours}
              onChange={(e) => setOptions(prev => ({ ...prev, hours: e.target.value }))}
            />
          </Grid>

          {/* Priority */}
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={options.priority}
                label="Priority"
                onChange={(e) => setOptions(prev => ({ ...prev, priority: e.target.value }))}
              >
                {priorities.map((priority) => (
                  <MenuItem key={priority} value={priority}>
                    {priority}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Flexibility */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Flexibility</InputLabel>
              <Select
                value={options.flexibility}
                label="Flexibility"
                onChange={(e) => setOptions(prev => ({ ...prev, flexibility: e.target.value }))}
              >
                {flexibilityOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Status */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={options.status}
                label="Status"
                onChange={(e) => setOptions(prev => ({ ...prev, status: e.target.value }))}
              >
                {statusOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Location - Read Only */}
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="Location"
              value={options.location}
              InputProps={{ readOnly: true }}
              variant="filled"
              helperText="Auto-populated from selected client"
            />
          </Grid>

          {/* Zone - Read Only */}
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Zone"
              value={options.zone}
              InputProps={{ readOnly: true }}
              variant="filled"
              helperText="Auto-populated from selected client"
            />
          </Grid>

          {/* Optional Fields */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Notes"
              value={options.notes}
              onChange={(e) => setOptions(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any special instructions or requirements"
            />
          </Grid>

          {/* Checkboxes */}
          <Grid item xs={12}>
            <Box display="flex" gap={2} flexWrap="wrap">
              <Chip
                label="Andrea On-Site"
                color={options.andreaOnSite ? 'secondary' : 'default'}
                onClick={() => setOptions(prev => ({ ...prev, andreaOnSite: !prev.andreaOnSite }))}
                variant={options.andreaOnSite ? 'filled' : 'outlined'}
              />
              <Chip
                label="Weather Sensitive"
                color={options.weatherSensitive ? 'primary' : 'default'}
                onClick={() => setOptions(prev => ({ ...prev, weatherSensitive: !prev.weatherSensitive }))}
                variant={options.weatherSensitive ? 'filled' : 'outlined'}
              />
              <Chip
                label="Client Notified"
                color={options.clientNotified ? 'success' : 'default'}
                onClick={() => setOptions(prev => ({ ...prev, clientNotified: !prev.clientNotified }))}
                variant={options.clientNotified ? 'filled' : 'outlined'}
              />
            </Box>
          </Grid>

          {/* Generate Button */}
          <Grid item xs={12}>
            <Button
              variant="contained"
              onClick={generateTemplate}
              disabled={!options.clientId || !options.helperId || loading}
              fullWidth
              size="large"
            >
              {loading ? 'Generating...' : 'Generate Calendar Template'}
            </Button>
          </Grid>
        </Grid>

        {/* Template Output */}
        {template && (
          <Box mt={4}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6">Generated Template</Typography>
              <Tooltip title={copySuccess ? 'Copied!' : 'Copy to clipboard'}>
                <IconButton onClick={copyToClipboard} color="primary">
                  <ContentCopy />
                </IconButton>
              </Tooltip>
            </Box>
            
            {copySuccess && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Template copied to clipboard! Paste it into Google Calendar.
              </Alert>
            )}

            <Paper elevation={1} sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography
                component="pre"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {template}
              </Typography>
            </Paper>

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>How to use:</strong> Copy the template above and paste it into Google Calendar. 
                Use the title for the event name, the description content for the event description, 
                and the location for the event location field.
              </Typography>
            </Alert>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default CalendarTemplateGenerator; 