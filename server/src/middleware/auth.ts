import { Request, Response, NextFunction } from 'express';
import { User } from '../services/AuthService';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Middleware to check if user is authenticated
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  console.log('🔒 [MIDDLEWARE] requireAuth called for:', req.path);
  console.log('🔒 [MIDDLEWARE] Session ID:', req.sessionID);
  console.log('🔒 [MIDDLEWARE] isAuthenticated():', req.isAuthenticated?.());
  console.log('🔒 [MIDDLEWARE] req.user:', req.user);
  
  // Development auth bypass (only in development mode)
  if (process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true') {
    console.log('🟡 [MIDDLEWARE] Development auth bypass enabled - creating mock user');
    // Create a mock user for development
    req.user = {
      id: 'dev-user-123',
      email: 'dev@example.com',
      name: 'Development User',
      picture: undefined
    };
    return next();
  }
  
  // Check if OAuth is configured
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    // If OAuth is not configured, allow access with a warning
    console.log('⚠️  Authentication bypassed - OAuth not configured');
    return next();
  }

  if (req.isAuthenticated && req.isAuthenticated()) {
    console.log('✅ [MIDDLEWARE] User is authenticated, proceeding');
    return next();
  }
  
  console.log('❌ [MIDDLEWARE] User not authenticated');
  
  // For API requests, return JSON error
  if (req.path.startsWith('/api/')) {
    console.log('❌ [MIDDLEWARE] Returning 401 for API request');
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    });
  }
  
  // For web requests, redirect to login
  console.log('❌ [MIDDLEWARE] Redirecting to OAuth login');
  res.redirect('/api/auth/google');
};

/**
 * Middleware to check authentication but allow anonymous access
 * Adds user info to request if available
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  console.log('🔓 [MIDDLEWARE] optionalAuth called for:', req.path);
  console.log('🔓 [MIDDLEWARE] isAuthenticated():', req.isAuthenticated?.());
  console.log('🔓 [MIDDLEWARE] req.user:', req.user);
  // User info will be available in req.user if authenticated
  next();
};

/**
 * Middleware to ensure user is logged out
 */
export const requireGuest = (req: Request, res: Response, next: NextFunction) => {
  console.log('👤 [MIDDLEWARE] requireGuest called for:', req.path);
  console.log('👤 [MIDDLEWARE] isAuthenticated():', req.isAuthenticated?.());
  
  if (req.isAuthenticated && req.isAuthenticated()) {
    console.log('👤 [MIDDLEWARE] User is authenticated, redirecting to home');
    return res.redirect('/');
  }
  
  console.log('👤 [MIDDLEWARE] User is guest, proceeding');
  next();
};

/**
 * Get current user from request
 */
export const getCurrentUser = (req: Request): User | null => {
  const user = req.user || null;
  console.log('👤 [MIDDLEWARE] getCurrentUser returning:', user);
  return user;
};

/**
 * Check if current user has access to admin features
 * For now, all authenticated users are admins
 */
export const isAdmin = (req: Request): boolean => {
  const isAuthenticated = req.isAuthenticated && req.isAuthenticated();
  console.log('👑 [MIDDLEWARE] isAdmin check:', isAuthenticated);
  return isAuthenticated;
}; 