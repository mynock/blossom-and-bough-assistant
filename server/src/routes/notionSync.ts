import { Router } from 'express';
import { NotionSyncService } from '../services/NotionSyncService';
import { AnthropicService } from '../services/AnthropicService';
import { debugLog } from '../utils/logger';

// Create a factory function that accepts the anthropicService
export function createNotionSyncRouter(anthropicService: AnthropicService) {
  const router = Router();
  const notionSyncService = new NotionSyncService(anthropicService);

  /**
   * POST /api/notion-sync/sync
   * Manually trigger a sync of Notion pages to work activities using AI parsing
   */
  router.post('/sync', async (req, res) => {
    try {
      debugLog.info('Manual Notion sync with AI parsing triggered via API');
      const stats = await notionSyncService.syncNotionPages();
      
      res.json({
        success: true,
        message: 'Notion sync completed with AI parsing',
        stats,
        warnings: stats.warnings && stats.warnings.length > 0 ? stats.warnings : undefined
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
      const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
      
      res.json({
        success: true,
        configured: hasNotionToken && hasNotionDatabase && hasAnthropicKey,
        hasNotionToken,
        hasNotionDatabase,
        hasAnthropicKey,
        databaseId: process.env.NOTION_DATABASE_ID ? 
          process.env.NOTION_DATABASE_ID.substring(0, 8) + '...' : null,
        aiParsingEnabled: hasAnthropicKey
      });
    } catch (error) {
      debugLog.error('Error getting sync status:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/notion-sync/stats
   * Get statistics about Notion imports
   */
  router.get('/stats', async (req, res) => {
    try {
      const stats = await notionSyncService.getImportStats();
      
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      debugLog.error('Error getting import stats:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting import statistics'
      });
    }
  });

  return router;
}

// For backward compatibility, export a default router (though this should be deprecated)
const anthropicService = new AnthropicService();
export default createNotionSyncRouter(anthropicService); 