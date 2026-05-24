import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import session from 'express-session';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';

// Explicit type imports to help Railway's TypeScript compiler
import type { CorsOptions } from 'cors';
import type { Options as MorganOptions } from 'morgan';

import { AuthService } from './services/AuthService';
import { CronService } from './services/CronService';
import { services } from './services/container';
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
import reportsRouter from './routes/reports';
// SECURITY: naturalLanguageSQL route disabled — see docs/plans/01-security-hardening.md §1.1.
// LLM-generated SQL was executed via db.execute(sql.raw()) with full-privilege Postgres
// credentials; any authenticated user could craft DROP/UPDATE statements. Re-enable only
// after a read-only role, SQL parser allowlist, statement timeout, and audit log are in place.
// import naturalLanguageSQLRouter from './routes/naturalLanguageSQL';
import dataExportRouter from './routes/dataExport';
import { requireAuth } from './middleware/auth';

// Load environment variables from root directory .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// SECURITY: fail-closed env validation — see docs/plans/01-security-hardening.md §1.2.
// In production, missing auth secrets must crash the process, never silently bypass.
if (process.env.NODE_ENV === 'production') {
  const requiredAuthEnv = ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'SESSION_SECRET', 'CSRF_SECRET'];
  const missing = requiredAuthEnv.filter(name => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required auth env vars in production: ${missing.join(', ')}`);
  }
}

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
  // SECURITY: deny framing by default — see docs/plans/01-security-hardening.md §1.5.
  // The /notion-embed handler below removes X-Frame-Options on its own paths so Notion can embed.
  frameguard: { action: 'deny' }
}));
// SECURITY: removed the `^https://.*\.notion\.so$` wildcard — see §1.5. With wildcard +
// credentials:true, any Notion-hosted page could ride a logged-in admin's session.
// The exact Notion origins below remain for any direct (non-iframe) calls; the embed iframe
// itself is same-origin (served by our /notion-embed route) and doesn't need CORS at all.
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://crm.blossomandbough.com',
      'https://notion.so',
      'https://www.notion.so',
    ];

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// SECURITY: respect X-Forwarded-Proto so cookie.secure works behind a load balancer.
app.set('trust proxy', 1);

// Session configuration
const sessionSecret = process.env.SESSION_SECRET
  || (process.env.NODE_ENV !== 'production' ? 'dev-only-session-secret-not-for-production' : undefined);
if (!sessionSecret) {
  throw new Error('SESSION_SECRET is required');
}
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: 'garden-care-session',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

app.use(morgan('combined'));
app.use(express.json());
app.use(cookieParser());

// SECURITY: CSRF protection (double-submit cookie via csrf-csrf) — see §1.5.
// State-changing requests under cookie-authenticated routes require an X-CSRF-Token header.
// Skipped for: public Notion-embed APIs, OAuth flow, bearer-token endpoints, health check.
const csrfSecret = process.env.CSRF_SECRET
  || (process.env.NODE_ENV !== 'production' ? 'dev-only-csrf-secret-not-for-production' : undefined);
if (!csrfSecret) {
  throw new Error('CSRF_SECRET is required');
}
const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => csrfSecret,
  getSessionIdentifier: (req) => req.sessionID || 'anonymous',
  cookieName: process.env.NODE_ENV === 'production' ? '__Host-bb.x-csrf-token' : 'bb.x-csrf-token',
  cookieOptions: {
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    path: '/',
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'] as string | undefined,
  skipCsrfProtection: (req) => {
    const p = req.path;
    return (
      p === '/api/health' ||
      p === '/api/csrf-token' ||
      p.startsWith('/api/auth/') ||
      p.startsWith('/api/notion/') ||
      p.startsWith('/api/cron/') ||
      p.startsWith('/api/data-export')
    );
  },
});
app.use(doubleCsrfProtection);

// Initialize services from container
const schedulingService = services.schedulingService;
const anthropicService = services.anthropicService;
const authService = new AuthService();
const cronService = new CronService();

// Mount authentication routes (before other routes)
app.use('/api/auth', authRouter);

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// SECURITY: CSRF token endpoint — frontend calls this on load and resends as X-CSRF-Token.
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
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
app.use('/api/reports', requireAuth, reportsRouter); // Reports routes
app.use('/api/notion', notionRouter); // Public routes for embedded usage
app.use('/api/notion-sync', requireAuth, createNotionSyncRouter(anthropicService)); // Notion sync routes
app.use('/api/admin', adminRouter); // Admin routes handle their own auth
app.use('/api/data-export', dataExportRouter); // Uses its own bearer token auth
app.use('/api/qbo', quickbooksRouter); // QuickBooks Online routes
// app.use('/api/natural-language-sql', naturalLanguageSQLRouter); // DISABLED — see §1.1 above
app.use('/api/natural-language-sql', (_req, res) =>
  res.status(503).json({ error: 'Natural language SQL endpoint is disabled pending security review.' })
);

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
    
    const systemPrompt = services.anthropicService.buildSystemPrompt(context);
    
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
    services.anthropicService.setSchedulingService(schedulingService);

    // Make the API call and capture detailed response info
    try {
      const result = await services.anthropicService.getSchedulingRecommendation(query, context);
      
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

    const travelInfo = await services.travelTimeService.calculateTravelTime(origin, destination);
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
    const settings = await services.googleSheetsService.getBusinessSettings();
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

    const template = services.googleCalendarService.generateEventTemplate(
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
  
  // SECURITY: see docs/plans/01-security-hardening.md §1.4 — inline scripts removed from embed CSP.
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "script-src 'self'; " +
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
app.use((err: Error & { statusCode?: number; status?: number; code?: string }, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // SECURITY: forward http-errors (e.g., CSRF 403) instead of masking them as 500 — see §1.5.
  const status = err.statusCode || err.status;
  if (status && status >= 400 && status < 500) {
    return res.status(status).json({
      error: err.message || 'Request rejected',
      code: err.code,
    });
  }
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