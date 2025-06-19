import { Router } from 'express';
import passport from 'passport';
import { requireAuth, requireGuest, getCurrentUser } from '../middleware/auth';

const router = Router();

/**
 * GET /api/auth/google
 * Initiate Google OAuth login
 */
router.get('/google', (req, res, next) => {
  console.log('🔵 [AUTH] Initiating Google OAuth login');
  console.log('🔵 [AUTH] Session ID:', req.sessionID);
  console.log('🔵 [AUTH] Session data:', JSON.stringify(req.session, null, 2));
  console.log('🔵 [AUTH] Environment variables:');
  console.log('🔵 [AUTH]   NODE_ENV:', process.env.NODE_ENV);
  console.log('🔵 [AUTH]   GOOGLE_OAUTH_CLIENT_ID:', process.env.GOOGLE_OAUTH_CLIENT_ID?.substring(0, 20) + '...');
  console.log('🔵 [AUTH]   GOOGLE_OAUTH_CALLBACK_URL:', process.env.GOOGLE_OAUTH_CALLBACK_URL);
  
  // Check if OAuth is configured
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    console.log('❌ [AUTH] OAuth credentials not configured');
    return res.status(500).json({
      error: 'Authentication not configured',
      message: 'Google OAuth credentials are not configured. Please set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET environment variables.'
    });
  }
  
  console.log('🔵 [AUTH] Redirecting to Google OAuth...');
  
  // Intercept the redirect to log the URL
  const originalRedirect = res.redirect.bind(res);
  res.redirect = ((url: string | number, status?: string | number) => {
    if (typeof url === 'string') {
      console.log('🔵 [AUTH] Generated OAuth URL:', url);
    }
    return originalRedirect(url as any, status as any);
  }) as any;
  
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })(req, res, next);
});

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback', (req, res, next) => {
  console.log('🟡 [AUTH] Google OAuth callback received');
  console.log('🟡 [AUTH] Query params:', req.query);
  console.log('🟡 [AUTH] Session ID:', req.sessionID);
  
  // Check if OAuth is configured
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    console.log('❌ [AUTH] OAuth not configured, redirecting to login with error');
    const isDevelopment = process.env.NODE_ENV === 'development';
    const loginUrl = isDevelopment ? 'http://localhost:3000/login?error=oauth_not_configured' : '/login?error=oauth_not_configured';
    return res.redirect(loginUrl);
  }
  
  console.log('🟡 [AUTH] Attempting passport authentication...');
  const isDevelopment = process.env.NODE_ENV === 'development';
  const failureRedirect = isDevelopment ? 'http://localhost:3000/login?error=auth_failed' : '/login?error=auth_failed';
  
  passport.authenticate('google', { 
    failureRedirect: failureRedirect,
    failureMessage: true
  })(req, res, (err: any) => {
    if (err) {
      console.error('❌ [AUTH] Passport authentication error:', err);
      console.error('❌ [AUTH] Error stack:', err.stack);
      
      // Determine the specific error type for better user feedback
      let errorType = 'auth_failed';
      if (err.message && err.message.includes('not authorized')) {
        errorType = 'email_not_authorized';
      }
      
      const errorRedirect = isDevelopment ? `http://localhost:3000/login?error=${errorType}` : `/login?error=${errorType}`;
      return res.redirect(errorRedirect);
    }
    console.log('🟡 [AUTH] No error in passport authenticate, proceeding to next...');
    next();
  });
}, (req, res) => {
  // Successful authentication
  console.log('🟢 [AUTH] Authentication successful!');
  console.log('🟢 [AUTH] User:', req.user);
  console.log('🟢 [AUTH] Session after auth:', JSON.stringify(req.session, null, 2));
  console.log('🟢 [AUTH] isAuthenticated():', req.isAuthenticated?.());
  console.log(`✅ User logged in: ${req.user?.email}`);
  
  // Environment-aware redirect URL
  const isDevelopment = process.env.NODE_ENV === 'development';
  const redirectUrl = isDevelopment ? 'http://localhost:3000/' : '/';
  
  console.log('🟢 [AUTH] Redirecting to:', redirectUrl);
  console.log('🟢 [AUTH] Environment:', process.env.NODE_ENV);
  
  // Redirect to appropriate URL based on environment
  res.redirect(redirectUrl);
});

/**
 * POST /api/auth/logout
 * Logout current user
 */
router.post('/logout', requireAuth, (req, res) => {
  const userEmail = req.user?.email;
  console.log('🔴 [AUTH] Logout requested for:', userEmail);
  
  req.logout((err) => {
    if (err) {
      console.error('❌ [AUTH] Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    
    console.log(`👋 User logged out: ${userEmail}`);
    res.json({ message: 'Logged out successfully' });
  });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', (req, res) => {
  console.log('🔍 [AUTH] /me endpoint called');
  console.log('🔍 [AUTH] Session ID:', req.sessionID);
  console.log('🔍 [AUTH] isAuthenticated():', req.isAuthenticated?.());
  console.log('🔍 [AUTH] req.user:', req.user);
  
  // Development auth bypass (only in development mode)
  if (process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true') {
    console.log('🟡 [AUTH] Development auth bypass enabled for /me endpoint');
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
    console.log('🔍 [AUTH] No authenticated user found');
    return res.status(401).json({ 
      authenticated: false,
      user: null 
    });
  }
  
  console.log('🔍 [AUTH] Authenticated user found:', user.email);
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
  
  console.log('🔍 [AUTH] Status check - Session ID:', req.sessionID);
  console.log('🔍 [AUTH] Status check - isAuthenticated():', isAuthenticated);
  console.log('🔍 [AUTH] Status check - req.user:', req.user);
  console.log('🔍 [AUTH] Status check - getCurrentUser():', user);
  
  // Development auth bypass (only in development mode)
  if (process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true') {
    console.log('🟡 [AUTH] Development auth bypass enabled for status check');
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
  console.log('🧪 [TEST] Session test endpoint called');
  console.log('🧪 [TEST] Session ID:', req.sessionID);
  console.log('🧪 [TEST] Session data:', JSON.stringify(req.session, null, 2));
  
  // Set a test value in session
  const session = req.session as any;
  if (!session.testValue) {
    session.testValue = 'session-working-' + Date.now();
    console.log('🧪 [TEST] Set test value:', session.testValue);
  } else {
    console.log('🧪 [TEST] Found existing test value:', session.testValue);
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
  console.log('🧪 [TEST] Auth test route hit!');
  console.log('🧪 [TEST] Session ID:', req.sessionID);
  res.json({ message: 'Auth routes are working!', sessionId: req.sessionID });
});

export default router; 