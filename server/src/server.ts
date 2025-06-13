import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { SchedulingService } from './services/SchedulingService';
import { GoogleSheetsService } from './services/GoogleSheetsService';
import { GoogleCalendarService } from './services/GoogleCalendarService';
import { AnthropicService } from './services/AnthropicService';
import { TravelTimeService } from './services/TravelTimeService';
import { SchedulingRequest, TravelTimeRequest } from './types';

// Load environment variables from root directory .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Initialize services
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

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get all helpers
app.get('/api/helpers', async (req, res) => {
  try {
    const helpers = await schedulingService.getHelpers();
    res.json({ helpers });
  } catch (error) {
    console.error('Error fetching helpers:', error);
    res.status(500).json({ error: 'Failed to fetch helpers' });
  }
});

// Get all clients
app.get('/api/clients', async (req, res) => {
  try {
    const clients = await schedulingService.getClients();
    res.json({ clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Get calendar events
app.get('/api/calendar', async (req, res) => {
  try {
    const daysAhead = parseInt(req.query.days as string) || 7;
    const events = await schedulingService.getCalendarEvents(daysAhead);
    res.json({ events });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// Get projects
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await schedulingService.getProjects();
    res.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Chat endpoint for AI scheduling assistance
app.post('/api/chat', async (req, res) => {
  try {
    const { query } = req.body as SchedulingRequest;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const response = await schedulingService.getSchedulingRecommendation(query);
    res.json(response);
  } catch (error) {
    console.error('Error processing chat request:', error);
    res.status(500).json({ error: 'Failed to process scheduling request' });
  }
});

// Calculate travel time between two addresses
app.post('/api/travel-time', async (req, res) => {
  try {
    const { origin, destination } = req.body as TravelTimeRequest;
    
    if (!origin || !destination) {
      return res.status(400).json({ error: 'Both origin and destination are required' });
    }

    const travelInfo = await travelTimeService.calculateTravelTime(origin, destination);
    res.json(travelInfo);
  } catch (error) {
    console.error('Error calculating travel time:', error);
    res.status(500).json({ error: 'Failed to calculate travel time' });
  }
});

// Get scheduling context (all data needed for AI)
app.get('/api/context', async (req, res) => {
  try {
    const context = await schedulingService.getSchedulingContext();
    res.json(context);
  } catch (error) {
    console.error('Error fetching scheduling context:', error);
    res.status(500).json({ error: 'Failed to fetch scheduling context' });
  }
});

// Schedule optimization
app.post('/api/schedule-optimization', async (req, res) => {
  try {
    const { requestType, constraints, preferences } = req.body;
    
    const result = await schedulingService.optimizeSchedule(
      requestType,
      constraints,
      preferences
    );
    
    res.json(result);
  } catch (error) {
    console.error('Schedule optimization error:', error);
    res.status(500).json({
      error: 'Schedule optimization failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Business settings
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await googleSheetsService.getBusinessSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching business settings:', error);
    res.status(500).json({
      error: 'Failed to fetch business settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate calendar event template
app.post('/api/calendar/template', async (req, res) => {
  try {
    const { clientId, helperId, serviceType, options } = req.body;
    
    if (!clientId || !helperId || !serviceType) {
      return res.status(400).json({ 
        error: 'clientId, helperId, and serviceType are required' 
      });
    }

    const template = googleCalendarService.generateEventTemplate(
      clientId, 
      helperId, 
      serviceType, 
      options || {}
    );
    
    res.json({ template });
  } catch (error) {
    console.error('Error generating calendar template:', error);
    res.status(500).json({
      error: 'Failed to generate calendar template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📁 Reading environment variables from: ${path.resolve(__dirname, '../../.env')}`);
}); 