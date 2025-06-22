import { Router } from 'express';
import passport from 'passport';
import { requireAuth, requireGuest, getCurrentUser } from '../middleware/auth';
import { debugLog } from '../utils/logger';

const router = Router();

/**
 * GET /api/auth/google
 * Initiate Google OAuth login
 */
router.get('/google', (req, res, next) => {
  debugLog.debug('Initiating Google OAuth login', { sessionId: req.sessionID });
  
  // Check if OAuth is configured
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    debugLog.warn('OAuth credentials not configured');
    return res.status(500).json({
      error: 'Authentication not configured',
      message: 'Google OAuth credentials are not configured. Please set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET environment variables.'
    });
  }
  
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })(req, res, next);
});

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback', (req, res, next) => {
  debugLog.debug('Google OAuth callback received', { sessionId: req.sessionID });
  
  // Check if OAuth is configured
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    debugLog.warn('OAuth not configured, redirecting to login with error');
    const isDevelopment = process.env.NODE_ENV === 'development';
    const loginUrl = isDevelopment ? 'http://localhost:3000/login?error=oauth_not_configured' : '/login?error=oauth_not_configured';
    return res.redirect(loginUrl);
  }
  const isDevelopment = process.env.NODE_ENV === 'development';
  const failureRedirect = isDevelopment ? 'http://localhost:3000/login?error=auth_failed' : '/login?error=auth_failed';
  
  passport.authenticate('google', { 
    failureRedirect: failureRedirect,
    failureMessage: true
  })(req, res, (err: any) => {
    if (err) {
      debugLog.error('Passport authentication error', { error: err.message, stack: err.stack });
      
      // Determine the specific error type for better user feedback
      let errorType = 'auth_failed';
      if (err.message && err.message.includes('not authorized')) {
        errorType = 'email_not_authorized';
      }
      
      const errorRedirect = isDevelopment ? `http://localhost:3000/login?error=${errorType}` : `/login?error=${errorType}`;
      return res.redirect(errorRedirect);
    }
    next();
  });
}, (req, res) => {
  // Successful authentication
  debugLog.info('User authentication successful', { email: req.user?.email });
  
  // Environment-aware redirect URL
  const isDevelopment = process.env.NODE_ENV === 'development';
  const redirectUrl = isDevelopment ? 'http://localhost:3000/' : '/';
  
  // Redirect to appropriate URL based on environment
  res.redirect(redirectUrl);
});

/**
 * POST /api/auth/logout
 * Logout current user
 */
router.post('/logout', requireAuth, (req, res) => {
  const userEmail = req.user?.email;
  
  req.logout((err) => {
    if (err) {
      debugLog.error('Logout error', { error: err.message, userEmail });
      return res.status(500).json({ error: 'Logout failed' });
    }
    
    debugLog.info('User logged out', { email: userEmail });
    res.json({ message: 'Logged out successfully' });
  });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', (req, res) => {
  // Development auth bypass (only in development mode)
  if (process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true') {
    debugLog.debug('Development auth bypass enabled for /me endpoint');
    const mockUser = {
      id: 'dev-user-123',
      email: 'dev@example.com',
      name: 'Development User',
      picture: undefined
    };
    return res.json({
      authenticated: true,
      user: mockUser
    });
  }
  
  const user = getCurrentUser(req);
  
  if (!user) {
    return res.status(401).json({ 
      authenticated: false,
      user: null 
    });
  }
  res.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture
    }
  });
});

/**
 * GET /api/auth/status
 * Check authentication status
 */
router.get('/status', (req, res) => {
  const isAuthenticated = req.isAuthenticated && req.isAuthenticated();
  const user = getCurrentUser(req);
  
  // Development auth bypass (only in development mode)
  if (process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true') {
    debugLog.debug('Development auth bypass enabled for status check');
    const mockUser = {
      id: 'dev-user-123',
      email: 'dev@example.com',
      name: 'Development User',
      picture: undefined
    };
    return res.json({
      authenticated: true,
      user: mockUser
    });
  }
  
  res.json({
    authenticated: isAuthenticated,
    user: user ? {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture
    } : null
  });
});

/**
 * GET /api/auth/test-session
 * Test session functionality
 */
router.get('/test-session', (req, res) => {
  // Set a test value in session
  const session = req.session as any;
  if (!session.testValue) {
    session.testValue = 'session-working-' + Date.now();
  }
  
  res.json({
    message: 'Session test',
    sessionId: req.sessionID,
    testValue: session.testValue,
    sessionData: req.session
  });
});

/**
 * GET /api/auth/test
 * Simple test route to verify auth routes are working
 */
router.get('/test', (req, res) => {
  res.json({ message: 'Auth routes are working!', sessionId: req.sessionID });
});

export default router; 