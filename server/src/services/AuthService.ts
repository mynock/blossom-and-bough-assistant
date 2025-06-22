import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { debugLog } from '../utils/logger';

// Extend Express namespace for user types
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string;
      picture?: string;
    }
  }
}

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export class AuthService {
  private allowedEmails: Set<string>;

  constructor() {
    this.allowedEmails = this.parseAllowedEmails();
    this.initializePassport();
  }

  private parseAllowedEmails(): Set<string> {
    const allowlistEnv = process.env.AUTH_ALLOWLIST || '';
    const emails = allowlistEnv
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0);
    
    debugLog.info('Auth allowlist configured', { emailCount: emails.length });
    return new Set(emails);
  }

  private initializePassport(): void {
    // Check if OAuth credentials are configured
    if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
      debugLog.warn('Google OAuth credentials not configured - authentication disabled');
      return;
    }

    const callbackURL = process.env.GOOGLE_OAUTH_CALLBACK_URL || '/api/auth/google/callback';
    
    debugLog.info('Configuring Google OAuth Strategy', { 
      callbackURL, 
      environment: process.env.NODE_ENV 
    });

    // Configure Google OAuth strategy
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      callbackURL: callbackURL
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        debugLog.debug('Google OAuth strategy callback triggered', { profileId: profile.id });
        
        const email = profile.emails?.[0]?.value?.toLowerCase();
        
        if (!email) {
          debugLog.warn('No email found in Google profile');
          return done(new Error('No email found in Google profile'), undefined);
        }

        // Check if user is in allowlist
        if (!this.allowedEmails.has(email)) {
          debugLog.warn('Unauthorized login attempt', { email });
          return done(new Error(`Access denied. Email ${email} is not authorized.`), undefined);
        }

        const user: User = {
          id: profile.id,
          email: email,
          name: profile.displayName || 'Unknown User',
          picture: profile.photos?.[0]?.value
        };

        debugLog.info('Authorized login successful', { email });
        return done(null, user);
      } catch (error) {
        debugLog.error('Error in Google OAuth strategy', { error });
        return done(error, undefined);
      }
    }));

    // Serialize user for session
    passport.serializeUser((user: any, done) => {
      debugLog.debug('Serializing user for session', { email: user?.email });
      done(null, user);
    });

    // Deserialize user from session
    passport.deserializeUser((user: any, done) => {
      debugLog.debug('Deserializing user from session', { email: user?.email });
      done(null, user);
    });

    debugLog.info('Google OAuth authentication initialized');
  }

  public isEmailAllowed(email: string): boolean {
    return this.allowedEmails.has(email.toLowerCase());
  }

  public addAllowedEmail(email: string): void {
    this.allowedEmails.add(email.toLowerCase());
  }

  public removeAllowedEmail(email: string): void {
    this.allowedEmails.delete(email.toLowerCase());
  }

  public getAllowedEmails(): string[] {
    return Array.from(this.allowedEmails);
  }
} 