import { debugLog } from '../utils/logger';
import { ANTHROPIC_MODEL } from '../constants';
import { AnthropicService } from './AnthropicService';
import { NotionService } from './NotionService';
import { ClickUpService, CLICKUP_PRIORITY } from './ClickUpService';
import { ClientService } from './ClientService';

export interface ParsedTodoItem {
  title: string;
  description?: string;
  destination: 'notion' | 'clickup' | 'clickup_personal';
  client_name?: string;
  clickup_list?: string;
  priority?: string;
  due_date?: string;
  reasoning?: string;
}

export interface TodoResultItem {
  title: string;
  destination: string;
  success: boolean;
  url?: string;
  client_name?: string;
  clickup_list?: string;
  error?: string;
}

export interface VoiceTodoResponse {
  success: boolean;
  items_processed: number;
  results: TodoResultItem[];
  errors: string[];
  classify_only?: boolean;
  items?: ParsedTodoItem[];
}

export class VoiceTodoService {
  private anthropicService: AnthropicService;
  private notionService: NotionService;
  private clickUpService: ClickUpService;
  private clientService: ClientService;

  constructor(
    anthropicService: AnthropicService,
    notionService: NotionService,
    clickUpService: ClickUpService,
    clientService: ClientService,
  ) {
    this.anthropicService = anthropicService;
    this.notionService = notionService;
    this.clickUpService = clickUpService;
    this.clientService = clientService;
  }

  async processTranscription(text: string, classifyOnly: boolean = false): Promise<VoiceTodoResponse> {
    try {
      // Get active client names for prompt context
      const activeClients = await this.clientService.getActiveClients();
      const clientNames = activeClients.map(c => c.name);

      // Classify and extract items
      const items = await this.classifyAndExtract(text, clientNames);

      if (items.length === 0) {
        return { success: true, items_processed: 0, results: [], errors: [] };
      }

      // If classify_only, return parsed items without routing
      if (classifyOnly) {
        return {
          success: true,
          items_processed: items.length,
          results: [],
          errors: [],
          classify_only: true,
          items,
        };
      }

      // Route each item in parallel
      const results = await Promise.all(
        items.map(item => this.routeItem(item))
      );

      const errors = results
        .filter(r => !r.success && r.error)
        .map(r => `${r.title}: ${r.error}`);

      const allFailed = results.every(r => !r.success);

      return {
        success: !allFailed,
        items_processed: items.length,
        results,
        errors,
      };
    } catch (error) {
      debugLog.error('Error processing transcription:', error);
      throw error;
    }
  }

  async classifyAndExtract(text: string, clientNames: string[]): Promise<ParsedTodoItem[]> {
    const systemPrompt = `You are a task classification assistant for a landscaping business called Blossom and Bough.
Your job is to parse voice transcriptions into discrete todo items and classify each one.

## Known Clients
${clientNames.join(', ')}

## Destinations

1. **notion** — On-site landscaping work: observations, tasks for next client visit, things to check/fix/plant at a client's property. These get added to the client's Notion work entry.
   - MUST include client_name (match to known clients above)

2. **clickup** — Business/admin tasks: ordering supplies, scheduling, invoicing, taxes, business errands, admin tasks about clients (not on-site work).
   Available lists and when to use them:
   - "sort" — Default. Use when the item doesn't clearly fit another list.
   - "taxes" — Tax-related tasks (filing, payments, documentation)
   - "supplies_errands" — Purchasing supplies, materials, equipment, running errands
   - "stoller" — Admin/business tasks specifically about the Stoller client
   - "feigum" — Admin/business tasks specifically about the Feigum client
   - "patterson" — Admin/business tasks specifically about the Patterson client
   - "scott" — Admin/business tasks specifically about the Scott client
   - "scheduling" — Scheduling-related tasks (booking appointments, rescheduling)

3. **clickup_personal** — Personal tasks unrelated to the business (doctor appointments, personal errands, etc.)

## Key Routing Rules
- On-site work observations/tasks for next visit → **notion** (e.g., "check the irrigation at Stoller", "prune roses at Patterson next time")
- Admin/business tasks about clients → **clickup** with the client-specific list (e.g., "send invoice to Stoller", "schedule Patterson for Thursday")
- Purchasing/ordering anything → **clickup** with "supplies_errands" list
- Personal tasks → **clickup_personal**
- When unsure about the ClickUp list, default to "sort"

## Output Format
Respond with a JSON array of items. Each item must have:
- title: string (concise, actionable task title)
- description: string (optional, additional context)
- destination: "notion" | "clickup" | "clickup_personal"
- client_name: string (required for notion items, must match a known client name)
- clickup_list: string (required for clickup items, one of the list names above)
- priority: "urgent" | "high" | "normal" | "low" (default: "normal")
- due_date: string (ISO 8601 date if mentioned, otherwise omit)
- reasoning: string (brief explanation of why you classified it this way)

Respond ONLY with the JSON array, no other text.`;

    const userMessage = `Parse this voice transcription into todo items:\n\n"${text}"`;

    try {
      debugLog.info('Classifying voice transcription with Anthropic');

      const client = this.anthropicService.client;
      if (!client) {
        throw new Error('Anthropic API client not initialized. Please check your ANTHROPIC_API_KEY environment variable.');
      }

      const response = await client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 4000,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Anthropic API');
      }

      // Parse JSON from response (handle potential markdown code blocks)
      const jsonMatch = content.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : content.text;
      const items: ParsedTodoItem[] = JSON.parse(jsonText);

      debugLog.info(`Classified ${items.length} items from transcription`);
      return items;
    } catch (error) {
      debugLog.error('Error classifying transcription:', error);
      throw error;
    }
  }

  private async routeItem(item: ParsedTodoItem): Promise<TodoResultItem> {
    try {
      if (item.destination === 'notion') {
        return await this.routeToNotion(item);
      } else {
        return await this.routeToClickUp(item);
      }
    } catch (error) {
      return {
        title: item.title,
        destination: item.destination,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async routeToNotion(item: ParsedTodoItem): Promise<TodoResultItem> {
    if (!item.client_name) {
      return {
        title: item.title,
        destination: 'notion',
        success: false,
        error: 'No client name provided for Notion item',
      };
    }

    const lastEntry = await this.notionService.getLastEntryForClient(item.client_name);
    if (!lastEntry) {
      return {
        title: item.title,
        destination: 'notion',
        success: false,
        client_name: item.client_name,
        error: `No Notion entry found for client: ${item.client_name}`,
      };
    }

    const result = await this.notionService.appendTodoItems(lastEntry.id, [item.title]);

    return {
      title: item.title,
      destination: 'notion',
      success: result.success,
      url: result.pageUrl,
      client_name: item.client_name,
    };
  }

  private async routeToClickUp(item: ParsedTodoItem): Promise<TodoResultItem> {
    const isPersonal = item.destination === 'clickup_personal';
    const listKey = isPersonal ? 'personal' : (item.clickup_list || 'sort');
    const listId = await this.clickUpService.getListId(listKey, isPersonal);

    if (!listId) {
      return {
        title: item.title,
        destination: item.destination,
        success: false,
        clickup_list: listKey,
        error: `No ClickUp list ID configured for: ${listKey}`,
      };
    }

    const priority = item.priority ? (CLICKUP_PRIORITY[item.priority] || CLICKUP_PRIORITY.normal) : undefined;
    const dueDate = item.due_date ? new Date(item.due_date).getTime() : undefined;

    const task = await this.clickUpService.createTask(listId, {
      name: item.title,
      description: item.description,
      priority,
      dueDate,
    });

    return {
      title: item.title,
      destination: item.destination,
      success: true,
      url: task.url,
      clickup_list: listKey,
    };
  }
}
