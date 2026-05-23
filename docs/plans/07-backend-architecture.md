# Plan 7 — Backend Architecture Cleanup

**Findings**: #21, #22, #23, #24, #29, #30, #31
**Effort**: 2 weeks
**Tier**: 🏗️ Debt

## Why

The architectural pieces are sound on paper (DI container, service layer, route layer) but discipline gaps everywhere break the abstractions. These are independent cleanups that can ship one at a time.

## 7.1 — Make DI container authoritative (Finding #21)

- **Files**: `server/src/services/container.ts` (the container itself is fine); all sites currently calling `new XService()`:
  - `WorkActivityService.ts:90-93`, `NotionSyncService.ts:38-43`, `InvoiceService.ts:43-46`, `AdminService.ts:72-76`, `CronService.ts:25-26, 190-191`, `BaseTimeAllocationService.ts:85`, `DataMigrationService.ts:32-34`, `ProductionPullService.ts:95`, `QuickBooksService.ts:508`, `server.ts:115-116, 505`, `routes/notionSync.ts:10`
- **Problem**: Each `new XService()` creates a parallel singleton — defeating the container. There are ~5 separate `AnthropicService` instances at runtime. The `setSchedulingService` hack at `AnthropicService.ts:55-58` only patches the container's instance — the others stay broken.
- **Approach**:
  1. Refactor each service's constructor to accept its dependencies: `constructor(private deps: { anthropic: AnthropicService, work: WorkActivityService, ... })`.
  2. Update `container.ts` to wire dependencies in topological order (leaf services first).
  3. Delete every `new XService()` outside `container.ts` and tests.
  4. Add an ESLint rule (`no-restricted-syntax`) banning `NewExpression[callee.name=/.*Service$/]` outside `container.ts` and `__tests__/`.
  5. Removes the need for the `setSchedulingService` hack in `AnthropicService.ts:55-58`.
- **Verify**: `grep -rn "new \w*Service" server/src --include='*.ts' | grep -v container.ts | grep -v __tests__` returns empty. App still boots; chat still works (was previously broken outside `/api/chat` due to the injection hack).

## 7.2 — Encapsulate DB access (Finding #22)

- **Files**: `server/src/services/DatabaseService.ts:4`; route files reaching in: `routes/dataExport.ts:50`, `routes/quickbooks.ts:256-396`; service files: `NotionSyncService.ts:1271-1370`, `AdminService.ts:85-87,113-152`
- **Problem**: `DatabaseService.db` is `public`. Routes contain 100+ lines of Drizzle queries; services reach into each other's tables. Business logic in `WorkActivityService.updateWorkActivity` is silently bypassed.
- **Approach**:
  1. Change `DatabaseService.db` from `public` to `protected`.
  2. Move every Drizzle query out of routes into the owning service. New service methods as needed (e.g., `WorkActivityService.bulkSetCharges()`, `InvoiceService.markActivitiesInvoiced()`).
  3. Cross-service writes (e.g., `NotionSyncService` mutating `otherCharges`) must go through `WorkActivityService` methods.
  4. ESLint rule banning Drizzle table imports (`from '../db/schema'`) outside `services/` and `db/` paths.
- **Verify**: `grep -rn "from.*db/schema" server/src/routes/` returns empty. Build still succeeds.

## 7.3 — Standardize error handling (Finding #23)

- **Files**: All 16 route files in `server/src/routes/`; `server/src/middleware/asyncHandler.ts`; `server/src/server.ts:624-627` (global error handler)
- **Problem**: 30 routes use `asyncHandler`, 76 use manual try/catch. 4 different response shapes. The global error handler at `server.ts:624-627` only fires for `asyncHandler` routes; bespoke catches leak schema names in `details` fields.
- **Approach**:
  1. Define `AppError` class in `server/src/utils/AppError.ts` with `statusCode`, `code`, `message` properties.
  2. Convert every route handler in `routes/admin.ts`, `quickbooks.ts`, `settings.ts`, `notionSync.ts`, `migration.ts`, `breakTime.ts`, `travelTime.ts`, `naturalLanguageSQL.ts`, `reports.ts` from manual try/catch to `asyncHandler` wrapping.
  3. Update global error handler to produce a single response shape: `{ error: string, code?: string }`. Hide `details` in production; log full error server-side with request ID.
  4. Replace all `console.error` / `console.log` in route handlers with `debugLog.*`.
  5. ESLint rule against bare `try/catch` at route handler top level.
- **Verify**: All errors return `{ error, code? }` shape (curl + grep). Server logs contain full stack + request ID; client sees only sanitized message.

## 7.4 — Normalize API response shapes (Finding #24)

- **Files**: All route files
- **Problem**: `GET /api/work-activities` returns `[]`, `GET /api/clients` returns `{ clients: [] }`, `GET /api/admin/status` returns `{ success: true, data: {...} }`. Frontend has to know per-endpoint how to unwrap.
- **Approach**: Pick one convention — recommend **bare values for GET (arrays or objects), `{ data, error }` for mutations**. Audit each route, change response shapes, update each frontend caller in lockstep. Group by route file to ship one PR per route file (`/api/clients` → `/api/employees` → ...). Add a TypeScript type per endpoint shared between FE/BE if [Plan 8.2](./08-frontend-foundation.md) is done.
- **Verify**: One consistent shape per HTTP method category. Frontend type errors flush out any missed call sites.

## 7.5 — Centralize env config (Finding #30)

- **Files**: `server/src/db/index.ts:6-9`, `server/src/services/NotionService.ts:4-9`, `server/src/services/NotionSyncService.ts:10-14`, `server/src/server.ts` (many), and 20+ others doing raw `process.env.X`
- **Problem**: 24 files do raw `process.env.*` lookups. Module-load-time captures in `NotionService.ts:4-9` and `db/index.ts:6-9` mean `dotenv.config()` ordering matters. Hardcoded fallbacks like `'postgresql://localhost...'`, `'your-secret-key-change-in-production'`, `'http://localhost:3000'` litter the code.
- **Approach**:
  1. Create `server/src/config.ts`:
     ```typescript
     import { z } from 'zod';
     const schema = z.object({
       NODE_ENV: z.enum(['development','production','test']),
       DATABASE_URL: z.string().url(),
       SESSION_SECRET: z.string().min(32),
       GOOGLE_OAUTH_CLIENT_ID: z.string(),
       // ...all env vars
     });
     export const config = schema.parse(process.env);
     ```
  2. Replace all `process.env.X` reads with `config.X`. Boot fails-fast on missing/invalid vars.
  3. Remove all hardcoded fallback strings.
- **Verify**: Unset required env var → server fails at boot with clear zod error message. `grep -rn "process.env" server/src/ | grep -v config.ts` near-empty.

## 7.6 — Deduplicate time allocation services (Finding #29)

- **Files**: `server/src/services/BreakTimeAllocationService.ts`, `server/src/services/TravelTimeAllocationService.ts`, `server/src/services/BaseTimeAllocationService.ts`; `server/src/routes/breakTime.ts`, `server/src/routes/travelTime.ts`
- **Problem**: 410 lines of mirror-image copy-paste. Both subclasses are 95% identical wrappers translating between near-identical interfaces. Both route files (187 lines each) have identical structure.
- **Approach**:
  1. Delete `BreakTimeAllocationService` and `TravelTimeAllocationService` wrappers. The base class already has the logic.
  2. Expose a single `services.timeAllocation.allocate(date, type: 'break' | 'travel')` API.
  3. Create `createTimeAllocationRouter(type: 'break' | 'travel')` factory; both routes become ~30 lines each.
  4. Frontend `TravelTimeAllocation.tsx` + `BreakTimeAllocation.tsx` already share shape — point both at the unified API.
- **Verify**: 410 lines deleted. Both routes still pass any existing tests; frontend allocation UI unchanged.

## 7.7 — Harden QBO OAuth (Finding #31)

- **Files**: `server/src/services/QuickBooksService.ts:88, 124-194`; `server/src/routes/quickbooks.ts:21-23`
- **Problem**: Hardcoded OAuth `state = 'qbo_auth'` (`QuickBooksService.ts:153`) defeats CSRF protection — attacker submits their own valid callback to your `/api/qbo/callback`, your server stores attacker's QBO tokens, future invoices route to their QuickBooks. Tokens are also written to `process.env` at runtime (lost on every restart, process-global, mutating runtime env).
- **Approach**:
  1. Generate random `state` per OAuth init: `crypto.randomBytes(32).toString('hex')`. Store in `req.session.qboState`.
  2. Callback validates `req.query.state === req.session.qboState`; reject mismatch.
  3. Create `qbo_credentials` table: `id`, `realm_id`, `access_token` (encrypted), `refresh_token` (encrypted), `expires_at`, `updated_at`. Persist tokens here, not `process.env`.
  4. Encryption: app-level AES-GCM with key from `config.QBO_TOKEN_ENCRYPTION_KEY` (Plan 7.5).
  5. On refresh: write new tokens back to DB.
  6. Use `crypto.timingSafeEqual` for any bearer-token compares in `server.ts:436-498`, `routes/dataExport.ts:35`.
- **Verify**: Restart server → QBO connection survives. Replay attack with stale state → rejected. Tokens in DB encrypted (visual inspection).
