import { Router } from 'express';
import { services } from '../services/container';
import { asyncHandler } from '../middleware/asyncHandler';
import { calculateClientActivitySummary } from '../utils/activitySummary';

const router = Router();

// Access services through the container
const clientService = services.clientService;
const clientNotesService = services.clientNotesService;
const workActivityService = services.workActivityService;
const schedulingService = services.schedulingService;

// GET /api/clients - Get all clients with work activity statistics
router.get('/', asyncHandler(async (req, res) => {
  const clients = await clientService.getAllClientsWithStats();
  res.json({ clients }); // Wrap in object for consistency with other endpoints
}));

// GET /api/clients/:id - Get client by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }

  const client = await clientService.getClientById(id);
  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }

  res.json(client);
}));

// GET /api/clients/:id/work-activities - Get work activities for a client
router.get('/:id/work-activities', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }

  const activities = await workActivityService.getWorkActivitiesByClientId(id);
  const summary = calculateClientActivitySummary(activities);

  res.json({ activities, summary });
}));

// GET /api/clients/:id/upcoming-schedule - Get upcoming calendar events for a client
router.get('/:id/upcoming-schedule', asyncHandler(async (req, res) => {
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
}));

// GET /api/clients/:id/notes - Get all notes for a client
router.get('/:id/notes', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }

  const notes = await clientNotesService.getNotesByClientId(id);
  res.json({ notes });
}));

// POST /api/clients - Create new client
router.post('/', asyncHandler(async (req, res) => {
  const clientData = req.body;

  // Generate clientId if not provided
  if (!clientData.clientId) {
    const timestamp = Date.now().toString().slice(-6);
    clientData.clientId = `CLT${timestamp}`;
  }

  const newClient = await clientService.createClient(clientData);
  res.status(201).json(newClient);
}));

// POST /api/clients/:id/notes - Create a new note for a client
router.post('/:id/notes', asyncHandler(async (req, res) => {
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
}));

// PUT /api/clients/:id - Update client
router.put('/:id', asyncHandler(async (req, res) => {
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
}));

// PUT /api/clients/:clientId/notes/:noteId - Update a note
router.put('/:clientId/notes/:noteId', asyncHandler(async (req, res) => {
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
}));

// DELETE /api/clients/:id - Delete client
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }

  const success = await clientService.deleteClient(id);

  if (!success) {
    return res.status(404).json({ error: 'Client not found' });
  }

  res.status(204).send(); // No content response for successful delete
}));

// DELETE /api/clients/:clientId/notes/:noteId - Delete a note
router.delete('/:clientId/notes/:noteId', asyncHandler(async (req, res) => {
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
}));

export default router; 