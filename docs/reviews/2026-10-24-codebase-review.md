# Codebase review — 2026-10-24

A cruft and staleness pass five months after the last commit. It builds on the May 2026 portfolio in [`docs/plans/`](../plans/README.md) and doesn't repeat it, except to record its real status.

**Read this first**
- Findings were checked against `origin/main` at d5b16cd (May 31), and line numbers refer to that commit. Section 1 was fixed on the branch that added this doc.
- `Dockerfile.backend` and `Dockerfile.frontend` have uncommitted local edits (BuildKit header, non-root install, cached `npm ci`). They are treated as work in progress, not cruft. Both still use `node:18`.
- Not verified: anything that depends on Railway's environment. That includes whether `CRON_AUTH_TOKEN`, `GOOGLE_SHEETS_ID` and the Calendar credentials are set in production, and whether the Schedule page is actually broken there. The Railway MCP needs authorizing via `/mcp` before that can be checked.

Effort: **S** < half a day · **M** ≈ 1–3 days · **L** = a project.

---

## 1. Fix first: correctness and security (all S) — ✅ fixed alongside this doc

Two additions to the list below: `POST /api/migration/clear` is now blocked in production along with seed-reset, and the same foreign-key fix covers `clearProjectsAndWorkData` and the full wipe `clearAllData`.

| # | Finding | Where | Why it matters |
|---|---|---|---|
| 1.1 | **Calendar events come back as raw Google objects.** `getEvents()` returns `getAllEvents()` unchanged. Since c804395 (Jul 2025) the `parseGoogleEvent` / `inferEventType` code (~175 lines) never runs. | `server/src/services/GoogleCalendarService.ts:34-82` | Consumers read `event.start` as a string plus `event.title` and `event.eventType`. A raw event has `start: {dateTime}` and `summary`, so the **Schedule page**, the client "upcoming schedule" (`routes/clients.ts:66-90`) and the AI calendar tools likely get invalid dates and no titles in prod. In dev it looks fine because the mock events already have the parsed shape. Fix: map `getEvents()` through `parseGoogleEvent` and keep `getAllEvents()` raw for CronService. |
| 1.2 | **The scheduling prompt says "Current year is 2025."** | `server/src/services/AnthropicService.ts:660` | It contradicts the live `currentDate` injected at :648-654. Relative dates ("next Tuesday") resolve to 2025. Delete the line. |
| 1.3 | **Cron endpoints accept anonymous calls if `CRON_AUTH_TOKEN` is unset.** `undefined === undefined` passes the check. | `server/src/server.ts:509`, `:562` | `POST /api/cron/maintenance-entries` and `/api/cron/notion-sync` are also CSRF-exempt (:165). Reject when the env var is missing. |
| 1.4 | **`DATABASE_URL`, password included, is logged at boot.** | `server/src/db/index.ts:17` | It ends up in Railway logs. Log only the host and database name. |
| 1.5 | **Leftover public or unauthenticated endpoints.** | `routes/auth.ts:171` (`/test-session` echoes the whole `req.session`), `:190` `/test`; `routes/notion.ts:73,94` (`/health`, `/templates`, which calls the Notion API); `server.ts:477` `POST /api/calendar/template` (no `requireAuth`) | None has an in-repo caller. Delete them. |
| 1.6 | **The Debug page's "seed-reset" wipes the DB and reloads it from Sheets.** Any logged-in user can trigger it in prod. | `src/components/Debug.tsx:128` → `routes/migration.ts:121` | Gate it to dev, or remove it. |
| 1.7 | **The "Ask the assistant" nav item opens a page that returns 503.** It points at `/ask-data` (the disabled NL-SQL feature). The real chat at `/chat` has had no nav entry since 3f0f6a4. | `src/components/Navigation.tsx:93`, `server.ts:208` | Point the nav item at `/chat`. |
| 1.8 | **NotionSync builds its own axios instance without the CSRF interceptor.** The non-streaming "Sync" and "Sync page" buttons are likely to 403 in prod, since CSRF is skipped in dev. | `src/components/NotionSync.tsx:47` | Use the shared `apiClient`. |
| 1.9 | **There's no QuickBooks disconnect button, but the Privacy Policy promises one.** | `routes/quickbooks.ts:124` exists; `docs/legal/privacy.md:55` | This is an Intuit-review compliance gap. Add the button to `QuickBooksIntegration.tsx`. |
| 1.10 | **Full calendar events (attendees, addresses) are JSON-dumped to the logs on every fetch.** | `GoogleCalendarService.ts:73-78`; `CronService.ts:301` | PII in logs. Remove the dumps. |
| 1.11 | **"Clear work activities" misses `invoice_line_items`.** | `server/src/services/AdminService.ts:114` | It fails on the foreign key once invoices exist. |

## 2. Out of date or at risk

| # | Finding | Where | Effort |
|---|---|---|---|
| 2.1 | **Production runs Node 18, which went end-of-life in April 2025.** Railway builds the root `Dockerfile` (`railway.json` sets no path). CI uses 22.x. Root `engines` says `>=18`, the server says `>=22`. `@types/node ^20` (Node 20 went EOL in April 2026). There's no `.nvmrc`. | `Dockerfile:2` and all `Dockerfile.*` | S |
| 2.2 | **Vulnerabilities roughly doubled after Plan 11.** Root: 65 (4 critical, 38 high). Server: 31 (1 critical, 9 high). A non-breaking `npm audit fix` clears root 4C+16H and server 1C+7H. | both `package.json` | S |
| 2.3 | **Dependabot has never run.** `dependabot.yml` is the unfilled template (`package-ecosystem: ""`), and repo alerts are disabled. That's why 2.2 went unnoticed. | `.github/dependabot.yml` | S |
| 2.4 | **The Claude model is two generations old** (`claude-sonnet-4-5-20250929`) and the SDK is `^0.54`. Blockers for moving to `claude-sonnet-5-5` / SDK 1.x: `temperature` set in 6 places (it returns 400 on the new models and API version); `response.content[0]` assumed to be text (a thinking block comes first) at `AnthropicService.ts:847`, which breaks Notion sync; the 55s `/api/chat` timeout (`server.ts:264`); no handling of `stop_reason: "refusal"`. | `server/src/constants.ts:2` | M |
| 2.5 | **Sessions live in express-session's default MemoryStore.** Everyone is logged out on every deploy, and memory grows over time. `connect-pg-simple` fits, since `pg` is already installed. | `server/src/server.ts:115` | S–M |
| 2.6 | **The AI scheduler reads Google Sheets (capped at 99 rows) or silent mock data, not Postgres.** Edits made in the app never reach the assistant. If Sheets is missing or errors, it invents helpers ("Sarah Martinez"). The roster and rules are hardcoded in prompts (Andrea, Virginia, Rebecca, "4-week cycles", "3 field days"). Travel time falls back to fake numbers with no flag saying so. | `SchedulingService.ts:26-36`, `GoogleSheetsService.ts:81-131,365-438`, `AnthropicService.ts:639-702`, `TravelTimeService.ts:29-51` | M–L |
| 2.7 | **CRA (`react-scripts` 5.0.1) is a dead end.** It pins TypeScript at 4.9 (the server is on 5.8) and 15 root highs have no fix. Plan 11 deferred Vite, but no plan was ever written. | root `package.json` | L |
| 2.8 | **The draft-js editor stack is unmaintained** (`react-draft-wysiwyg` was last published in 2022). It's behind all 6 unfixable root highs and blocks React 19. It's used in one file. | `WorkActivityEditDialog.tsx` | M |
| 2.9 | **`node-quickbooks` is still installed** (Plan 11.1.2 was never done) and drags in `underscore` (high). The QBO surface has grown since. | `server/package.json` | M |
| 2.10 | **The hourly-rate setting is ignored.** `default_hourly_rate` defaults to 50, but the client page uses `activity.hourlyRate \|\| 55` and invoice import falls back to 55. | `ClientDetail.tsx:1284,1295,1353`, `InvoiceService.ts:504` | S |
| 2.11 | **The NL-SQL prompt describes the schema as it was before #56** (text dates and money), hardcodes `'2025-01-01'`, and has a `::text` date comparison. It's harmless only while the endpoint stays disabled. | `NaturalLanguageSQLService.ts:220-335` | S |
| 2.12 | **CI never exercises the production migration path.** It runs `db:generate` + `db:push`, so schema drift writes a new migration silently instead of failing. | `.github/workflows/ci.yml:80-84` | S |
| 2.13 | Major upgrades worth scheduling: `@notionhq/client` 3→5, `googleapis` 126→188, express 4→5, helmet 7→8, MUI 5→9 together with x-date-pickers and date-fns 2→4. | — | M–L |

## 3. Cruft to delete (low risk, mostly S)

Every item has zero references in the repo per grep. Some endpoints could still be hit by hand with curl.

**Backend routes**
- `server.ts`: `GET /api/projects` (:238, shadowed by `projectsRouter`), `GET /api/settings` (:463, shadowed), `/api/helpers` (:215), `/api/context` (:431), `/api/schedule-optimization` (:442), `POST /api/travel-time` (:414), `/api/debug/health` (:315), `POST /api/debug/api-response` (:368, spends Anthropic tokens).
- Route files:
  - `auth.ts`: `/me`, `/test`, `/test-session`.
  - `migration.ts`: `/migrate`, `/clear`, `/employees`, `/clients`, `/test-sheets`. These duplicate `/api/admin/import-*`.
  - `notion.ts`: `/health`, `/templates`.
  - `notionSync.ts`: `/cancel` (a no-op; the UI's Stop button only closes the EventSource).
  - `admin.ts`: `/import-work-activities/preview/:clientName`, `/google-auth-config`.
  - `employees.ts`: `/active`, `/search`.
  - `settings.ts`: `/category/:category`, `GET`/`PUT`/`DELETE /:key`, `/billing/config`.
  - `breakTime.ts` and `travelTime.ts`: `/preview/:date`.
  - `quickbooks.ts`: `/customers/sync`, `/invoices/client/:clientId`, `/clients/:clientId/invoiceable-activities`.
- NL-SQL: `routes/naturalLanguageSQL.ts` (231 lines), `NaturalLanguageSQLService` (347), `NaturalLanguageSQL.tsx` (544). Delete them, or move them to a branch.
- `routes/notionSync.ts:308`: a default export that is never imported but still builds an extra `NotionSyncService` when the module loads.

**Backend methods and types**
- `NotionSyncService`: about 300 lines of dead private methods: `convertNotionPageToNaturalText`, `createWorkActivityFromStructuredData`, `applyHoursAdjustments`, `isNotionPageUpdated`, `getNumberProperty`.
- `AnthropicService.parseWorkNotes` (:882-1022, labeled "LEGACY METHOD - UNUSED"). Separately, the `@deprecated` tag on `normalizeEmployeeNames` (:1398) is wrong, because it's still used.
- `SchedulingService`: `generateScheduleReport`, `getScheduleConflicts`, `optimizeSchedule`, `getServiceZones`, `getBasicSchedulingSuggestions`. Also `GoogleSheetsService.getBusinessSettings`.
- Methods whose only reference is their own definition:
  - WorkActivityService: `findExistingWorkActivities`, `getWorkActivitiesByDateRange`, `getWorkActivityEmployees`
  - ClientService: `getActiveClients`, `getClientByClientId`, `searchClientsByName`
  - EmployeeService: `getEmployeeByEmployeeId`, `getEmployeeByName`, `getEmployeesByWorkdays`
  - ClientNotesService: `getNoteById`, `getNotesByType`
  - SettingsService: `getSettingValueParsed`, `setSettingValue`
  - QuickBooksService: `findInvoicesByCustomer`
  - DatabaseService: `getDb`, `formatDate`, `parseDate`
  - AuthService: the allowlist helpers
  - `logger.ts`: `logApiCall`, `logError`, `logPerformance`
  - `middleware/auth.ts`: `isAdmin`
- Container getters with no consumer: `services.notionSyncService`, `services.naturalLanguageSQLService`.
- Types: `MaintenanceCalendarEvent`, `SchedulingSuggestion` and `EventStatus` in `types/index.ts`. The `@deprecated` Helper/Client/Project types go together with 2.6.

**Dependencies**
- Server, unused: `connect-session-sequelize` (pulls in Sequelize; it's also the only reason for the `>=22` engines field), `@google-cloud/local-auth`, `axios` (never imported by server code), `google-auth-library` (likely unneeded; `googleapis` bundles it).
- Server, wrong section: move `drizzle-kit`, `@types/express-session`, `@types/passport*` and `commander` to devDependencies. Drop `ts-node` and `nodemon` in favor of `tsx watch`.
- Frontend, unused: `@mui/icons-material` (0 imports since the Lucide port), `web-vitals`, `@types/dompurify` (deprecated stub), `@testing-library/user-event`.

**Frontend**
- Components nothing renders: `CalendarTemplateGenerator.tsx` (487 lines) and `FilterableTable.tsx` (468).
- Unused exports in `src/services/api.ts`: `authApi`, `settingsApi`, `workActivitiesApi`, `travelApi`, `contextApi`, `helpersApi`, `notionApi.healthCheck`, plus 5 types and several `API_ENDPOINTS` keys.
- Five unused helpers in `utils/dateUtils.ts`. 24 unused icon re-exports in `src/icons/index.ts`. 6 unused `gc-*` classes in `tokens.css`.
- `src/config/api.ts` is the duplicate API client, still imported by 10 files (Plan 8.1).

**Scripts**
- Root `package.json`: `import-data` points at a file that doesn't exist, and the `db:*` scripts have no drizzle-kit dependency or config at the root. Delete them or forward them with `npm --prefix server`.
- `scripts/create_sample_work_activities.py` targets the old SQLite DB. `calendar_copier.py` and `calendar_lib.py` have no references; keep them only if you still use them by hand.
- `server/scripts/merge-duplicate-clients.ts` is a finished one-off. It has no transaction and doesn't re-point invoices.
- `server/scripts/clear-work-activities.ts` (`npm run clear-db`) is stale: it misses the `plant_list` and `invoice_line_items` foreign keys, and the Admin UI does the same job.
- `import-historical-data.ts`, `import-data.ts` and `test-historical-import.sh` look like finished one-offs that the Admin import replaces (suspected).

**CI, Docker, config**
- `.github/workflows/claude-code-review.yml` is entirely commented out, so GitHub marks it **failed on every push**. Delete it, and delete `simple-ci.yml.disabled` too.
- `billable-hours-tests.yml` and `quick-test.yml` duplicate `ci.yml`. The `quality-checks` job runs `npm audit` with `continue-on-error` and prints a hardcoded summary. `ci.yml` triggers on a nonexistent `develop` branch, and no workflow uses npm caching. `claude.yml` is pinned to `@beta`.
- `Dockerfile.backend.dev` and `Dockerfile.frontend.dev` aren't referenced by any compose file. All three compose files carry the obsolete `version:` key.
- The prod `Dockerfile` is single-stage and ships every CRA dependency, still creates a "SQLite data directory", and `server/tsconfig.json` compiles `__tests__` into `dist`.
- `.dockerignore` doesn't exclude `google-account-key.json` (it gets copied into locally built images) and still lists the removed `design docs/`.
- `railway.json` has no `healthcheckPath` (`/api/health` exists) and no `watchPatterns`, so docs-only commits redeploy.
- `jest.config.ci.js` and `test:ci` are unused, even though `CI_TEST_SETUP.md` says to use them.

**Logging**: server code has 360 `console.*` calls against 438 `debugLog` calls. The worst files are AnthropicService (81), InvoiceService (39), server.ts (36) and GoogleCalendarService (25). The frontend has 41 `console.log`s, including `navigator.userAgent` in `notionApi`.

**Local-only leftovers (not in git)**
- `venv/` (117 MB).
- `server/data/blossom-and-bough.db`: a SQLite file from June 2025 that **may contain real client data**.
- `server/database.db` (empty), `server/logs` (6.6 MB), stale `build/` and `server/dist`.
- 28 local branches already merged, and 14 conductor worktrees.
- Local `node_modules` don't match the lockfiles. Run `npm ci` in both directories before working.

## 4. Docs out of date

- **`docs/plans/README.md` status table**: see section 5.
- **`CLAUDE.md`**
  - Lists `WorkNotesParserService` (deleted).
  - Missing services: Invoice, QuickBooks, Notification, Settings, Cron, Admin, ProductionPull, time allocation, `container.ts`.
  - Missing components: Invoices, Reports, Settings, Notifications, ReviewFlow.
  - Missing tables: invoices, `qbo_*`, settings, notifications, plant_list.
  - Doesn't mention the design system (`src/theme/tokens.*`, Lucide icon registry) and still says "use Material-UI".
  - Says `server/.env`, but `server.ts:45` loads the root `.env`.
  - "All routes protected except /api/auth/*" is false.
- **`README.md`** is from the prototype era:
  - It describes "Mock Data (default)" with Google Sheets as the data source.
  - Its "Future" list includes invoicing and reports, which now exist.
  - The Codecov badges still say `YOUR_USERNAME`, and it tells you to enable the Google+ API.
  - It contradicts itself on Node (22+ / 18–20).
- **Env docs** are missing:
  - `CSRF_SECRET`, which is **required at boot in prod**
  - `CRON_AUTH_TOKEN`
  - all `QBO_*`, including `QBO_TOKEN_ENCRYPTION_KEY`, which throws if missing
  - `DATA_EXPORT_SECRET`, `PROD_API_URL`, `GOOGLE_CALENDAR_ID`, `CRON_ENABLED`, `NOTION_TEMPLATE_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY(_FILE)`
  - the `REACT_APP_*` vars and `PROXY_TARGET`
- **Other docs**
  - `server/README_TESTING.md` documents test files that were removed in 4921c9c.
  - Three docs reference `WorkNotesParserService`.
  - `docs/setup/ci-cd.md` says Node 20 and Codecov.

## 5. Actual status of the May 2026 plans

| # | Plan | Table says | Actually |
|---|---|---|---|
| 1 | Security hardening | In review | ✅ Merged (#54) |
| 2 | Data integrity | 2.1–2.4 merged, 2.5 won't do | Accurate |
| 3 | Background jobs | Not started | Not started; still applies (in-memory Maps in `admin.ts:9,16`, broken cleanup math at `admin.ts:458`) |
| 4 | Query performance | Not started | Not started; still applies (no FK indexes; N+1 at `WorkActivityService.ts:157`; Dashboard fetches every activity) |
| 5 | Integration efficiency | Not started | Not started; still applies (no `cache_control`; `findCustomers({})`) |
| 6 | Frontend bundle | Not started | Not started; still applies (no `React.lazy`) |
| 7 | Backend architecture | Not started | 🟡 7.7 done (#66); the rest still applies |
| 8 | Frontend foundation | Not started | Not started; still applies |
| 9 | God-class decomposition | Not started | 🟡 Started (#61 extracted pure Notion helpers). Line counts in the plan are stale |
| 10 | Test coverage | Not started | 🟡 Partial (#61, #62, #63); employees/break/travel route tests and frontend tests still missing |
| 11 | Tooling & hygiene | Not started | ✅ Merged (#59), but 11.1 has regressed (see 2.2) and 11.1.2 / the Vite follow-up were never done |
