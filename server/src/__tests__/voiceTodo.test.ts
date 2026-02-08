import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { requireApiKey } from '../middleware/apiKeyAuth';
import { VoiceTodoService, ParsedTodoItem } from '../services/VoiceTodoService';
import { AnthropicService } from '../services/AnthropicService';
import { NotionService } from '../services/NotionService';
import { ClickUpService } from '../services/ClickUpService';
import { ClientService } from '../services/ClientService';

// Helper to create mock req/res/next
function createMocks(overrides: { headers?: Record<string, string>; body?: any } = {}) {
  const req = {
    headers: overrides.headers || {},
    body: overrides.body || {},
  } as unknown as Request;
  const res = {
    status: jest.fn().mockReturnThis() as any,
    json: jest.fn().mockReturnThis() as any,
  } as unknown as Response;
  const next = jest.fn() as unknown as NextFunction;
  return { req, res, next };
}

// ============================================================
// 1. API Key Auth Middleware
// ============================================================
describe('requireApiKey middleware', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, VOICE_TODO_API_KEY: 'test-secret-key' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('rejects requests with no Authorization header', () => {
    const { req, res, next } = createMocks();
    requireApiKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects requests with wrong token', () => {
    const { req, res, next } = createMocks({
      headers: { authorization: 'Bearer wrong-key' },
    });
    requireApiKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes requests with correct Bearer token', () => {
    const { req, res, next } = createMocks({
      headers: { authorization: 'Bearer test-secret-key' },
    });
    requireApiKey(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 500 when VOICE_TODO_API_KEY env var is not set', () => {
    delete process.env.VOICE_TODO_API_KEY;
    const { req, res, next } = createMocks({
      headers: { authorization: 'Bearer any-key' },
    });
    requireApiKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

// ============================================================
// 2-5. VoiceTodoService
// ============================================================
describe('VoiceTodoService', () => {
  let service: VoiceTodoService;
  let mockNotionService: any;
  let mockClickUpService: any;
  let mockClientService: any;
  let mockAnthropicCreate: jest.Mock;

  beforeEach(() => {
    // Create mock instances from auto-mocked classes
    mockNotionService = new NotionService();
    mockClickUpService = new ClickUpService();

    // ClientService is not globally mocked, so create a manual mock
    mockClientService = {
      getActiveClients: jest.fn<any>().mockResolvedValue([
        { name: 'Stoller' },
        { name: 'Feigum' },
        { name: 'Patterson' },
        { name: 'Scott' },
      ]),
    };

    // Mock the Anthropic SDK's messages.create via AnthropicService.client
    mockAnthropicCreate = jest.fn() as jest.Mock;
    const mockAnthropicService = new AnthropicService();
    Object.defineProperty(mockAnthropicService, 'client', {
      get: () => ({ messages: { create: mockAnthropicCreate } }),
    });

    // Create service with mocked dependencies
    service = new VoiceTodoService(
      mockAnthropicService,
      mockNotionService,
      mockClickUpService,
      mockClientService,
    );
  });

  // Helper to mock Anthropic returning specific parsed items
  function mockClassificationResponse(items: ParsedTodoItem[]) {
    (mockAnthropicCreate as any).mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(items) }],
    });
  }

  describe('Classification & Routing', () => {
    it('routes a single Notion item correctly', async () => {
      const items: ParsedTodoItem[] = [{
        title: 'Check irrigation system',
        destination: 'notion',
        client_name: 'Stoller',
        priority: 'normal',
        reasoning: 'On-site task',
      }];
      mockClassificationResponse(items);

      (mockNotionService.getLastEntryForClient as any).mockResolvedValue({ id: 'page-123' });
      (mockNotionService.appendTodoItems as any).mockResolvedValue({
        success: true,
        count: 1,
        pageUrl: 'https://notion.so/page-123',
      });

      const result = await service.processTranscription('check irrigation at Stoller');

      expect(mockNotionService.getLastEntryForClient).toHaveBeenCalledWith('Stoller');
      expect(mockNotionService.appendTodoItems).toHaveBeenCalledWith('page-123', ['Check irrigation system']);
      expect(result.success).toBe(true);
      expect(result.items_processed).toBe(1);
      expect(result.results[0].destination).toBe('notion');
      expect(result.results[0].success).toBe(true);
    });

    it('routes a single ClickUp item correctly', async () => {
      const items: ParsedTodoItem[] = [{
        title: 'Order bark mulch',
        destination: 'clickup',
        clickup_list: 'supplies_errands',
        priority: 'normal',
        reasoning: 'Supply purchasing',
      }];
      mockClassificationResponse(items);

      (mockClickUpService.getListId as any).mockResolvedValue('list-456');
      (mockClickUpService.createTask as any).mockResolvedValue({
        id: 'task-789',
        name: 'Order bark mulch',
        url: 'https://app.clickup.com/task/789',
      });

      const result = await service.processTranscription('order more bark mulch');

      expect(mockClickUpService.createTask).toHaveBeenCalledWith('list-456', {
        name: 'Order bark mulch',
        description: undefined,
        priority: 3,
        dueDate: undefined,
      });
      expect(result.success).toBe(true);
      expect(result.results[0].destination).toBe('clickup');
      expect(result.results[0].clickup_list).toBe('supplies_errands');
    });

    it('routes a mixed batch correctly', async () => {
      const items: ParsedTodoItem[] = [
        {
          title: 'Check drainage',
          destination: 'notion',
          client_name: 'Feigum',
          priority: 'normal',
          reasoning: 'On-site task',
        },
        {
          title: 'Order mulch',
          destination: 'clickup',
          clickup_list: 'supplies_errands',
          priority: 'normal',
          reasoning: 'Supply task',
        },
        {
          title: 'Call dentist',
          destination: 'clickup_personal',
          priority: 'normal',
          reasoning: 'Personal task',
        },
      ];
      mockClassificationResponse(items);

      (mockNotionService.getLastEntryForClient as any).mockResolvedValue({ id: 'page-abc' });
      (mockNotionService.appendTodoItems as any).mockResolvedValue({
        success: true, count: 1, pageUrl: 'https://notion.so/page-abc',
      });
      (mockClickUpService.getListId as any).mockResolvedValue('list-def');
      (mockClickUpService.createTask as any).mockResolvedValue({
        id: 'task-1', name: 'task', url: 'https://app.clickup.com/task/1',
      });

      const result = await service.processTranscription('mixed batch');

      expect(result.success).toBe(true);
      expect(result.items_processed).toBe(3);
      expect(result.results).toHaveLength(3);
      expect(result.results[0].destination).toBe('notion');
      expect(result.results[1].destination).toBe('clickup');
      expect(result.results[2].destination).toBe('clickup_personal');
    });

    it('defaults to Sort list for ambiguous ClickUp items', async () => {
      const items: ParsedTodoItem[] = [{
        title: 'Some ambiguous task',
        destination: 'clickup',
        priority: 'normal',
        reasoning: 'Ambiguous',
      }];
      mockClassificationResponse(items);

      (mockClickUpService.getListId as any).mockResolvedValue('sort-list-id');
      (mockClickUpService.createTask as any).mockResolvedValue({
        id: 'task-1', name: 'task', url: 'https://app.clickup.com/task/1',
      });

      const result = await service.processTranscription('some task');

      expect(mockClickUpService.getListId).toHaveBeenCalledWith('sort', false);
      expect(result.results[0].clickup_list).toBe('sort');
    });

    it('routes personal items to ClickUp personal space', async () => {
      const items: ParsedTodoItem[] = [{
        title: 'Call the dentist',
        destination: 'clickup_personal',
        priority: 'normal',
        reasoning: 'Personal task',
      }];
      mockClassificationResponse(items);

      (mockClickUpService.getListId as any).mockResolvedValue('personal-list-id');
      (mockClickUpService.createTask as any).mockResolvedValue({
        id: 'task-1', name: 'task', url: 'https://app.clickup.com/task/1',
      });

      const result = await service.processTranscription('call the dentist');

      expect(mockClickUpService.getListId).toHaveBeenCalledWith('personal', true);
      expect(result.results[0].destination).toBe('clickup_personal');
    });

    it('handles client not found in Notion gracefully', async () => {
      const items: ParsedTodoItem[] = [
        {
          title: 'Check roses',
          destination: 'notion',
          client_name: 'UnknownClient',
          priority: 'normal',
          reasoning: 'On-site task',
        },
        {
          title: 'Order supplies',
          destination: 'clickup',
          clickup_list: 'supplies_errands',
          priority: 'normal',
          reasoning: 'Supply task',
        },
      ];
      mockClassificationResponse(items);

      (mockNotionService.getLastEntryForClient as any).mockResolvedValue(null);
      (mockClickUpService.getListId as any).mockResolvedValue('list-id');
      (mockClickUpService.createTask as any).mockResolvedValue({
        id: 'task-1', name: 'task', url: 'https://app.clickup.com/task/1',
      });

      const result = await service.processTranscription('check roses and order supplies');

      expect(result.success).toBe(true);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('No Notion entry found');
      expect(result.results[1].success).toBe(true);
    });

    it('returns empty results for empty parse result', async () => {
      mockClassificationResponse([]);

      const result = await service.processTranscription('');

      expect(result.success).toBe(true);
      expect(result.items_processed).toBe(0);
      expect(result.results).toEqual([]);
    });

    it('throws on Anthropic failure', async () => {
      (mockAnthropicCreate as any).mockRejectedValue(new Error('API rate limit'));

      await expect(service.processTranscription('test')).rejects.toThrow('API rate limit');
    });
  });

  // ============================================================
  // 3. Notion Routing
  // ============================================================
  describe('Notion Routing', () => {
    it('calls getLastEntryForClient with correct client name', async () => {
      const items: ParsedTodoItem[] = [{
        title: 'Prune roses',
        destination: 'notion',
        client_name: 'Patterson',
        priority: 'normal',
        reasoning: 'On-site',
      }];
      mockClassificationResponse(items);

      (mockNotionService.getLastEntryForClient as any).mockResolvedValue({ id: 'page-xyz' });
      (mockNotionService.appendTodoItems as any).mockResolvedValue({
        success: true, count: 1, pageUrl: 'https://notion.so/page-xyz',
      });

      await service.processTranscription('prune roses at Patterson');

      expect(mockNotionService.getLastEntryForClient).toHaveBeenCalledWith('Patterson');
    });

    it('calls appendTodoItems with the page ID and todo text', async () => {
      const items: ParsedTodoItem[] = [{
        title: 'Check sprinklers',
        destination: 'notion',
        client_name: 'Scott',
        priority: 'normal',
        reasoning: 'On-site',
      }];
      mockClassificationResponse(items);

      (mockNotionService.getLastEntryForClient as any).mockResolvedValue({ id: 'page-scott' });
      (mockNotionService.appendTodoItems as any).mockResolvedValue({
        success: true, count: 1, pageUrl: 'https://notion.so/page-scott',
      });

      await service.processTranscription('check sprinklers at Scott');

      expect(mockNotionService.appendTodoItems).toHaveBeenCalledWith('page-scott', ['Check sprinklers']);
    });

    it('returns page URL on success', async () => {
      const items: ParsedTodoItem[] = [{
        title: 'Weed beds',
        destination: 'notion',
        client_name: 'Stoller',
        priority: 'normal',
        reasoning: 'On-site',
      }];
      mockClassificationResponse(items);

      (mockNotionService.getLastEntryForClient as any).mockResolvedValue({ id: 'page-stoller' });
      (mockNotionService.appendTodoItems as any).mockResolvedValue({
        success: true, count: 1, pageUrl: 'https://notion.so/page-stoller',
      });

      const result = await service.processTranscription('weed beds at Stoller');
      expect(result.results[0].url).toBe('https://notion.so/page-stoller');
    });

    it('handles missing Notion entry for client', async () => {
      const items: ParsedTodoItem[] = [{
        title: 'Check drainage',
        destination: 'notion',
        client_name: 'Stoller',
        priority: 'normal',
        reasoning: 'On-site',
      }];
      mockClassificationResponse(items);

      (mockNotionService.getLastEntryForClient as any).mockResolvedValue(null);

      const result = await service.processTranscription('check drainage at Stoller');
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('No Notion entry found');
    });

    it('returns error when no client_name provided for Notion item', async () => {
      const items: ParsedTodoItem[] = [{
        title: 'Check something',
        destination: 'notion',
        priority: 'normal',
        reasoning: 'On-site',
      }];
      mockClassificationResponse(items);

      const result = await service.processTranscription('check something');
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('No client name provided');
    });
  });

  // ============================================================
  // 4. ClickUp Routing
  // ============================================================
  describe('ClickUp Routing', () => {
    it('maps priority strings correctly', async () => {
      const priorities = [
        { input: 'urgent', expected: 1 },
        { input: 'high', expected: 2 },
        { input: 'normal', expected: 3 },
        { input: 'low', expected: 4 },
      ];

      for (const { input, expected } of priorities) {
        const items: ParsedTodoItem[] = [{
          title: `Task with ${input} priority`,
          destination: 'clickup',
          clickup_list: 'sort',
          priority: input,
          reasoning: 'test',
        }];
        mockClassificationResponse(items);

        (mockClickUpService.getListId as any).mockResolvedValue('list-id');
        (mockClickUpService.createTask as any).mockResolvedValue({
          id: 'task-1', name: 'task', url: 'https://app.clickup.com/task/1',
        });

        await service.processTranscription(`task with ${input} priority`);

        expect(mockClickUpService.createTask).toHaveBeenCalledWith(
          'list-id',
          expect.objectContaining({ priority: expected })
        );
      }
    });

    it('converts ISO due_date to unix ms timestamp', async () => {
      const items: ParsedTodoItem[] = [{
        title: 'File taxes',
        destination: 'clickup',
        clickup_list: 'taxes',
        priority: 'high',
        due_date: '2025-03-15',
        reasoning: 'Tax task',
      }];
      mockClassificationResponse(items);

      (mockClickUpService.getListId as any).mockResolvedValue('list-id');
      (mockClickUpService.createTask as any).mockResolvedValue({
        id: 'task-1', name: 'task', url: 'https://app.clickup.com/task/1',
      });

      await service.processTranscription('file taxes by march 15');

      const expectedTimestamp = new Date('2025-03-15').getTime();
      expect(mockClickUpService.createTask).toHaveBeenCalledWith(
        'list-id',
        expect.objectContaining({ dueDate: expectedTimestamp })
      );
    });

    it('returns error for unconfigured list', async () => {
      const items: ParsedTodoItem[] = [{
        title: 'Random task',
        destination: 'clickup',
        clickup_list: 'nonexistent_list',
        priority: 'normal',
        reasoning: 'test',
      }];
      mockClassificationResponse(items);

      (mockClickUpService.getListId as any).mockResolvedValue(null);

      const result = await service.processTranscription('random task');

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('No ClickUp list ID configured');
    });

    it('handles ClickUp API errors gracefully', async () => {
      const items: ParsedTodoItem[] = [{
        title: 'Some task',
        destination: 'clickup',
        clickup_list: 'sort',
        priority: 'normal',
        reasoning: 'test',
      }];
      mockClassificationResponse(items);

      (mockClickUpService.getListId as any).mockResolvedValue('list-id');
      (mockClickUpService.createTask as any).mockRejectedValue(new Error('ClickUp API error'));

      const result = await service.processTranscription('some task');

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBe('ClickUp API error');
    });
  });

  // ============================================================
  // 5. classify_only mode
  // ============================================================
  describe('classify_only mode', () => {
    it('returns parsed items without routing when classify_only is true', async () => {
      const items: ParsedTodoItem[] = [
        {
          title: 'Check irrigation',
          destination: 'notion',
          client_name: 'Stoller',
          priority: 'normal',
          reasoning: 'On-site task for next client visit',
        },
        {
          title: 'Order bark mulch',
          destination: 'clickup',
          clickup_list: 'supplies_errands',
          priority: 'normal',
          reasoning: 'Supply purchasing task',
        },
      ];
      mockClassificationResponse(items);

      const result = await service.processTranscription('check irrigation at Stoller and order bark mulch', true);

      expect(result.classify_only).toBe(true);
      expect(result.items).toHaveLength(2);
      expect(result.results).toEqual([]);
      expect(mockNotionService.getLastEntryForClient).not.toHaveBeenCalled();
      expect(mockClickUpService.createTask).not.toHaveBeenCalled();
    });
  });
});
