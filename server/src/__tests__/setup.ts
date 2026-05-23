import { jest } from '@jest/globals';

// Set up test environment variables
process.env.NODE_ENV = 'test';

// Use a test database URL if not already set
if (!process.env.DATABASE_URL) {
  // This matches the GitHub Actions test database setup
  process.env.DATABASE_URL = 'postgresql://test_user:test_password@localhost:5432/billable_hours_test';
}

console.log(`🐘 PostgreSQL database connected: ${process.env.DATABASE_URL}`);

// Mock external services to prevent API calls during tests
// NOTE: Database is NOT mocked - these are integration tests that require a real test database
jest.mock('../services/GoogleCalendarService');
jest.mock('../services/GoogleSheetsService');
jest.mock('../services/QuickBooksService');
jest.mock('../services/NotionService');
jest.mock('../services/AnthropicService');
jest.mock('../services/ClickUpService');
jest.mock('../utils/googleAuth');

// Global test timeout
jest.setTimeout(10000);