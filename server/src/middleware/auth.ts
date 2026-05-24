import { Request, Response, NextFunction } from 'express';
import { User } from '../services/AuthService';
import { debugLog } from '../utils/logger';

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
  // Development auth bypass (only in development mode)
  if (process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true') {
    debugLog.debug('Development auth bypass enabled - creating mock user');
    // Create a mock user for development
    req.user = {
      id: 'dev-user-123',
      email: 'dev@example.com',
      name: 'Development User',
      picture: undefined
    };
    return next();
  }
  
  // SECURITY: fail closed — see docs/plans/01-security-hardening.md §1.2.
  // The previous silent next() on missing OAuth env vars meant one typo during deploy
  // exposed every protected route.
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    debugLog.error('Authentication unavailable - OAuth not configured');
    return res.status(503).json({
      error: 'Authentication unavailable',
      message: 'OAuth is not configured on this server.'
    });
  }

  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  
  // For API requests, return JSON error
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    });
  }
  
  // For web requests, redirect to login
  res.redirect('/api/auth/google');
};

/**
 * Middleware to check authentication but allow anonymous access
 * Adds user info to request if available
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  // User info will be available in req.user if authenticated
  next();
};

/**
 * Middleware to ensure user is logged out
 */
export const requireGuest = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect('/');
  }
  
  next();
};

/**
 * Get current user from request
 */
export const getCurrentUser = (req: Request): User | null => {
  return req.user || null;
};

/**
 * Check if current user has access to admin features
 * For now, all authenticated users are admins
 */
export const isAdmin = (req: Request): boolean => {
  // Check if user exists (handles both auth bypass and normal auth)
  return !!req.user || (req.isAuthenticated && req.isAuthenticated());
}; 