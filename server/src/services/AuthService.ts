import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

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
    
    console.log(`🔐 Auth allowlist configured with ${emails.length} emails`);
    return new Set(emails);
  }

  private initializePassport(): void {
    // Check if OAuth credentials are configured
    if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
      console.log('🔐 Google OAuth credentials not configured - authentication disabled');
      console.log('   Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET to enable authentication');
      return;
    }

    // Configure Google OAuth strategy
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_OAUTH_CALLBACK_URL || '/api/auth/google/callback'
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();
        
        if (!email) {
          return done(new Error('No email found in Google profile'), undefined);
        }

        // Check if user is in allowlist
        if (!this.allowedEmails.has(email)) {
          console.log(`🚫 Unauthorized login attempt: ${email}`);
          return done(new Error(`Access denied. Email ${email} is not authorized.`), undefined);
        }

        const user: User = {
          id: profile.id,
          email: email,
          name: profile.displayName || 'Unknown User',
          picture: profile.photos?.[0]?.value
        };

        console.log(`✅ Authorized login: ${email}`);
        return done(null, user);
      } catch (error) {
        return done(error, undefined);
      }
    }));

    // Serialize user for session
    passport.serializeUser((user: any, done) => {
      done(null, user);
    });

    // Deserialize user from session
    passport.deserializeUser((user: any, done) => {
      done(null, user);
    });

    console.log('✅ Google OAuth authentication initialized');
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