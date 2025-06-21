import { Router } from 'express';
import { ClientService } from '../services/ClientService';
import { WorkActivityService } from '../services/WorkActivityService';

const router = Router();
const clientService = new ClientService();
const workActivityService = new WorkActivityService();

// GET /api/clients - Get all clients
router.get('/', async (req, res) => {
  try {
    const clients = await clientService.getAllClients();
    res.json({ clients }); // Wrap in object for consistency with other endpoints
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// GET /api/clients/:id - Get client by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const client = await clientService.getClientById(id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// GET /api/clients/:id/work-activities - Get work activities for a client
router.get('/:id/work-activities', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const activities = await workActivityService.getWorkActivitiesByClientId(id);
    
    // Calculate summary statistics
    const summary = {
      totalActivities: activities.length,
      totalHours: activities.reduce((sum, a) => sum + a.totalHours, 0),
      totalBillableHours: activities.reduce((sum, a) => sum + (a.billableHours || 0), 0),
      totalCharges: activities.reduce((sum, a) => sum + a.totalCharges, 0),
      statusBreakdown: activities.reduce((acc, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      workTypeBreakdown: activities.reduce((acc, a) => {
        acc[a.workType] = (acc[a.workType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      lastActivityDate: activities.length > 0 ? activities[0].date : null,
      yearToDateHours: activities
        .filter(a => {
          const activityYear = new Date(a.date).getFullYear();
          const currentYear = new Date().getFullYear();
          return activityYear === currentYear;
        })
        .reduce((sum, a) => sum + a.totalHours, 0)
    };
    
    res.json({ activities, summary });
  } catch (error) {
    console.error('Error fetching client work activities:', error);
    res.status(500).json({ error: 'Failed to fetch client work activities' });
  }
});

// POST /api/clients - Create new client
router.post('/', async (req, res) => {
  try {
    const clientData = req.body;
    
    // Generate clientId if not provided
    if (!clientData.clientId) {
      const timestamp = Date.now().toString().slice(-6);
      clientData.clientId = `CLT${timestamp}`;
    }

    const newClient = await clientService.createClient(clientData);
    res.status(201).json(newClient);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// PUT /api/clients/:id - Update client
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const clientData = req.body;
    const updatedClient = await clientService.updateClient(id, clientData);
    
    if (!updatedClient) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(updatedClient);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// DELETE /api/clients/:id - Delete client
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const success = await clientService.deleteClient(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.status(204).send(); // No content response for successful delete
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

export default router; 