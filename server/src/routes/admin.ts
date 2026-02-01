import express from 'express';
import { ImportProgress, WorkActivityImportOptions } from '../services/AdminService';
import { services } from '../services/container';
import { requireAuth, getCurrentUser } from '../middleware/auth';
import { debugLog } from '../utils/logger';

// Store active import sessions for progress tracking
const activeImports = new Map<string, {
  progress: ImportProgress[];
  isComplete: boolean;
  result?: any;
}>();

const router = express.Router();
const adminService = services.adminService;

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

/**
 * Get available clients for work activity import
 */
router.get('/import-work-activities/clients', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    debugLog.info('Admin: Get available clients requested', { userId: user?.id });
    
    const result = await adminService.getAvailableClients();
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: result.output, 
        duration: result.duration,
        clients: result.clients 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get available clients',
        details: result.error,
        duration: result.duration 
      });
    }
  } catch (error) {
    debugLog.error('Admin: Error getting available clients', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get available clients',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Preview client data before import
 */
router.get('/import-work-activities/preview/:clientName', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    const { clientName } = req.params;
    
    debugLog.info('Admin: Preview client data requested', { userId: user?.id, clientName });
    
    const result = await adminService.previewClientData(clientName);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: result.output, 
        duration: result.duration,
        preview: result.preview 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to preview client data',
        details: result.error,
        duration: result.duration 
      });
    }
  } catch (error) {
    debugLog.error('Admin: Error previewing client data', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to preview client data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Start work activities import
 */
router.post('/import-work-activities', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    const options: WorkActivityImportOptions = req.body;
    
    debugLog.info('Admin: Work activities import requested', { userId: user?.id, options });
    
    // Generate unique session ID for progress tracking
    const sessionId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize progress tracking
    activeImports.set(sessionId, {
      progress: [],
      isComplete: false
    });
    
    // Start import in background
    (async () => {
      try {
        const result = await adminService.importWorkActivities(
          options,
          (progress: ImportProgress) => {
            const session = activeImports.get(sessionId);
            if (session) {
              session.progress.push(progress);
            }
          }
        );
        
        const session = activeImports.get(sessionId);
        if (session) {
          session.isComplete = true;
          session.result = result;
        }
        
        debugLog.info('Admin: Work activities import completed', { 
          userId: user?.id, 
          sessionId,
          success: result.success,
          duration: result.duration 
        });
        
      } catch (error) {
        const session = activeImports.get(sessionId);
        if (session) {
          session.isComplete = true;
          session.result = {
            success: false,
            message: 'Import failed',
            duration: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
        
        debugLog.error('Admin: Work activities import failed', { 
          userId: user?.id, 
          sessionId,
          error 
        });
      }
    })();
    
    // Return session ID for progress tracking
    res.json({ 
      success: true, 
      message: 'Import started',
      sessionId
    });
    
  } catch (error) {
    debugLog.error('Admin: Error starting work activities import', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to start import',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get import progress
 */
router.get('/import-work-activities/progress/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = activeImports.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Import session not found' 
      });
    }
    
    res.json({
      success: true,
      progress: session.progress,
      isComplete: session.isComplete,
      result: session.result
    });
    
    // Clean up completed sessions after some time
    if (session.isComplete && session.progress.length > 0) {
      const lastUpdate = session.progress[session.progress.length - 1];
      const timeSinceComplete = Date.now() - new Date().getTime();
      
      // Remove session after 5 minutes
      if (timeSinceComplete > 5 * 60 * 1000) {
        activeImports.delete(sessionId);
      }
    }
    
  } catch (error) {
    debugLog.error('Admin: Error getting import progress', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get import progress',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get Google authentication configuration status
 */
router.get('/google-auth-config', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    debugLog.info('Admin: Google auth config requested', { userId: user?.id });
    
    const { getGoogleAuthConfig } = await import('../utils/googleAuth');
    const config = getGoogleAuthConfig();
    
    res.json({ 
      success: true, 
      config: {
        hasEnvKey: config.hasEnvKey,
        hasKeyFile: config.hasKeyFile,
        keyFileExists: config.keyFileExists,
        keyFilePath: config.keyFilePath,
        // Don't expose the actual credentials
        authMethod: config.hasEnvKey ? 'environment_variable' : config.hasKeyFile ? 'key_file' : 'none'
      }
    });
  } catch (error) {
    debugLog.error('Admin: Error getting Google auth config', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get Google auth configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 