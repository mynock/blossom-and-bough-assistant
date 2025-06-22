import { google } from 'googleapis';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Shared Google authentication utility that supports both:
 * 1. Environment variable containing JSON credentials (GOOGLE_SERVICE_ACCOUNT_KEY)
 * 2. File-based credentials (GOOGLE_SERVICE_ACCOUNT_KEY_FILE)
 */
export function createGoogleAuth(scopes: string[]): any {
  try {
    // Option 1: Try environment variable first (for production deployments)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      console.log('🔑 Using Google service account from environment variable');
      
      try {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        
        return new google.auth.GoogleAuth({
          credentials,
          scopes,
        });
      } catch (parseError) {
        console.error('❌ Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY environment variable:', parseError);
        throw new Error('Invalid JSON in GOOGLE_SERVICE_ACCOUNT_KEY environment variable');
      }
    }
    
    // Option 2: Fall back to file-based credentials
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE) {
      console.log('🔑 Using Google service account from key file');
      
      // Resolve the key file path relative to the root directory
      const rootDir = path.resolve(__dirname, '../../');
      let keyFilePath = path.resolve(rootDir, process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE);
      
      // If the file doesn't exist at the specified path, try looking in the root directory
      if (!fs.existsSync(keyFilePath)) {
        const filename = path.basename(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE);
        keyFilePath = path.resolve(rootDir, filename);
      }
      
      if (!fs.existsSync(keyFilePath)) {
        throw new Error(`Google service account key file not found at: ${keyFilePath}`);
      }
      
      console.log(`📂 Loading Google credentials from: ${keyFilePath}`);
      
      return new google.auth.GoogleAuth({
        keyFile: keyFilePath,
        scopes,
      });
    }
    
    // No credentials configured
    throw new Error('No Google service account credentials configured. Please set either GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_FILE environment variable.');
    
  } catch (error) {
    console.error('❌ Google authentication setup failed:', error);
    throw error;
  }
}

/**
 * Check if Google credentials are configured
 */
export function hasGoogleCredentials(): boolean {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE);
}

/**
 * Get configuration info for debugging
 */
export function getGoogleAuthConfig(): {
  hasEnvKey: boolean;
  hasKeyFile: boolean;
  keyFileExists?: boolean;
  keyFilePath?: string;
} {
  const hasEnvKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const hasKeyFile = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  
  let keyFileExists: boolean | undefined;
  let keyFilePath: string | undefined;
  
  if (hasKeyFile) {
    const rootDir = path.resolve(__dirname, '../../');
    keyFilePath = path.resolve(rootDir, process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE!);
    
    if (!fs.existsSync(keyFilePath)) {
      const filename = path.basename(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE!);
      keyFilePath = path.resolve(rootDir, filename);
    }
    
    keyFileExists = fs.existsSync(keyFilePath);
  }
  
  return {
    hasEnvKey,
    hasKeyFile,
    keyFileExists,
    keyFilePath,
  };
} 