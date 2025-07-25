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
import { CronService } from './services/CronService';
import { SchedulingRequest, TravelTimeRequest } from './types';
import workActivitiesRouter from './routes/workActivities';
import employeesRouter from './routes/employees';
import migrationRouter from './routes/migration';
import clientsRouter from './routes/clients';
import projectsRouter from './routes/projects';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import notionRouter from './routes/notion';
import quickbooksRouter from './routes/quickbooks';
import { createNotionSyncRouter } from './routes/notionSync';
import travelTimeRouter from './routes/travelTime';
import breakTimeRouter from './routes/breakTime';
import settingsRouter from './routes/settings';
import { requireAuth } from './middleware/auth';

// Load environment variables from root directory .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
      frameAncestors: ["'self'", "https://*.notion.so", "https://notion.so"],
    },
  },
  // Allow the page to be embedded in iframes from Notion
  frameguard: false // Disable X-Frame-Options to allow embedding
}));
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.FRONTEND_URL || 'http://localhost:3000',
      // Production domain
      'https://crm.blossomandbough.com',
      // Notion domains for embedding
      'https://notion.so',
      'https://www.notion.so',
    ];
    
    // Allow any notion.so subdomain
    if (origin.match(/^https:\/\/.*\.notion\.so$/)) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: true, // Changed to true for debugging
  name: 'garden-care-session', // Custom session name
  cookie: {
    secure: false, // Always false for localhost
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Lax for localhost development
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
const cronService = new CronService();
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
app.use('/api/travel-time', requireAuth, travelTimeRouter);
app.use('/api/break-time', requireAuth, breakTimeRouter);
app.use('/api/migration', requireAuth, migrationRouter);
app.use('/api/settings', settingsRouter); // Settings routes handle their own auth
app.use('/api/notion', notionRouter); // Public routes for embedded usage
app.use('/api/notion-sync', requireAuth, createNotionSyncRouter(anthropicService)); // Notion sync routes
app.use('/api/admin', adminRouter); // Admin routes handle their own auth
app.use('/api/qbo', quickbooksRouter); // QuickBooks Online routes

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

// Maintenance entry cron job endpoint (for Railway cron service + manual testing)
app.post('/api/cron/maintenance-entries', async (req, res) => {
  try {
    // Check authentication - either Railway cron token or user auth
    const cronToken = req.headers.authorization?.replace('Bearer ', '');
    const isRailwayCron = cronToken === process.env.CRON_AUTH_TOKEN;
    const hasUserAuth = req.user; // From passport/session
    
    if (!isRailwayCron && !hasUserAuth) {
      return res.status(401).json({ 
        error: 'Unauthorized - requires CRON_AUTH_TOKEN or user authentication' 
      });
    }
    
    const triggerSource = isRailwayCron ? 'Railway cron service' : 'manual user trigger';
    console.log(`🧪 Maintenance entry creation triggered by: ${triggerSource}`);
    
    // Check for date parameter in request body
    const { date } = req.body;
    
    if (date) {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({
          error: 'Invalid date format. Use YYYY-MM-DD format.'
        });
      }
      
      console.log(`📅 Running maintenance entry creation for specific date: ${date}`);
      await cronService.runManualTest(date);
    } else {
      await cronService.runManualTest();
    }
    
    res.json({ 
      success: true, 
      message: date ? 
        `Maintenance entry creation job executed successfully for ${date}` : 
        'Maintenance entry creation job executed successfully',
      timestamp: new Date().toISOString(),
      triggeredBy: triggerSource,
      targetDate: date || 'tomorrow'
    });
  } catch (error) {
    console.error('Error in maintenance entry trigger:', error);
    res.status(500).json({
      error: 'Failed to create maintenance entries',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Notion sync cron job endpoint (for Railway cron service + manual testing)
app.post('/api/cron/notion-sync', async (req, res) => {
  try {
    // Check authentication - either Railway cron token or user auth
    const cronToken = req.headers.authorization?.replace('Bearer ', '');
    const isRailwayCron = cronToken === process.env.CRON_AUTH_TOKEN;
    const hasUserAuth = req.user; // From passport/session
    
    if (!isRailwayCron && !hasUserAuth) {
      return res.status(401).json({ 
        error: 'Unauthorized - requires CRON_AUTH_TOKEN or user authentication' 
      });
    }
    
    const triggerSource = isRailwayCron ? 'Railway cron service' : 'manual user trigger';
    console.log(`🔄 Notion sync triggered by: ${triggerSource}`);
    
    // Create NotionSyncService instance for the cron endpoint
    const { NotionSyncService } = await import('./services/NotionSyncService');
    const notionSyncService = new NotionSyncService(anthropicService);
    
    // Run the sync (don't force sync for automated runs)
    const stats = await notionSyncService.syncNotionPages();
    
    res.json({ 
      success: true, 
      message: 'Notion sync completed successfully',
      timestamp: new Date().toISOString(),
      triggeredBy: triggerSource,
      stats
    });
  } catch (error) {
    console.error('Error in Notion sync trigger:', error);
    res.status(500).json({
      error: 'Failed to sync Notion pages',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cron job management endpoints
app.get('/api/cron/status', requireAuth, (req, res) => {
  try {
    const jobs = cronService.getCronJobsStatus();
    res.json({
      success: true,
      jobs
    });
  } catch (error) {
    console.error('Error getting cron status:', error);
    res.status(500).json({
      error: 'Failed to get cron job status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/cron/toggle/:jobId', requireAuth, (req, res) => {
  try {
    const { jobId } = req.params;
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'enabled field must be a boolean'
      });
    }
    
    const success = cronService.toggleCronJob(jobId, enabled);
    
    if (!success) {
      return res.status(404).json({
        error: 'Cron job not found'
      });
    }
    
    res.json({
      success: true,
      message: `Cron job ${jobId} ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    console.error('Error toggling cron job:', error);
    res.status(500).json({
      error: 'Failed to toggle cron job',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Special handling for embed routes - set headers to allow embedding and prevent caching
app.use('/notion-embed', (req, res, next) => {
  // Remove X-Frame-Options to allow embedding in Notion
  res.removeHeader('X-Frame-Options');
  
  // Set headers to allow embedding with iOS-specific optimizations
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "script-src 'self' 'unsafe-inline'; " + // Allow inline scripts for iOS compatibility
    "img-src 'self' data: https:; " +
    "connect-src 'self'; " +
    "font-src 'self'; " +
    "frame-ancestors 'self' https://*.notion.so https://notion.so;"
  );
  
  // iOS-specific headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Cache busting headers to prevent Notion from caching the embed
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Last-Modified', new Date().toUTCString());
  res.setHeader('ETag', `"${Date.now()}"`);
  
  // iOS Safari specific headers
  res.setHeader('Vary', 'User-Agent');
  
  next();
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
  
  // Start internal cron scheduling
  cronService.startScheduledTasks();
}); 