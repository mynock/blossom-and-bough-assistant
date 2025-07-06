import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Box,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  Divider,
  Grid,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Snackbar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  AttachMoney,
  ExpandMore,
  Save,
  RestoreOutlined,
  Business,
  Home,
  Security,
  Notifications,
  Schedule,
  Refresh,
} from '@mui/icons-material';
import { apiClient } from '../config/api';

interface Setting {
  id: number;
  key: string;
  value: string;
  description?: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

interface SettingsByCategory {
  [key: string]: Setting[];
}

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsByCategory>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['billing', 'general']);

  // Form state for billing settings
  const [billingSettings, setBillingSettings] = useState({
    roundBillableHours: false,
    roundingMethod: 'up' as 'up' | 'down' | 'nearest',
    defaultHourlyRate: 50,
  });

  // Form state for general settings
  const [generalSettings, setGeneralSettings] = useState({
    appName: 'Garden Care CRM',
  });

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/settings');
      const data = await response.json();
      
      if (data.success) {
        // Group settings by category
        const groupedSettings: SettingsByCategory = {};
        data.settings.forEach((setting: Setting) => {
          if (!groupedSettings[setting.category]) {
            groupedSettings[setting.category] = [];
          }
          groupedSettings[setting.category].push(setting);
        });
        
        setSettings(groupedSettings);
        
        // Update form state from fetched settings
        updateFormStateFromSettings(data.settings);
      } else {
        setError(data.error || 'Failed to fetch settings');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setError('Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const updateFormStateFromSettings = (settingsList: Setting[]) => {
    const settingsMap = settingsList.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);

    // Update billing settings
    setBillingSettings({
      roundBillableHours: settingsMap.billable_hours_rounding === 'true',
      roundingMethod: (settingsMap.billable_hours_rounding_method || 'up') as 'up' | 'down' | 'nearest',
      defaultHourlyRate: parseFloat(settingsMap.default_hourly_rate || '50'),
    });

    // Update general settings
    setGeneralSettings({
      appName: settingsMap.app_name || 'Garden Care CRM',
    });
  };

  const saveSetting = async (key: string, value: string, category: string, description?: string) => {
    try {
      const response = await apiClient.post('/api/settings', {
        key,
        value,
        category,
        description,
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save setting');
      }
      
      return data.setting;
    } catch (error) {
      console.error(`Error saving setting ${key}:`, error);
      throw error;
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      
      // Save billing settings
      await Promise.all([
        saveSetting(
          'billable_hours_rounding',
          billingSettings.roundBillableHours.toString(),
          'billing',
          'Whether to round billable hours to the nearest half hour'
        ),
        saveSetting(
          'billable_hours_rounding_method',
          billingSettings.roundingMethod,
          'billing',
          'How to round billable hours: "up", "down", or "nearest"'
        ),
        saveSetting(
          'default_hourly_rate',
          billingSettings.defaultHourlyRate.toString(),
          'billing',
          'Default hourly rate for new work activities'
        ),
        saveSetting(
          'app_name',
          generalSettings.appName,
          'general',
          'Application name displayed in the UI'
        ),
      ]);

      showSnackbar('Settings saved successfully!');
      await fetchSettings(); // Refresh settings
    } catch (error) {
      console.error('Error saving settings:', error);
      showSnackbar('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const initializeDefaults = async () => {
    try {
      setSaving(true);
      const response = await apiClient.post('/api/settings/initialize');
      const data = await response.json();
      
      if (data.success) {
        showSnackbar('Default settings initialized successfully!');
        await fetchSettings();
      } else {
        throw new Error(data.error || 'Failed to initialize default settings');
      }
    } catch (error) {
      console.error('Error initializing default settings:', error);
      showSnackbar('Failed to initialize default settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryToggle = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'billing': return <AttachMoney />;
      case 'general': return <Home />;
      case 'security': return <Security />;
      case 'notifications': return <Notifications />;
      case 'schedule': return <Schedule />;
      default: return <SettingsIcon />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'billing': return 'primary';
      case 'general': return 'secondary';
      case 'security': return 'error';
      case 'notifications': return 'info';
      case 'schedule': return 'warning';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading settings...
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon /> Settings & Configuration
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Manage your application preferences and configuration options
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Action Buttons */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        <Button
          variant="outlined"
          startIcon={<RestoreOutlined />}
          onClick={initializeDefaults}
          disabled={saving}
        >
          Initialize Defaults
        </Button>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchSettings}
          disabled={saving}
        >
          Refresh
        </Button>
      </Box>

      {/* Settings Categories */}
      <Grid container spacing={3}>
        {/* Billing Settings */}
        <Grid item xs={12}>
          <Accordion 
            expanded={expandedCategories.includes('billing')}
            onChange={() => handleCategoryToggle('billing')}
          >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AttachMoney color="primary" />
                <Typography variant="h6">Billing & Pricing</Typography>
                <Chip label="billing" size="small" color="primary" />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Billable Hours Rounding
                      </Typography>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={billingSettings.roundBillableHours}
                            onChange={(e) => setBillingSettings(prev => ({
                              ...prev,
                              roundBillableHours: e.target.checked
                            }))}
                          />
                        }
                        label="Round billable hours to nearest half hour"
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        When enabled, billable hours will be automatically rounded to the nearest 0.5 hour increment.
                      </Typography>

                      {billingSettings.roundBillableHours && (
                        <Box sx={{ mt: 2 }}>
                          <FormControl fullWidth>
                            <InputLabel>Rounding Method</InputLabel>
                            <Select
                              value={billingSettings.roundingMethod}
                              label="Rounding Method"
                              onChange={(e) => setBillingSettings(prev => ({
                                ...prev,
                                roundingMethod: e.target.value as 'up' | 'down' | 'nearest'
                              }))}
                            >
                              <MenuItem value="up">Round Up (Always favor client)</MenuItem>
                              <MenuItem value="down">Round Down (Always favor business)</MenuItem>
                              <MenuItem value="nearest">Round to Nearest (Most accurate)</MenuItem>
                            </Select>
                          </FormControl>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Default Rates
                      </Typography>
                      <TextField
                        fullWidth
                        type="number"
                        label="Default Hourly Rate"
                        value={billingSettings.defaultHourlyRate}
                        onChange={(e) => setBillingSettings(prev => ({
                          ...prev,
                          defaultHourlyRate: parseFloat(e.target.value) || 0
                        }))}
                        InputProps={{
                          startAdornment: <Typography>$</Typography>,
                        }}
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        This rate will be used as the default for new work activities.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* General Settings */}
        <Grid item xs={12}>
          <Accordion 
            expanded={expandedCategories.includes('general')}
            onChange={() => handleCategoryToggle('general')}
          >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Home color="secondary" />
                <Typography variant="h6">General</Typography>
                <Chip label="general" size="small" color="secondary" />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Application Settings
                      </Typography>
                      <TextField
                        fullWidth
                        label="Application Name"
                        value={generalSettings.appName}
                        onChange={(e) => setGeneralSettings(prev => ({
                          ...prev,
                          appName: e.target.value
                        }))}
                        sx={{ mb: 2 }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        This name will be displayed in the navigation and other UI elements.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Current Settings Display */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Settings Overview
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              {Object.entries(settings).map(([category, categorySettings]) => (
                <Box key={category} sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    {getCategoryIcon(category)}
                    <Typography variant="subtitle1" fontWeight="bold">
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </Typography>
                    <Chip 
                      label={`${categorySettings.length} settings`} 
                      size="small" 
                      color={getCategoryColor(category) as any}
                    />
                  </Box>
                  
                  <List dense>
                    {categorySettings.map((setting) => (
                      <ListItem key={setting.key} divider>
                        <ListItemText
                          primary={setting.key}
                          secondary={setting.description || 'No description'}
                        />
                        <Box sx={{ textAlign: 'right', minWidth: 100 }}>
                          <Typography variant="body2" fontWeight="bold">
                            {setting.value}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(setting.updatedAt).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        message={snackbar.message}
      />
    </Container>
  );
};

export default Settings; 