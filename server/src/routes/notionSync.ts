import { Router } from 'express';
import { NotionSyncService } from '../services/NotionSyncService';
import { debugLog } from '../utils/logger';

const router = Router();
const notionSyncService = new NotionSyncService();

/**
 * POST /api/notion-sync/sync
 * Manually trigger a sync of Notion pages to work activities
 */
router.post('/sync', async (req, res) => {
  try {
    debugLog.info('Manual Notion sync triggered via API');
    const stats = await notionSyncService.syncNotionPages();
    
    res.json({
      success: true,
      message: 'Notion sync completed',
      stats
    });
  } catch (error) {
    debugLog.error('Error during manual Notion sync:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during sync'
    });
  }
});

/**
 * GET /api/notion-sync/status
 * Get sync service status and configuration
 */
router.get('/status', async (req, res) => {
  try {
    const hasNotionToken = !!process.env.NOTION_TOKEN;
    const hasNotionDatabase = !!process.env.NOTION_DATABASE_ID;
    
    res.json({
      success: true,
      configured: hasNotionToken && hasNotionDatabase,
      hasNotionToken,
      hasNotionDatabase,
      databaseId: process.env.NOTION_DATABASE_ID ? 
        process.env.NOTION_DATABASE_ID.substring(0, 8) + '...' : null
    });
  } catch (error) {
    debugLog.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 