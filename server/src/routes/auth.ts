import { Router } from 'express';
import passport from 'passport';
import { requireAuth, requireGuest, getCurrentUser } from '../middleware/auth';

const router = Router();

/**
 * GET /api/auth/google
 * Initiate Google OAuth login
 */
router.get('/google', requireGuest, (req, res, next) => {
  // Check if OAuth is configured
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
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
  // Check if OAuth is configured
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return res.redirect('/login?error=oauth_not_configured');
  }
  
  passport.authenticate('google', { 
    failureRedirect: '/login?error=auth_failed',
    failureMessage: true
  })(req, res, next);
}, (req, res) => {
  // Successful authentication
  console.log(`✅ User logged in: ${req.user?.email}`);
  res.redirect('/');
});

/**
 * POST /api/auth/logout
 * Logout current user
 */
router.post('/logout', requireAuth, (req, res) => {
  const userEmail = req.user?.email;
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
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

export default router; 