import { Router } from 'express';
import passport from 'passport';
import { requireAuth, requireGuest, getCurrentUser } from '../middleware/auth';

const router = Router();

/**
 * GET /api/auth/google
 * Initiate Google OAuth login
 */
router.get('/google', requireGuest, passport.authenticate('google', {
  scope: ['profile', 'email']
}));

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: '/login?error=auth_failed',
    failureMessage: true
  }),
  (req, res) => {
    // Successful authentication
    console.log(`✅ User logged in: ${req.user?.email}`);
    res.redirect('/');
  }
);

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