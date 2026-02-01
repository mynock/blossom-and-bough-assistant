import express from 'express';
import { services } from '../services/container';

const router = express.Router();
const migrationService = services.dataMigrationService;

/**
 * GET /api/migration/status
 * Get current migration status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await migrationService.getMigrationStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting migration status:', error);
    res.status(500).json({ error: 'Failed to get migration status' });
  }
});

/**
 * POST /api/migration/migrate
 * Run full data migration from Google Sheets
 */
router.post('/migrate', async (req, res) => {
  try {
    console.log('🚀 Starting data migration via API...');
    const result = await migrationService.migrateAllData();
    
    if (result.success) {
      res.json({
        message: 'Migration completed successfully',
        ...result
      });
    } else {
      res.status(400).json({
        message: 'Migration completed with errors',
        ...result
      });
    }
  } catch (error) {
    console.error('Error during migration:', error);
    res.status(500).json({ 
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/migration/clear
 * Clear all data from database
 */
router.post('/clear', async (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'DELETE_ALL_DATA') {
      return res.status(400).json({ 
        error: 'Confirmation required. Send { "confirm": "DELETE_ALL_DATA" } to proceed.' 
      });
    }

    await migrationService.clearAllData();
    res.json({ message: 'All data cleared successfully' });
  } catch (error) {
    console.error('Error clearing data:', error);
    res.status(500).json({ 
      error: 'Failed to clear data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/migration/employees
 * Migrate only employees from Google Sheets
 */
router.post('/employees', async (req, res) => {
  try {
    const result = await migrationService.migrateEmployees();
    res.json({
      message: 'Employee migration completed',
      imported: result.imported,
      errors: result.errors
    });
  } catch (error) {
    console.error('Error migrating employees:', error);
    res.status(500).json({ 
      error: 'Employee migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/migration/clients
 * Migrate only clients from Google Sheets
 */
router.post('/clients', async (req, res) => {
  try {
    const result = await migrationService.migrateClients();
    res.json({
      message: 'Client migration completed',
      imported: result.imported,
      errors: result.errors
    });
  } catch (error) {
    console.error('Error migrating clients:', error);
    res.status(500).json({ 
      error: 'Client migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/migration/seed-reset
 * Clear database and import fresh data from Google Sheets
 */
router.post('/seed-reset', async (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'RESET_AND_SEED') {
      return res.status(400).json({ 
        error: 'Confirmation required. Send { "confirm": "RESET_AND_SEED" } to proceed.',
        message: 'This will DELETE ALL existing data and replace it with fresh data from Google Sheets.'
      });
    }

    console.log('🔄 Starting database seed/reset operation...');
    
    // Step 1: Clear all existing data
    console.log('🗑️  Clearing existing data...');
    await migrationService.clearAllData();
    
    // Step 2: Import fresh data from Google Sheets
    console.log('📥 Importing fresh data from Google Sheets...');
    const result = await migrationService.migrateAllData();
    
    if (result.success) {
      res.json({
        message: 'Database successfully reset and seeded with fresh data from Google Sheets',
        operation: 'seed-reset',
        ...result,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        message: 'Database reset completed but data import had errors',
        operation: 'seed-reset',
        ...result,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error during seed/reset operation:', error);
    res.status(500).json({ 
      error: 'Seed/reset operation failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      message: 'Database may be in an inconsistent state. Check logs and consider manual recovery.'
    });
  }
});

/**
 * GET /api/migration/test-sheets
 * Test Google Sheets connectivity and show raw data
 */
router.get('/test-sheets', async (req, res) => {
  try {
    const sheetsService = services.googleSheetsService;

    console.log('🧪 Testing Google Sheets connectivity...');

    const [employees, clients] = await Promise.all([
      sheetsService.getHelpers(),
      sheetsService.getClients()
    ]);
    
    res.json({
      message: 'Google Sheets test completed',
      employees: employees.slice(0, 2), // Show first 2 employees
      clients: clients.slice(0, 2), // Show first 2 clients
      counts: {
        employees: employees.length,
        clients: clients.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error testing Google Sheets:', error);
    res.status(500).json({ 
      error: 'Google Sheets test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 