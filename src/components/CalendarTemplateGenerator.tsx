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

interface TemplateOptions {
  clientId: string;
  helperId: string;
  serviceType: string;
  clientName: string;
  helperName: string;
  hours: string;
  rate: string;
  priority: string;
  location: string;
  zone: string;
  projectId?: string;
  projectName?: string;
  gateCode?: string;
  materials?: string;
  weatherSensitive: boolean;
  clientNotified: boolean;
  notes: string;
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
    hours: '4.0',
    rate: '$75/hour',
    priority: 'Medium',
    location: '',
    zone: '',
    gateCode: '',
    materials: '',
    weatherSensitive: false,
    clientNotified: false,
    notes: '',
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
        rate: `$${helper.hourlyRate}/hour`,
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
            rate: options.rate,
            priority: options.priority,
            location: options.location,
            zone: options.zone,
            projectId: options.projectId,
            projectName: options.projectName,
            gateCode: options.gateCode,
            materials: options.materials,
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
    const title = `${options.clientName} - ${options.serviceType} - ${options.helperName}`;
    
    const description = `CLIENT: ${options.clientName} (${options.clientId})
HELPER: ${options.helperName} (${options.helperId})
SERVICE: ${options.serviceType}
HOURS: ${options.hours}
RATE: ${options.rate}
PRIORITY: ${options.priority}

LOCATION: ${options.location}
ZONE: ${options.zone}
${options.projectId ? `PROJECT: ${options.projectName || '[Project Name]'} (${options.projectId})` : ''}

${options.gateCode ? `GATE CODE: ${options.gateCode}` : ''}
${options.materials ? `MATERIALS: ${options.materials}` : ''}
WEATHER SENSITIVE: ${options.weatherSensitive ? 'Yes' : 'No'}
CLIENT NOTIFIED: ${options.clientNotified ? 'Yes' : 'No'}

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
  const zones = ['Southwest', 'Southeast', 'Northeast', 'Northwest', 'Downtown', 'Lake Oswego', 'Portland Metro'];

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
                    {helper.name} ({helper.id}) - ${helper.hourlyRate}/hr
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

          {/* Location */}
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="Location"
              value={options.location}
              onChange={(e) => setOptions(prev => ({ ...prev, location: e.target.value }))}
            />
          </Grid>

          {/* Zone */}
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Zone</InputLabel>
              <Select
                value={options.zone}
                label="Zone"
                onChange={(e) => setOptions(prev => ({ ...prev, zone: e.target.value }))}
              >
                {zones.map((zone) => (
                  <MenuItem key={zone} value={zone}>
                    {zone}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Optional Fields */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Gate Code (optional)"
              value={options.gateCode}
              onChange={(e) => setOptions(prev => ({ ...prev, gateCode: e.target.value }))}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Materials (optional)"
              value={options.materials}
              onChange={(e) => setOptions(prev => ({ ...prev, materials: e.target.value }))}
              placeholder="Plants, mulch, tools"
            />
          </Grid>

          {/* Notes */}
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