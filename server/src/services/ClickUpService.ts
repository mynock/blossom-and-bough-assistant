import axios, { AxiosInstance } from 'axios';
import { debugLog } from '../utils/logger';

interface ClickUpTask {
  id: string;
  name: string;
  url: string;
}

interface CreateTaskParams {
  name: string;
  description?: string;
  priority?: number;
  dueDate?: number; // unix ms timestamp
}

interface ClickUpList {
  id: string;
  name: string;
}

// ClickUp priority mapping
export const CLICKUP_PRIORITY: Record<string, number> = {
  urgent: 1,
  high: 2,
  normal: 3,
  low: 4,
};

/**
 * Normalize a ClickUp list name into a lookup key.
 * "Supplies & Errands" → "supplies_errands"
 * "Sort" → "sort"
 */
function normalizeListName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export class ClickUpService {
  private client: AxiosInstance;

  // Cached list lookups: normalized name → list ID
  private bbListCache: Map<string, string> | null = null;
  private personalListCache: Map<string, string> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.clickup.com/api/v2',
      headers: {
        Authorization: process.env.CLICKUP_API_TOKEN || '',
        'Content-Type': 'application/json',
      },
    });

    if (!process.env.CLICKUP_API_TOKEN) {
      debugLog.warn('CLICKUP_API_TOKEN not found in environment variables');
    }
  }

  async createTask(listId: string, params: CreateTaskParams): Promise<ClickUpTask> {
    try {
      debugLog.info(`Creating ClickUp task in list ${listId}: ${params.name}`);

      const body: Record<string, unknown> = {
        name: params.name,
      };

      if (params.description) body.description = params.description;
      if (params.priority) body.priority = params.priority;
      if (params.dueDate) body.due_date = params.dueDate;

      const response = await this.client.post(`/list/${listId}/task`, body);

      const task: ClickUpTask = {
        id: response.data.id,
        name: response.data.name,
        url: response.data.url,
      };

      debugLog.info(`Created ClickUp task: ${task.id} - ${task.name}`);
      return task;
    } catch (error) {
      debugLog.error('Error creating ClickUp task:', error);
      throw error;
    }
  }

  async fetchListsForSpace(spaceId: string): Promise<ClickUpList[]> {
    try {
      debugLog.info(`Fetching lists for space: ${spaceId}`);

      const lists: ClickUpList[] = [];

      // Get lists inside folders
      const foldersResponse = await this.client.get(`/space/${spaceId}/folder`);
      for (const folder of foldersResponse.data.folders) {
        for (const list of folder.lists) {
          lists.push({ id: list.id, name: list.name });
        }
      }

      // Get folderless lists
      const folderlessResponse = await this.client.get(`/space/${spaceId}/list`);
      for (const list of folderlessResponse.data.lists) {
        lists.push({ id: list.id, name: list.name });
      }

      debugLog.info(`Found ${lists.length} lists in space ${spaceId}: ${lists.map(l => l.name).join(', ')}`);
      return lists;
    } catch (error) {
      debugLog.error('Error fetching ClickUp lists:', error);
      throw error;
    }
  }

  private async ensureBbCache(): Promise<Map<string, string>> {
    if (this.bbListCache) return this.bbListCache;

    const spaceId = process.env.CLICKUP_BB_SPACE_ID;
    if (!spaceId) {
      debugLog.warn('CLICKUP_BB_SPACE_ID not configured');
      this.bbListCache = new Map();
      return this.bbListCache;
    }

    const lists = await this.fetchListsForSpace(spaceId);
    this.bbListCache = new Map();
    for (const list of lists) {
      this.bbListCache.set(normalizeListName(list.name), list.id);
    }

    return this.bbListCache;
  }

  private async ensurePersonalCache(): Promise<Map<string, string>> {
    if (this.personalListCache) return this.personalListCache;

    const spaceId = process.env.CLICKUP_PERSONAL_SPACE_ID;
    if (!spaceId) {
      debugLog.warn('CLICKUP_PERSONAL_SPACE_ID not configured');
      this.personalListCache = new Map();
      return this.personalListCache;
    }

    const lists = await this.fetchListsForSpace(spaceId);
    this.personalListCache = new Map();
    for (const list of lists) {
      this.personalListCache.set(normalizeListName(list.name), list.id);
    }

    // Also store the first list as "personal" fallback
    if (lists.length > 0) {
      this.personalListCache.set('personal', lists[0].id);
    }

    return this.personalListCache;
  }

  async getListId(listKey: string, isPersonal: boolean = false): Promise<string | null> {
    const normalized = normalizeListName(listKey);

    if (isPersonal) {
      const cache = await this.ensurePersonalCache();
      return cache.get(normalized) || cache.get('personal') || null;
    }

    const cache = await this.ensureBbCache();
    return cache.get(normalized) || cache.get('sort') || null;
  }
}
