import { Request, Response, Router } from 'express';
import { CreateSmartEntryRequest } from '../services/NotionService';
import { services } from '../services/container';
import { debugLog } from '../utils/logger';

const router = Router();
const notionService = services.notionService;

// POST /api/notion/create-smart-entry
router.post('/create-smart-entry', async (req: Request, res: Response) => {
  try {
    // Set cache busting headers for API responses
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
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
    // Set cache busting headers for API responses
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const clients = await services.clientService.getAllClients();
    
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

export default router; 