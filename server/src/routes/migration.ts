import express from 'express';
import { DataMigrationService } from '../services/DataMigrationService';

const router = express.Router();
const migrationService = new DataMigrationService();

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

export default router; 