import { NotionSyncService } from '../../services/NotionSyncService';
import { WorkActivityService } from '../../services/WorkActivityService';
import { ClientService } from '../../services/ClientService';
import { EmployeeService } from '../../services/EmployeeService';
import { AnthropicService } from '../../services/AnthropicService';

// Mock all dependencies
jest.mock('../../services/WorkActivityService');
jest.mock('../../services/ClientService');
jest.mock('../../services/EmployeeService');
jest.mock('../../services/AnthropicService');
jest.mock('../../services/WorkNotesParserService');

// Mock Notion client
jest.mock('@notionhq/client', () => {
  const mockMethods = {
    databases: {
      query: jest.fn(),
    },
    blocks: {
      children: {
        list: jest.fn(),
      },
    },
  };
  
  return {
    Client: jest.fn().mockImplementation(() => mockMethods),
    __mockMethods: mockMethods, // Export the methods for access in tests
  };
});

// Mock environment variables
process.env.NOTION_TOKEN = 'test-token';
process.env.NOTION_DATABASE_ID = 'test-database-id';

describe('NotionSyncService - Conflict Prevention', () => {
  let notionSyncService: NotionSyncService;
  let mockWorkActivityService: jest.Mocked<WorkActivityService>;
  let mockAnthropicService: jest.Mocked<AnthropicService>;
  let mockNotionMethods: any;

  const mockNotionPage = {
    id: 'notion-page-123',
    last_edited_time: '2025-06-29T07:30:00Z', // Edited BEFORE last sync
    properties: {
      'Client Name': { select: { name: 'Test Client' } },
      'Date': { date: { start: '2025-06-29' } },
      'Work Type': { select: { name: 'Maintenance' } },
    },
  };

  const mockExistingActivity = {
    id: 1,
    workType: 'Maintenance',
    date: '2025-06-29',
    clientId: 1,
    totalHours: 4,
    notionPageId: 'notion-page-123',
    lastNotionSyncAt: new Date('2025-06-29T08:00:00Z'), // Synced 2 hours before Notion edit
    updatedAt: new Date('2025-06-29T09:00:00Z'), // Updated 1 hour before Notion edit
    createdAt: new Date('2025-06-29T07:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mock methods from the mocked module
    const notionMock = require('@notionhq/client');
    mockNotionMethods = notionMock.__mockMethods;
    
    // Create service with mocked dependencies
    mockAnthropicService = new AnthropicService() as jest.Mocked<AnthropicService>;
    notionSyncService = new NotionSyncService(mockAnthropicService);

    // Get access to mocked services
    mockWorkActivityService = WorkActivityService.prototype as jest.Mocked<WorkActivityService>;
    
    // Override the service instance in the NotionSyncService instance  
    (notionSyncService as any).workActivityService = mockWorkActivityService;
    
    // Mock ClientService methods
    const mockClientService = {
      getAllClients: jest.fn().mockResolvedValue([{
        id: 1,
        name: 'Test Client',
        clientId: 'test-client-1',
      }]),
      createClient: jest.fn().mockResolvedValue({
        id: 1,
        name: 'Test Client',
        clientId: 'test-client-1',
      }),
    };
    (notionSyncService as any).clientService = mockClientService;

    // Setup common mocks
    mockAnthropicService.parseWorkNotes = jest.fn().mockResolvedValue({
      activities: [{
        clientName: 'Test Client',
        date: '2025-06-29',
        workType: 'Maintenance',
        totalHours: 4,
        tasks: ['Test task'],
        notes: 'Test notes',
      }],
      warnings: [],
    });

    // Mock WorkNotesParserService methods that are used by NotionSyncService
    const mockWorkNotesParserService = {
      validateAndPreview: jest.fn().mockResolvedValue({
        activities: [{
          canImport: true,
          validationIssues: [],
          clientId: 1,
        }],
      }),
      importActivities: jest.fn().mockResolvedValue({
        failed: 0,
        errors: [],
      }),
    };

    // Override the parser service in the NotionSyncService instance
    (notionSyncService as any).workNotesParserService = mockWorkNotesParserService;
  });

  describe('shouldSyncFromNotion', () => {
    // Access the private method for testing
    const getShouldSyncMethod = (service: NotionSyncService) => {
      return (service as any).shouldSyncFromNotion.bind(service);
    };

    test('should sync when no previous sync timestamp exists', () => {
      const shouldSync = getShouldSyncMethod(notionSyncService);
      
      const result = shouldSync(
        '2025-06-29T10:00:00Z', // Notion last edited
        null, // No previous sync
        '2025-06-29T09:00:00Z'  // Record updated
      );

      expect(result).toBe(true);
    });

    test('should sync when no local changes since last sync and Notion is newer', () => {
      const shouldSync = getShouldSyncMethod(notionSyncService);
      
      const result = shouldSync(
        '2025-06-29T10:00:00Z', // Notion edited at 10:00
        '2025-06-29T08:00:00Z', // Last sync at 08:00
        '2025-06-29T08:30:00Z'  // Record updated at 08:30 (before sync)
      );

      expect(result).toBe(true);
    });

    test('should NOT sync when local changes are newer than last sync and Notion has not changed since sync', () => {
      const shouldSync = getShouldSyncMethod(notionSyncService);
      
      const result = shouldSync(
        '2025-06-29T08:00:00Z', // Notion edited at 08:00 (before sync)
        '2025-06-29T09:00:00Z', // Last sync at 09:00
        '2025-06-29T10:00:00Z'  // Record updated at 10:00 (after sync - local changes!)
      );

      expect(result).toBe(false);
    });

    test('should sync when both local and Notion have changed since last sync', () => {
      const shouldSync = getShouldSyncMethod(notionSyncService);
      
      const result = shouldSync(
        '2025-06-29T11:00:00Z', // Notion edited at 11:00 (after sync)
        '2025-06-29T09:00:00Z', // Last sync at 09:00
        '2025-06-29T10:00:00Z'  // Record updated at 10:00 (after sync)
      );

      expect(result).toBe(true); // Notion wins in conflicts
    });

    test('should NOT sync when Notion has not changed since last sync', () => {
      const shouldSync = getShouldSyncMethod(notionSyncService);
      
      const result = shouldSync(
        '2025-06-29T08:00:00Z', // Notion edited at 08:00 (before sync)
        '2025-06-29T09:00:00Z', // Last sync at 09:00
        '2025-06-29T08:30:00Z'  // Record updated at 08:30 (before sync)
      );

      expect(result).toBe(false);
    });
  });

  describe('syncNotionPages - Conflict Prevention Integration', () => {
    beforeEach(() => {
      // Reset and setup the global mock for each test
      jest.clearAllMocks();
      
      mockNotionMethods.databases.query.mockResolvedValue({
        results: [mockNotionPage],
        has_more: false,
      });

      mockNotionMethods.blocks.children.list.mockResolvedValue({
        results: [],
      });
    });

    test('should skip sync when local changes are protected', async () => {
      // Setup: Activity with local changes newer than last sync
      const activityWithLocalChanges = {
        ...mockExistingActivity,
        lastNotionSyncAt: new Date('2025-06-29T08:00:00Z'), // Synced at 08:00
        updatedAt: new Date('2025-06-29T11:00:00Z'), // Updated locally at 11:00
      };

      mockWorkActivityService.getWorkActivityByNotionPageId = jest.fn()
        .mockResolvedValue(activityWithLocalChanges);

      const result = await notionSyncService.syncNotionPages();

      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.warnings).toContain(
        '"Test Client" on 2025-06-29: Skipped sync - you have newer local changes that would be overwritten'
      );
    });

    test('should sync when Notion changes are newer than local changes', async () => {
      // Setup: Notion edited after local changes
      const notionPageNewerThanLocal = {
        ...mockNotionPage,
        last_edited_time: '2025-06-29T12:00:00Z', // Notion edited at 12:00
      };

      const activityWithOlderChanges = {
        ...mockExistingActivity,
        lastNotionSyncAt: new Date('2025-06-29T08:00:00Z'), // Synced at 08:00
        updatedAt: new Date('2025-06-29T10:00:00Z'), // Updated locally at 10:00 (before Notion)
      };

      // Update mock to return newer Notion page
      mockNotionMethods.databases.query.mockResolvedValue({
        results: [notionPageNewerThanLocal],
        has_more: false,
      });

      mockWorkActivityService.getWorkActivityByNotionPageId = jest.fn()
        .mockResolvedValue(activityWithOlderChanges);

      mockWorkActivityService.updateWorkActivity = jest.fn().mockResolvedValue(undefined);

      const result = await notionSyncService.syncNotionPages();

      expect(result.updated).toBe(1);
      expect(result.warnings).not.toContain(
        expect.stringContaining('Skipped sync')
      );
      expect(mockWorkActivityService.updateWorkActivity).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          lastNotionSyncAt: expect.any(Date), // Should update sync timestamp
        })
      );
    });

    test('should sync when no previous sync exists', async () => {
      // Setup: Activity without lastNotionSyncAt (never synced)
      const neverSyncedActivity = {
        ...mockExistingActivity,
        lastNotionSyncAt: null, // Never synced from Notion
        updatedAt: new Date('2025-06-29T11:00:00Z'), // Has local changes
      };

      mockWorkActivityService.getWorkActivityByNotionPageId = jest.fn()
        .mockResolvedValue(neverSyncedActivity);

      mockWorkActivityService.updateWorkActivity = jest.fn().mockResolvedValue(undefined);

      const result = await notionSyncService.syncNotionPages();

      expect(result.updated).toBe(1);
      expect(result.warnings).not.toContain(
        expect.stringContaining('Skipped sync')
      );
    });

    test('should create new activity and set sync timestamp', async () => {
      // Setup: No existing activity
      mockWorkActivityService.getWorkActivityByNotionPageId = jest.fn()
        .mockResolvedValue(null);

      // Mock the validation and import process
      const mockWorkNotesParserService = {
        validateAndPreview: jest.fn().mockResolvedValue({
          activities: [{
            canImport: true,
            validationIssues: [],
            clientId: 1,
          }],
        }),
        importActivities: jest.fn().mockResolvedValue({
          failed: 0,
          errors: [],
        }),
      };

      // Replace the parser service
      (notionSyncService as any).workNotesParserService = mockWorkNotesParserService;

      // Mock finding the created activity
      mockWorkActivityService.getWorkActivitiesByDateRange = jest.fn()
        .mockResolvedValue([{
          id: 2,
          clientId: 1,
          totalHours: 4,
          notionPageId: null,
          createdAt: new Date(),
        }]);

      mockWorkActivityService.updateWorkActivity = jest.fn().mockResolvedValue(undefined);

      const result = await notionSyncService.syncNotionPages();

      expect(result.created).toBe(1);
      expect(mockWorkActivityService.updateWorkActivity).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          notionPageId: 'notion-page-123',
          lastNotionSyncAt: expect.any(Date), // Should set sync timestamp
        })
      );
    });
  });

  describe('Edge Cases', () => {
    test('should handle invalid timestamp formats gracefully', () => {
      const shouldSync = (notionSyncService as any).shouldSyncFromNotion.bind(notionSyncService);
      
      // Should not throw and should default to syncing
      expect(() => {
        shouldSync(
          'invalid-date',
          '2025-06-29T09:00:00Z',
          '2025-06-29T10:00:00Z'
        );
      }).not.toThrow();
    });

    test('should handle null updatedAt gracefully', () => {
      const shouldSync = (notionSyncService as any).shouldSyncFromNotion.bind(notionSyncService);
      
      const result = shouldSync(
        '2025-06-29T10:00:00Z',
        '2025-06-29T09:00:00Z',
        null
      );

      // Should default to syncing when record timestamp is invalid
      expect(result).toBe(true);
    });
  });

  describe('Warning Message Generation', () => {
    test('should generate user-friendly warning messages', async () => {
      const activityWithLocalChanges = {
        ...mockExistingActivity,
        lastNotionSyncAt: new Date('2025-06-29T08:00:00Z'),
        updatedAt: new Date('2025-06-29T11:00:00Z'),
      };

      mockNotionMethods.databases.query.mockResolvedValue({
        results: [mockNotionPage],
        has_more: false,
      });
      mockNotionMethods.blocks.children.list.mockResolvedValue({ results: [] });

      mockWorkActivityService.getWorkActivityByNotionPageId = jest.fn()
        .mockResolvedValue(activityWithLocalChanges);

      const result = await notionSyncService.syncNotionPages();

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toBe(
        '"Test Client" on 2025-06-29: Skipped sync - you have newer local changes that would be overwritten'
      );
    });
  });
});