import React, { useState, useEffect, useCallback } from 'react';
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
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  AttachMoney,
  ExpandMore,
  Save,
  RestoreOutlined,
  Home,
  Security,
  Notifications,
  Schedule,
  Refresh,
  Preview,
  PlayArrow,
  InfoOutlined,
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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

  // Track changes to mark unsaved state
  const handleBillingSettingsChange = (newSettings: Partial<typeof billingSettings>) => {
    setBillingSettings(prev => ({ ...prev, ...newSettings }));
    setHasUnsavedChanges(true);
  };

  const handleGeneralSettingsChange = (newSettings: Partial<typeof generalSettings>) => {
    setGeneralSettings(prev => ({ ...prev, ...newSettings }));
    setHasUnsavedChanges(true);
  };

  // Rounding preview/apply state
  const [roundingPreview, setRoundingPreview] = useState<{
    totalActivities: number;
    activitiesAffected: number;
    activitiesUnchanged: number;
    previews: Array<{
      id: number;
      workType: string;
      date: string;
      currentHours: number;
      roundedHours: number;
      change: number;
    }>;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const fetchSettings = useCallback(async () => {
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
  }, []);

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

    // Reset unsaved changes flag since we just loaded from database
    setHasUnsavedChanges(false);
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
      setHasUnsavedChanges(false); // Reset unsaved changes flag
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

  const previewRoundingApplication = async () => {
    try {
      setPreviewLoading(true);
      const response = await apiClient.post('/api/settings/billing/preview-rounding');
      const data = await response.json();
      
      if (data.success) {
        setRoundingPreview(data);
        showSnackbar(`Preview complete: ${data.activitiesAffected} activities would be affected`, 'success');
      } else {
        throw new Error(data.error || 'Failed to preview rounding');
      }
    } catch (error) {
      console.error('Error previewing rounding:', error);
      showSnackbar('Failed to preview rounding changes', 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const applyRoundingToExisting = async () => {
    try {
      setApplyLoading(true);
      const response = await apiClient.post('/api/settings/billing/apply-rounding');
      const data = await response.json();
      
      if (data.success) {
        showSnackbar(`Successfully updated ${data.updatedActivities} work activities with rounded hours`, 'success');
        setRoundingPreview(null); // Clear preview since data has changed
      } else {
        throw new Error(data.error || 'Failed to apply rounding');
      }
    } catch (error) {
      console.error('Error applying rounding:', error);
      showSnackbar('Failed to apply rounding to existing activities', 'error');
    } finally {
      setApplyLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

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
          color={hasUnsavedChanges ? 'primary' : 'inherit'}
          sx={{
            ...(hasUnsavedChanges && {
              background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
                filter: 'brightness(1.1)',
              }
            })
          }}
        >
          {saving ? 'Saving...' : hasUnsavedChanges ? 'Save Settings*' : 'Save Settings'}
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
                            onChange={(e) => handleBillingSettingsChange({
                              roundBillableHours: e.target.checked
                            })}
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
                              onChange={(e) => handleBillingSettingsChange({
                                roundingMethod: e.target.value as 'up' | 'down' | 'nearest'
                              })}
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
                        onChange={(e) => handleBillingSettingsChange({
                          defaultHourlyRate: parseFloat(e.target.value) || 0
                        })}
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

                {/* Apply Rounding to Existing Activities */}
                {billingSettings.roundBillableHours && (
                  <Grid item xs={12}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <InfoOutlined color="info" />
                          Apply Rounding to Existing Work Activities
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Since you've enabled billable hours rounding, you can apply this rounding to existing work activities 
                          that were created before this setting was enabled.
                        </Typography>

                        {hasUnsavedChanges && (
                          <Alert severity="warning" sx={{ mb: 2 }}>
                            You have unsaved changes to your rounding settings. Please save your settings first before previewing or applying changes to existing activities.
                          </Alert>
                        )}

                        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                          <Button
                            variant="outlined"
                            startIcon={<Preview />}
                            onClick={previewRoundingApplication}
                            disabled={hasUnsavedChanges || previewLoading || applyLoading}
                          >
                            {previewLoading ? 'Previewing...' : 'Preview Changes'}
                          </Button>
                          <Button
                            variant="contained"
                            startIcon={<PlayArrow />}
                            onClick={applyRoundingToExisting}
                            disabled={hasUnsavedChanges || !roundingPreview || previewLoading || applyLoading}
                            color="primary"
                          >
                            {applyLoading ? 'Applying...' : 'Apply Rounding to Existing Activities'}
                          </Button>
                        </Box>

                        {roundingPreview && (
                          <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Preview Results:
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                              <Chip 
                                label={`${roundingPreview.totalActivities} Total Activities`} 
                                color="info" 
                                size="small" 
                              />
                              <Chip 
                                label={`${roundingPreview.activitiesAffected} Will Change`} 
                                color="warning" 
                                size="small" 
                              />
                              <Chip 
                                label={`${roundingPreview.activitiesUnchanged} Unchanged`} 
                                color="success" 
                                size="small" 
                              />
                            </Box>

                            {roundingPreview.previews.length > 0 && (
                              <Box sx={{ mt: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                  Activities that will be updated:
                                </Typography>
                                <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                                  <List dense>
                                    {roundingPreview.previews.slice(0, 10).map((preview) => (
                                      <ListItem key={preview.id} divider>
                                        <ListItemText
                                          primary={`${preview.workType} - ${preview.date}`}
                                          secondary={
                                            <span>
                                              {preview.currentHours.toFixed(2)}h → {preview.roundedHours.toFixed(2)}h 
                                              <span style={{ 
                                                color: preview.change > 0 ? 'green' : 'red',
                                                fontWeight: 'bold',
                                                marginLeft: 8
                                              }}>
                                                ({preview.change > 0 ? '+' : ''}{preview.change.toFixed(2)}h)
                                              </span>
                                            </span>
                                          }
                                        />
                                      </ListItem>
                                    ))}
                                    {roundingPreview.previews.length > 10 && (
                                      <ListItem>
                                        <ListItemText 
                                          primary={`... and ${roundingPreview.previews.length - 10} more activities`}
                                          sx={{ fontStyle: 'italic', color: 'text.secondary' }}
                                        />
                                      </ListItem>
                                    )}
                                  </List>
                                </Box>
                              </Box>
                            )}
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                )}
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
                        onChange={(e) => handleGeneralSettingsChange({
                          appName: e.target.value
                        })}
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