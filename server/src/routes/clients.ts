import { Router } from 'express';
import { ClientService } from '../services/ClientService';

const router = Router();
const clientService = new ClientService();

// GET /api/clients - Get all clients
router.get('/', async (req, res) => {
  try {
    const clients = await clientService.getAllClients();
    res.json(clients); // Return array directly, not wrapped in object
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