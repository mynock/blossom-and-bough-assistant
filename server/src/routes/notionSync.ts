import { Router } from 'express';
import { NotionSyncService } from '../services/NotionSyncService';
import { AnthropicService } from '../services/AnthropicService';
import { services } from '../services/container';
import { debugLog } from '../utils/logger';

// Create a factory function that accepts the anthropicService
export function createNotionSyncRouter(anthropicService: AnthropicService) {
  const router = Router();
  const notionSyncService = new NotionSyncService(anthropicService);

  /**
   * POST /api/notion-sync/sync
   * Manually trigger a sync of Notion pages to work activities using AI parsing
   * Body params:
   *   - forceSync (boolean): Optional. If true, bypasses timestamp checks and syncs all pages
   */
  router.post('/sync', async (req, res) => {
    try {
      const { forceSync = false } = req.body;
      
      debugLog.info(`Manual Notion sync with AI parsing triggered via API${forceSync ? ' (FORCE SYNC)' : ''}`);
      const stats = await notionSyncService.syncNotionPages(undefined, undefined, forceSync);
      
      res.json({
        success: true,
        message: `Notion sync completed with AI parsing${forceSync ? ' (forced all pages)' : ''}`,
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
   * POST /api/notion-sync/sync-page/:pageId
   * Sync a specific Notion page by ID
   * Body params:
   *   - forceSync (boolean): Optional. If true, bypasses timestamp checks
   */
  router.post('/sync-page/:pageId', async (req, res) => {
    try {
      const { pageId } = req.params;
      const { forceSync = false } = req.body;
      
      if (!pageId) {
        return res.status(400).json({
          success: false,
          error: 'Page ID is required'
        });
      }

      debugLog.info(`Manual sync of specific Notion page ${pageId} triggered via API${forceSync ? ' (FORCE SYNC)' : ''}`);
      const stats = await notionSyncService.syncSpecificNotionPage(pageId, undefined, forceSync);
      
      res.json({
        success: true,
        message: `Notion page sync completed${forceSync ? ' (forced)' : ''}`,
        stats,
        warnings: stats.warnings && stats.warnings.length > 0 ? stats.warnings : undefined
      });
    } catch (error) {
      debugLog.error(`Error during sync of Notion page ${req.params.pageId}:`, error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during page sync'
      });
    }
  });

  /**
   * GET /api/notion-sync/sync-page-stream/:pageId
   * Sync a specific Notion page with real-time progress updates via Server-Sent Events
   * Query params:
   *   - forceSync (boolean): Optional. If true, bypasses timestamp checks
   */
  router.get('/sync-page-stream/:pageId', async (req, res) => {
    const { pageId } = req.params;
    const forceSync = req.query.forceSync === 'true';
    
    if (!pageId) {
      return res.status(400).json({
        success: false,
        error: 'Page ID is required'
      });
    }

    // Set up Server-Sent Events headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Function to send SSE data
    const sendEvent = (eventType: string, data: any) => {
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      debugLog.info(`Manual sync of specific Notion page ${pageId} with progress streaming triggered via API${forceSync ? ' (FORCE SYNC)' : ''}`);
      
      // Send initial event
      sendEvent('start', { message: `Starting sync for page ${pageId}${forceSync ? ' (force sync enabled)' : ''}...` });

      const stats = await notionSyncService.syncSpecificNotionPage(pageId, (message: string) => {
        // Send progress update via SSE
        sendEvent('progress', { message });
      }, forceSync);
      
      // Send completion event
      sendEvent('complete', {
        success: true,
        message: `Notion page sync completed${forceSync ? ' (forced)' : ''}`,
        stats,
        warnings: stats.warnings && stats.warnings.length > 0 ? stats.warnings : undefined
      });

      res.end();
    } catch (error) {
      debugLog.error(`Error during sync of Notion page ${pageId} with streaming:`, error);
      
      // Send error event
      sendEvent('error', {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during page sync'
      });

      res.end();
    }
  });

  /**
   * GET /api/notion-sync/sync-stream
   * Manually trigger a sync with real-time progress updates via Server-Sent Events
   * Query params:
   *   - forceSync (boolean): Optional. If true, bypasses timestamp checks and syncs all pages
   */
  router.get('/sync-stream', async (req, res) => {
    const forceSync = req.query.forceSync === 'true';
    // Set up Server-Sent Events headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Create AbortController for cancellation
    const abortController = new AbortController();
    
    // Function to send SSE data
    const sendEvent = (eventType: string, data: any) => {
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Handle client disconnect
    req.on('close', () => {
      debugLog.info('Client disconnected, aborting sync');
      abortController.abort();
    });

    // Handle client abort
    req.on('aborted', () => {
      debugLog.info('Client aborted request, aborting sync');
      abortController.abort();
    });

    try {
      debugLog.info(`Manual Notion sync with progress streaming triggered via API${forceSync ? ' (FORCE SYNC)' : ''}`);
      
      // Send initial event
      sendEvent('start', { message: `Starting Notion sync${forceSync ? ' (force sync enabled)' : ''}...` });

      const stats = await notionSyncService.syncNotionPages(
        (current, total, message, incrementalStats) => {
          // Send progress update via SSE with incremental stats
          sendEvent('progress', {
            current,
            total,
            message,
            percentage: Math.round((current / total) * 100),
            stats: incrementalStats // Include running totals
          });
        },
        abortController.signal, // Pass abort signal
        forceSync // Pass force sync flag
      );
      
      // Send completion event
      sendEvent('complete', {
        success: true,
        message: `Notion sync completed with AI parsing${forceSync ? ' (forced all pages)' : ''}`,
        stats,
        warnings: stats.warnings && stats.warnings.length > 0 ? stats.warnings : undefined
      });

      res.end();
    } catch (error) {
      debugLog.error('Error during manual Notion sync with streaming:', error);
      
      // Check if it was cancelled
      if (error instanceof Error && error.message.includes('cancelled')) {
        sendEvent('cancelled', {
          success: false,
          message: error.message
        });
      } else {
        // Send error event
        sendEvent('error', {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error during sync'
        });
      }

      res.end();
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

  /**
   * POST /api/notion-sync/cancel
   * Cancel an ongoing sync operation (placeholder for future implementation)
   */
  router.post('/cancel', async (req, res) => {
    try {
      // Note: This is a placeholder. In a production system, you'd want to:
      // 1. Store active sync operations with IDs
      // 2. Allow clients to cancel specific operations
      // 3. Handle cleanup properly
      
      res.json({
        success: true,
        message: 'Cancel request received. Sync will stop at next checkpoint.'
      });
    } catch (error) {
      debugLog.error('Error handling cancel request:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during cancel'
      });
    }
  });

  return router;
}

// For backward compatibility, export a default router using service container
export default createNotionSyncRouter(services.anthropicService); 