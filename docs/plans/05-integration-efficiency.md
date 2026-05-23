# Plan 5 — Integration Efficiency

**Findings**: #16, #17, #18
**Effort**: 4–5 days
**Tier**: 📉 Medium

## Why

The Anthropic, Notion, and QuickBooks integrations all leave significant cost/latency wins on the table — prompt caching disabled, sync runs sequentially with redundant lookups, and QBO customer fetches pull the full table per invoice.

## 5.1 — Enable Anthropic prompt caching (Finding #16)

- **Files**: `server/src/services/AnthropicService.ts:60-209, 437-753`
- **Problem**: System prompt rebuilt from scratch per call. No `cache_control` on `messages.create`. A 5-tool-call scheduling query = ~100k input tokens billed; with caching it would be ~10k. Roughly 10× cost reduction available.
- **Approach**:
  1. Mark the system prompt with `cache_control: { type: 'ephemeral' }` in the `messages.create` call.
  2. Move large semi-static content (helpers table, clients-by-zone, calendar context) into structured tool responses Claude can fetch on demand instead of always-on system prompt.
  3. Add `anthropic-beta: prompt-caching-2024-07-31` header if not already present.
  4. Trim conversation history in the tool loop (`AnthropicService.ts:125-179`) to last N messages once total tokens exceed a threshold.
- **Verify**: Inspect `response.usage` → `cache_read_input_tokens > 0` on the second call within 5 min. Per-query cost drops ~10×.

## 5.2 — Parallelize Notion sync with hoisted lookup maps (Finding #17)

- **Files**: `server/src/services/NotionSyncService.ts:80-120, 820-866, 935-990`
- **Problem**: Per page: one `getAllClients()` + one `getAllEmployees()` + one Anthropic AI call, all sequential. 200 pages = 10–15 minutes. 1000 pages will exceed the cron window.
- **Approach**:
  1. Before the page loop in `syncNotionPages`: fetch `clientService.getAllClients()` and `employeeService.getAllEmployees()` ONCE; build `Map<lowerName, Client>` and `Map<lowerName, Employee>`. Pass these into `processSingleNotionPage`.
  2. Replace the sequential `for` loop with `pLimit(5)` (or chunked `Promise.all` of 5) to process 5 pages concurrently. (Respect Notion's ~3 req/s — tune as needed.)
  3. Use Notion's `filter: { property: 'Last edited time', date: { on_or_after: lastSyncAt } }` to skip unchanged pages without fetching their content. Persist `last_successful_sync_at` to `settings` table.
- **Verify**: Sync of 200 pages drops from ~10–15 min to ~2–3 min. Re-sync immediately after = near-instant (filter skips everything).

## 5.3 — Fix QBO customer fetch pattern (Finding #18)

- **Files**: `server/src/services/QuickBooksService.ts:455-484`; `server/src/services/InvoiceService.ts:280-308`
- **Problem**: `findCustomerByName` calls `findCustomers({})` — fetching all QBO customers — to do client-side filtering. Then `ensureQBOCustomer` calls `getAllCustomers()` again for fuzzy matching. So every invoice creation triggers 2 full QBO customer fetches plus debug logs stringifying the entire list.
- **Approach**:
  1. Replace `findCustomers({})` + JS filter with `qbo.findCustomers([{ field: 'DisplayName', value: name, operator: 'LIKE' }])`.
  2. Remove the duplicate `getAllCustomers()` call in `ensureQBOCustomer` — use the same query or extend the existing local cache pattern (already used for `qbo_items`).
  3. Delete the `console.log` lines that stringify entire customer lists.
- **Verify**: Creating an invoice triggers 1 QBO API call (not 2 full fetches). Log inspection confirms no big stringified lists.
