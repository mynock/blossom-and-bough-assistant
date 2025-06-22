// Test setup configuration
import { jest } from '@jest/globals';

// Mock the database connection to prevent actual database calls during tests
jest.mock('../db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }
}));

// Mock external services to prevent API calls during tests
jest.mock('../services/GoogleCalendarService');
jest.mock('../services/GoogleSheetsService');
jest.mock('../services/NotionService');
jest.mock('../services/AnthropicService');

// Global test timeout
jest.setTimeout(10000);