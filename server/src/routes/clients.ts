import { Router } from 'express';
import { ClientService } from '../services/ClientService';
import { ClientNotesService } from '../services/ClientNotesService';
import { WorkActivityService } from '../services/WorkActivityService';
import { SchedulingService } from '../services/SchedulingService';
import { GoogleSheetsService } from '../services/GoogleSheetsService';
import { GoogleCalendarService } from '../services/GoogleCalendarService';
import { AnthropicService } from '../services/AnthropicService';
import { TravelTimeService } from '../services/TravelTimeService';

const router = Router();
const clientService = new ClientService();
const clientNotesService = new ClientNotesService();
const workActivityService = new WorkActivityService();

// Initialize scheduling service for calendar integration
const googleSheetsService = new GoogleSheetsService();
const googleCalendarService = new GoogleCalendarService();
const anthropicService = new AnthropicService();
const travelTimeService = new TravelTimeService();
const schedulingService = new SchedulingService(
  googleSheetsService,
  googleCalendarService,
  anthropicService,
  travelTimeService
);

// GET /api/clients - Get all clients with work activity statistics
router.get('/', async (req, res) => {
  try {
    const clients = await clientService.getAllClientsWithStats();
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

// GET /api/clients/:id/upcoming-schedule - Get upcoming calendar events for a client
router.get('/:id/upcoming-schedule', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const client = await clientService.getClientById(id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const daysAhead = parseInt(req.query.days as string) || 30; // Default to 30 days
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + daysAhead);

    // Get all calendar events in the date range
    const allEvents = await schedulingService.getCalendarEventsInRange(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    // Filter events for this client (match by client name or ID)
    const clientEvents = allEvents.filter(event => {
      if (!event || !event.title) return false;
      
      const eventTitle = event.title.toLowerCase();
      const clientName = client.name.toLowerCase();
      
      // Check if client name appears in event title
      if (eventTitle.includes(clientName)) return true;
      
      // Check if client ID appears in event description
      if (event.description && event.description.includes(client.clientId)) return true;
      
      // Check linkedRecords if available
      if (event.linkedRecords?.clientId === client.clientId) return true;
      
      return false;
    });

    // Sort events by date
    clientEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    res.json({ 
      upcomingEvents: clientEvents,
      client: {
        id: client.id,
        name: client.name,
        clientId: client.clientId
      },
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        daysAhead
      }
    });
  } catch (error) {
    console.error('Error fetching client upcoming schedule:', error);
    res.status(500).json({ error: 'Failed to fetch client upcoming schedule' });
  }
});

// GET /api/clients/:id/notes - Get all notes for a client
router.get('/:id/notes', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const notes = await clientNotesService.getNotesByClientId(id);
    res.json({ notes });
  } catch (error) {
    console.error('Error fetching client notes:', error);
    res.status(500).json({ error: 'Failed to fetch client notes' });
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

// POST /api/clients/:id/notes - Create a new note for a client
router.post('/:id/notes', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const { noteType, title, content, date } = req.body;
    
    if (!noteType || !title || !content) {
      return res.status(400).json({ error: 'noteType, title, and content are required' });
    }

    const newNote = await clientNotesService.createNote({
      clientId: id,
      noteType,
      title,
      content,
      date: date || new Date().toISOString().split('T')[0]
    });

    res.status(201).json(newNote);
  } catch (error) {
    console.error('Error creating client note:', error);
    res.status(500).json({ error: 'Failed to create client note' });
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

// PUT /api/clients/:clientId/notes/:noteId - Update a note
router.put('/:clientId/notes/:noteId', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const noteId = parseInt(req.params.noteId);
    
    if (isNaN(clientId) || isNaN(noteId)) {
      return res.status(400).json({ error: 'Invalid client ID or note ID' });
    }

    const { noteType, title, content, date } = req.body;
    
    const updatedNote = await clientNotesService.updateNote(noteId, {
      noteType,
      title,
      content,
      date
    });

    if (!updatedNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json(updatedNote);
  } catch (error) {
    console.error('Error updating client note:', error);
    res.status(500).json({ error: 'Failed to update client note' });
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

// DELETE /api/clients/:clientId/notes/:noteId - Delete a note
router.delete('/:clientId/notes/:noteId', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const noteId = parseInt(req.params.noteId);
    
    if (isNaN(clientId) || isNaN(noteId)) {
      return res.status(400).json({ error: 'Invalid client ID or note ID' });
    }

    const success = await clientNotesService.deleteNote(noteId);
    
    if (!success) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting client note:', error);
    res.status(500).json({ error: 'Failed to delete client note' });
  }
});

export default router; 