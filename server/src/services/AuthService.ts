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
        console.log('🔵 [OAUTH] Google strategy callback triggered');
        console.log('🔵 [OAUTH] Profile ID:', profile.id);
        console.log('🔵 [OAUTH] Profile displayName:', profile.displayName);
        console.log('🔵 [OAUTH] Profile emails:', profile.emails);
        console.log('🔵 [OAUTH] Profile photos:', profile.photos);
        
        const email = profile.emails?.[0]?.value?.toLowerCase();
        
        if (!email) {
          console.log('❌ [OAUTH] No email found in Google profile');
          return done(new Error('No email found in Google profile'), undefined);
        }

        console.log('🔵 [OAUTH] Email from profile:', email);
        console.log('🔵 [OAUTH] Checking against allowlist...');
        console.log('🔵 [OAUTH] Allowed emails:', Array.from(this.allowedEmails));

        // Check if user is in allowlist
        if (!this.allowedEmails.has(email)) {
          console.log(`🚫 Unauthorized login attempt: ${email}`);
          console.log('🚫 [OAUTH] Email not in allowlist');
          return done(new Error(`Access denied. Email ${email} is not authorized.`), undefined);
        }

        const user: User = {
          id: profile.id,
          email: email,
          name: profile.displayName || 'Unknown User',
          picture: profile.photos?.[0]?.value
        };

        console.log('✅ [OAUTH] User object created:', user);
        console.log(`✅ Authorized login: ${email}`);
        return done(null, user);
      } catch (error) {
        console.log('❌ [OAUTH] Error in Google strategy:', error);
        return done(error, undefined);
      }
    }));

    // Serialize user for session
    passport.serializeUser((user: any, done) => {
      console.log('🔵 [SESSION] Serializing user:', user);
      done(null, user);
    });

    // Deserialize user from session
    passport.deserializeUser((user: any, done) => {
      console.log('🔵 [SESSION] Deserializing user:', user);
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