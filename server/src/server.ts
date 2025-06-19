import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import session from 'express-session';
import passport from 'passport';

// Explicit type imports to help Railway's TypeScript compiler
import type { CorsOptions } from 'cors';
import type { Options as MorganOptions } from 'morgan';

import { SchedulingService } from './services/SchedulingService';
import { GoogleSheetsService } from './services/GoogleSheetsService';
import { GoogleCalendarService } from './services/GoogleCalendarService';
import { AnthropicService } from './services/AnthropicService';
import { TravelTimeService } from './services/TravelTimeService';
import { AuthService } from './services/AuthService';
import { SchedulingRequest, TravelTimeRequest } from './types';
import workActivitiesRouter from './routes/workActivities';
import employeesRouter from './routes/employees';
import migrationRouter from './routes/migration';
import clientsRouter from './routes/clients';
import projectsRouter from './routes/projects';
import authRouter from './routes/auth';
import { createWorkNotesImportRouter } from './routes/workNotesImport';
import { requireAuth } from './middleware/auth';

// Load environment variables from root directory .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || 'http://localhost:3001'
    : 'http://localhost:3001',
  credentials: true
}));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

app.use(morgan('combined'));
app.use(express.json());

// Initialize services
const googleSheetsService = new GoogleSheetsService();
const googleCalendarService = new GoogleCalendarService();
const anthropicService = new AnthropicService();
const travelTimeService = new TravelTimeService();
const authService = new AuthService();
const schedulingService = new SchedulingService(
  googleSheetsService,
  googleCalendarService,
  anthropicService,
  travelTimeService
);

// Mount authentication routes (before other routes)
app.use('/api/auth', authRouter);

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Protected API routes - require authentication
app.use('/api/work-activities', requireAuth, workActivitiesRouter);
app.use('/api/employees', requireAuth, employeesRouter);
app.use('/api/clients', requireAuth, clientsRouter);
app.use('/api/projects', requireAuth, projectsRouter);
app.use('/api/work-notes', requireAuth, createWorkNotesImportRouter(anthropicService));
app.use('/api/migration', requireAuth, migrationRouter);

// Get all helpers
app.get('/api/helpers', requireAuth, async (req, res) => {
  try {
    const helpers = await schedulingService.getHelpers();
    res.json({ helpers });
  } catch (error) {
    console.error('Error fetching helpers:', error);
    res.status(500).json({ error: 'Failed to fetch helpers' });
  }
});

// Get calendar events
app.get('/api/calendar', requireAuth, async (req, res) => {
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
app.post('/api/chat', requireAuth, async (req, res) => {
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

// Debug endpoints - protected
app.get('/api/debug/health', requireAuth, (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    anthropic_configured: !!process.env.ANTHROPIC_API_KEY
  });
});

// Debug endpoint for system prompt analysis
app.get('/api/debug/system-prompt', requireAuth, async (req, res) => {
  try {
    const { fullContent } = req.query;
    const context = await schedulingService.getSchedulingContext();
    
    const tempAnthropicService = new AnthropicService();
    const systemPrompt = tempAnthropicService.buildSystemPrompt(context);
    
    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    const estimateTokens = (text: string) => Math.round(text.length / 4);
    
    const result = {
      meta: {
        showType: 'current',
        showFullContent: fullContent === 'true',
        timestamp: new Date().toISOString()
      },
      current: {
        type: 'full',
        length: systemPrompt.length,
        estimatedTokens: estimateTokens(systemPrompt),
        content: fullContent === 'true' ? systemPrompt : 
                 systemPrompt.length > 1000 ? 
                 systemPrompt.substring(0, 1000) + '\n\n[truncated for display - enable fullContent to see complete prompt]' : 
                 systemPrompt
      },
      tokenSavings: {
        characters: 0,
        estimatedTokens: 0,
        percentReduction: 0
      }
    };
    
    res.json(result);
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ 
      error: 'Failed to generate debug information',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug endpoint for API response analysis
app.post('/api/debug/api-response', requireAuth, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    console.log('\n🔍 === DEBUG API RESPONSE ENDPOINT ===');
    console.log(`📝 Debug query: "${query}"`);
    
    const context = await schedulingService.getSchedulingContext();
    const tempAnthropicService = new AnthropicService();
    tempAnthropicService.setSchedulingService(schedulingService);
    
    // Make the API call and capture detailed response info
    try {
      const result = await tempAnthropicService.getSchedulingRecommendation(query, context);
      
      res.json({
        success: true,
        query: query,
        response: result,
        timestamp: new Date().toISOString(),
        note: 'Check server logs for detailed API response analysis'
      });
    } catch (error) {
      console.error('❌ Debug API call failed:', error);
      res.json({
        success: false,
        query: query,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        note: 'Check server logs for detailed error analysis'
      });
    }
    
  } catch (error) {
    console.error('Debug API response endpoint error:', error);
    res.status(500).json({ 
      error: 'Failed to debug API response',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Calculate travel time between two addresses
app.post('/api/travel-time', requireAuth, async (req, res) => {
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
app.get('/api/context', requireAuth, async (req, res) => {
  try {
    const context = await schedulingService.getSchedulingContext();
    res.json(context);
  } catch (error) {
    console.error('Error fetching scheduling context:', error);
    res.status(500).json({ error: 'Failed to fetch scheduling context' });
  }
});

// Schedule optimization
app.post('/api/schedule-optimization', requireAuth, async (req, res) => {
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
app.get('/api/settings', requireAuth, async (req, res) => {
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

// Serve React build files in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the React app build directory
  app.use(express.static(path.join(__dirname, '../../build')));
  
  // Handle React routing - send all non-API requests to React app
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(__dirname, '../../build/index.html'));
  });
}

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