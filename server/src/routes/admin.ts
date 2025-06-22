import express from 'express';
import { AdminService } from '../services/AdminService';
import { requireAuth, getCurrentUser } from '../middleware/auth';
import { debugLog } from '../utils/logger';

const router = express.Router();
const adminService = new AdminService();

// Middleware to check admin permissions
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = getCurrentUser(req);
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (!adminService.isUserAdmin(user)) {
    debugLog.warn('Unauthorized admin access attempt', { 
      userId: user.id, 
      email: user.email,
      path: req.path 
    });
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};

// All admin routes require authentication and admin permissions
router.use(requireAuth);
router.use(requireAdmin);

/**
 * Get database status
 */
router.get('/status', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    debugLog.info('Admin: Database status requested', { userId: user?.id });
    
    const status = await adminService.getDatabaseStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    debugLog.error('Admin: Error getting database status', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get database status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Clear work activities only
 */
router.post('/clear-work-activities', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    debugLog.info('Admin: Clear work activities requested', { userId: user?.id });
    
    const result = await adminService.clearWorkActivities();
    
    if (result.success) {
      res.json({ success: true, message: result.output, duration: result.duration });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to clear work activities',
        details: result.error,
        duration: result.duration 
      });
    }
  } catch (error) {
    debugLog.error('Admin: Error clearing work activities', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear work activities',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Clear projects and work data
 */
router.post('/clear-projects-and-work', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    debugLog.info('Admin: Clear projects and work data requested', { userId: user?.id });
    
    const result = await adminService.clearProjectsAndWorkData();
    
    if (result.success) {
      res.json({ success: true, message: result.output, duration: result.duration });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to clear projects and work data',
        details: result.error,
        duration: result.duration 
      });
    }
  } catch (error) {
    debugLog.error('Admin: Error clearing projects and work data', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear projects and work data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Clear all data
 */
router.post('/clear-all-data', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    debugLog.warn('Admin: Clear ALL data requested - DANGEROUS OPERATION', { userId: user?.id });
    
    const result = await adminService.clearAllData();
    
    if (result.success) {
      res.json({ success: true, message: result.output, duration: result.duration });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to clear all data',
        details: result.error,
        duration: result.duration 
      });
    }
  } catch (error) {
    debugLog.error('Admin: Error clearing all data', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear all data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Import employees
 */
router.post('/import-employees', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    debugLog.info('Admin: Import employees requested', { userId: user?.id });
    
    const result = await adminService.importEmployees();
    
    if (result.success) {
      res.json({ success: true, message: result.output, duration: result.duration });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to import employees',
        details: result.error,
        duration: result.duration 
      });
    }
  } catch (error) {
    debugLog.error('Admin: Error importing employees', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to import employees',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Import clients
 */
router.post('/import-clients', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    debugLog.info('Admin: Import clients requested', { userId: user?.id });
    
    const result = await adminService.importClients();
    
    if (result.success) {
      res.json({ success: true, message: result.output, duration: result.duration });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to import clients',
        details: result.error,
        duration: result.duration 
      });
    }
  } catch (error) {
    debugLog.error('Admin: Error importing clients', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to import clients',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Import all basic data (employees and clients)
 */
router.post('/import-all-basic', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    debugLog.info('Admin: Import all basic data requested', { userId: user?.id });
    
    const result = await adminService.importAllBasicData();
    
    if (result.success) {
      res.json({ success: true, message: result.output, duration: result.duration });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to import all basic data',
        details: result.error,
        duration: result.duration 
      });
    }
  } catch (error) {
    debugLog.error('Admin: Error importing all basic data', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to import all basic data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Run database migrations
 */
router.post('/run-migrations', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    debugLog.info('Admin: Run migrations requested', { userId: user?.id });
    
    const result = await adminService.runMigrations();
    
    if (result.success) {
      res.json({ success: true, message: result.output, duration: result.duration });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to run migrations',
        details: result.error,
        duration: result.duration 
      });
    }
  } catch (error) {
    debugLog.error('Admin: Error running migrations', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to run migrations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 