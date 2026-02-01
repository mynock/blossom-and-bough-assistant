import { Router } from 'express';
import { services } from '../services/container';
import { requireAuth } from '../middleware/auth';

const router = Router();
const settingsService = services.settingsService;

// Apply authentication to all routes
router.use(requireAuth);

/**
 * GET /api/settings
 * Get all settings
 */
router.get('/', async (req, res) => {
  try {
    const settings = await settingsService.getAllSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch settings' 
    });
  }
});

/**
 * GET /api/settings/category/:category
 * Get settings by category
 */
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const settings = await settingsService.getSettingsByCategory(category);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error fetching settings by category:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch settings' 
    });
  }
});

/**
 * GET /api/settings/:key
 * Get a specific setting by key
 */
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const setting = await settingsService.getSetting(key);
    
    if (!setting) {
      return res.status(404).json({ 
        success: false, 
        error: 'Setting not found' 
      });
    }

    res.json({ success: true, setting });
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch setting' 
    });
  }
});

/**
 * POST /api/settings
 * Create or update a setting
 */
router.post('/', async (req, res) => {
  try {
    const { key, value, description, category } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Key and value are required' 
      });
    }

    const setting = await settingsService.setSetting(
      key, 
      value, 
      description, 
      category || 'general'
    );

    res.json({ success: true, setting });
  } catch (error) {
    console.error('Error creating/updating setting:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save setting' 
    });
  }
});

/**
 * PUT /api/settings/:key
 * Update a specific setting
 */
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description, category } = req.body;

    if (value === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Value is required' 
      });
    }

    const setting = await settingsService.setSetting(
      key, 
      value, 
      description, 
      category
    );

    res.json({ success: true, setting });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update setting' 
    });
  }
});

/**
 * DELETE /api/settings/:key
 * Delete a setting
 */
router.delete('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const deleted = await settingsService.deleteSetting(key);

    if (!deleted) {
      return res.status(404).json({ 
        success: false, 
        error: 'Setting not found' 
      });
    }

    res.json({ success: true, message: 'Setting deleted successfully' });
  } catch (error) {
    console.error('Error deleting setting:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete setting' 
    });
  }
});

/**
 * POST /api/settings/initialize
 * Initialize default settings
 */
router.post('/initialize', async (req, res) => {
  try {
    await settingsService.initializeDefaultSettings();
    res.json({ 
      success: true, 
      message: 'Default settings initialized' 
    });
  } catch (error) {
    console.error('Error initializing default settings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to initialize default settings' 
    });
  }
});

/**
 * GET /api/settings/billing/config
 * Get billing configuration
 */
router.get('/billing/config', async (req, res) => {
  try {
    const billingSettings = await settingsService.getBillingSettings();
    res.json({ success: true, settings: billingSettings });
  } catch (error) {
    console.error('Error fetching billing settings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch billing settings' 
    });
  }
});

/**
 * POST /api/settings/billing/preview-rounding
 * Preview what would happen if we apply rounding to existing work activities
 */
router.post('/billing/preview-rounding', async (req, res) => {
  try {
    const result = await settingsService.previewRoundingForExistingWorkActivities();
    res.json(result);
  } catch (error) {
    console.error('Error previewing rounding for existing work activities:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to preview rounding for existing work activities' 
    });
  }
});

/**
 * POST /api/settings/billing/apply-rounding
 * Apply billable hours rounding to existing work activities
 */
router.post('/billing/apply-rounding', async (req, res) => {
  try {
    const result = await settingsService.applyRoundingToExistingWorkActivities();
    res.json(result);
  } catch (error) {
    console.error('Error applying rounding to existing work activities:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to apply rounding to existing work activities' 
    });
  }
});

export default router; 