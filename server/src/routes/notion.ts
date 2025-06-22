import { Request, Response, Router } from 'express';
import { NotionService, CreateSmartEntryRequest } from '../services/NotionService';
import { debugLog } from '../utils/logger';

const router = Router();
const notionService = new NotionService();

// POST /api/notion/create-smart-entry
router.post('/create-smart-entry', async (req: Request, res: Response) => {
  try {
    const { client_name } = req.body as CreateSmartEntryRequest;
    
    if (!client_name) {
      debugLog.warn('Create smart entry request missing client_name');
      return res.status(400).json({ error: 'client_name required' });
    }

    debugLog.info(`Creating smart entry request for client: ${client_name}`);
    
    const result = await notionService.createSmartEntry(client_name);
    
    if (result.success) {
      debugLog.info(`Successfully created smart entry for ${client_name}`);
    } else {
      debugLog.error(`Failed to create smart entry for ${client_name}: ${result.error}`);
    }
    
    res.json(result);
  } catch (error) {
    debugLog.error('Error in create-smart-entry endpoint:', error);
    res.status(500).json({ 
      success: false,
      page_url: '',
      carryover_tasks: [],
      error: 'Internal server error'
    });
  }
});

// GET /api/notion/clients - Get client list for Notion integration (public endpoint)
router.get('/clients', async (req: Request, res: Response) => {
  try {
    // Import here to avoid circular dependencies
    const { ClientService } = await import('../services/ClientService');
    const clientService = new ClientService();
    
    const clients = await clientService.getAllClients();
    
    // Return only the data needed for the dropdown
    const clientList = clients.map(client => ({
      id: client.id,
      name: client.name,
      clientId: client.clientId
    }));
    
    res.json({ clients: clientList });
  } catch (error) {
    debugLog.error('Error fetching clients for Notion:', error);
    res.status(500).json({ 
      error: 'Failed to fetch clients'
    });
  }
});

// GET /api/notion/health - Health check for Notion integration
router.get('/health', async (req: Request, res: Response) => {
  try {
    const hasToken = !!process.env.NOTION_TOKEN;
    const hasDatabaseId = !!process.env.NOTION_DATABASE_ID;
    
    res.json({
      status: 'OK',
      notion_token_configured: hasToken,
      notion_database_configured: hasDatabaseId,
      ready: hasToken && hasDatabaseId
    });
  } catch (error) {
    debugLog.error('Error in notion health check:', error);
    res.status(500).json({ 
      status: 'ERROR',
      error: 'Health check failed'
    });
  }
});

// GET /api/notion/templates - Get available templates for the database
router.get('/templates', async (req: Request, res: Response) => {
  try {
    debugLog.info('Templates endpoint called');
    
    const result = await notionService.getAvailableTemplates();
    
    if (result.success) {
      debugLog.info('Successfully retrieved template information');
      res.json(result);
    } else {
      debugLog.error('Failed to retrieve template information:', result.error);
      res.status(500).json(result);
    }
  } catch (error) {
    debugLog.error('Error in templates endpoint:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      database: null,
      template_pages: [],
      configured_template_id: process.env.NOTION_TEMPLATE_ID,
    });
  }
});

export default router; 