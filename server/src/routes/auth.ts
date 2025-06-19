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
  
  // Check if OAuth is configured
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    console.log('❌ [AUTH] OAuth credentials not configured');
    return res.status(500).json({
      error: 'Authentication not configured',
      message: 'Google OAuth credentials are not configured. Please set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET environment variables.'
    });
  }
  
  console.log('🔵 [AUTH] Redirecting to Google OAuth...');
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
  console.log('🟡 [AUTH] Session before auth:', JSON.stringify(req.session, null, 2));
  
  // Check if OAuth is configured
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    console.log('❌ [AUTH] OAuth not configured, redirecting to login with error');
    return res.redirect('/login?error=oauth_not_configured');
  }
  
  console.log('🟡 [AUTH] Attempting passport authentication...');
  passport.authenticate('google', { 
    failureRedirect: '/login?error=auth_failed',
    failureMessage: true
  })(req, res, (err: any) => {
    if (err) {
      console.error('❌ [AUTH] Passport authentication error:', err);
      console.error('❌ [AUTH] Error stack:', err.stack);
      return res.redirect('/login?error=auth_failed');
    }
    next();
  });
}, (req, res) => {
  // Successful authentication
  console.log('🟢 [AUTH] Authentication successful!');
  console.log('🟢 [AUTH] User:', req.user);
  console.log('🟢 [AUTH] Session after auth:', JSON.stringify(req.session, null, 2));
  console.log('🟢 [AUTH] isAuthenticated():', req.isAuthenticated?.());
  console.log(`✅ User logged in: ${req.user?.email}`);
  
  // Redirect to React app
  res.redirect('http://localhost:3000/');
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