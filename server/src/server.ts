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
  const startTime = Date.now();
  console.log('\n🎯 === CHAT ENDPOINT START ===');
  
  try {
    const { query } = req.body as SchedulingRequest;
    
    if (!query) {
      console.log('❌ Chat request missing query');
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`📝 Chat query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
    console.log(`📊 Query length: ${query.length} characters`);

    // Set up timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Request timeout - AI processing took too long'));
      }, 55000); // 55 second timeout (less than frontend's 60s)
    });

    // Race between the AI response and timeout
    const responsePromise = schedulingService.getSchedulingRecommendation(query);
    
    const response = await Promise.race([responsePromise, timeoutPromise]);
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ === CHAT ENDPOINT SUCCESS === Total time: ${totalTime}ms`);
    console.log(`📤 Response length: ${JSON.stringify(response).length} characters\n`);
    
    res.json(response);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ === CHAT ENDPOINT ERROR === Time: ${totalTime}ms`);
    console.error('🔥 Chat error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3).join('\n') : undefined
    });
    
    // Send appropriate error response
    if (error instanceof Error && error.message.includes('timeout')) {
      console.error('⏰ Request timed out - likely due to slow tool execution');
      res.status(408).json({ 
        error: 'Request timed out. The AI is taking too long to process your request. Please try a simpler query or try again later.',
        timeout: true
      });
    } else if (error instanceof Error && error.name === 'RateLimitError') {
      console.error('🚫 Rate limit hit');
      res.status(429).json({ 
        error: 'Rate limit exceeded. Please wait a moment before trying again.',
        rateLimited: true
      });
    } else {
      console.error('💥 General chat processing error');
      res.status(500).json({ 
        error: 'Failed to process scheduling request. Please try again or contact support if the issue persists.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    console.log(''); // Add spacing after error
  }
});

// Test endpoint to show system prompt
app.get('/api/debug/system-prompt', async (req, res) => {
  try {
    const context = await schedulingService.getSchedulingContext();
    
    // Query parameters
    const showType = req.query.type as string; // 'condensed', 'full', or 'both' (default)
    const showFullContent = req.query.fullContent === 'true'; // Show full content without truncation
    
    // Get both condensed and full prompts using public methods
    const condensedPrompt = anthropicService.getCondensedSystemPrompt(context);
    const fullPrompt = anthropicService.getFullSystemPrompt(context);
    const currentPrompt = anthropicService.getCurrentSystemPrompt(context);
    
    const response: any = {
      meta: {
        showType: showType || 'both',
        showFullContent: showFullContent,
        timestamp: new Date().toISOString()
      },
      current: {
        type: condensedPrompt === currentPrompt ? 'condensed' : 'full',
        length: currentPrompt.length,
        estimatedTokens: Math.round(currentPrompt.length / 4),
        content: currentPrompt
      },
      tokenSavings: {
        characters: fullPrompt.length - condensedPrompt.length,
        estimatedTokens: Math.round((fullPrompt.length - condensedPrompt.length) / 4),
        percentReduction: Math.round(((fullPrompt.length - condensedPrompt.length) / fullPrompt.length) * 100)
      }
    };

    // Add condensed prompt if requested
    if (!showType || showType === 'both' || showType === 'condensed') {
      response.condensed = {
        length: condensedPrompt.length,
        estimatedTokens: Math.round(condensedPrompt.length / 4),
        content: condensedPrompt
      };
    }

    // Add full prompt if requested
    if (!showType || showType === 'both' || showType === 'full') {
      response.full = {
        length: fullPrompt.length,
        estimatedTokens: Math.round(fullPrompt.length / 4),
        content: showFullContent ? fullPrompt : fullPrompt.substring(0, 1000) + '...[truncated for display]'
      };
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error getting system prompt:', error);
    res.status(500).json({ 
      error: 'Failed to get system prompt',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
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