# Plan 8 — Frontend Foundation

**Findings**: #25, #26
**Effort**: 1 week
**Tier**: 🏗️ Debt

## Why

4 competing API client patterns, no server cache, no 401 handling, `WorkActivity` type defined 10× and already drifted. These two changes remove ~30% of every component's code and unlock cleaner downstream refactors (Plan 9).

## 8.1 — Unify API client + add React Query (Finding #25)

- **Files**: `src/config/api.ts` (delete), `src/services/api.ts` (canonical), `src/contexts/AuthContext.tsx`, all 14+ components using raw `fetch()` or local `axios.create()`
- **Problem**:
  - `src/services/api.ts` (axios) — 8 importers
  - `src/config/api.ts` (fetch wrapper, marked `@deprecated`) — still imported by 10 files including `AuthContext.tsx`
  - Local `axios.create()` in `NotionSync.tsx:47`, `Admin.tsx:66`, `NaturalLanguageSQL.tsx`
  - Raw `fetch()` in 14 files (55 occurrences)
  - `ClientDetail.tsx` uses raw `fetch()` exclusively (13 calls)
  - Zero 401/403 handling anywhere — session expiry shows as random "Failed to load X" toasts
  - No React Query / SWR: 191 `setLoading`/`setError`/`setSaving` calls across 24 files
- **Approach**:
  1. Audit `src/config/api.ts` imports (10 files); migrate each to `src/services/api.ts`. Then delete `src/config/api.ts`.
  2. Move `API_ENDPOINTS` constants into `src/services/api.ts` with consistent leading `/api/` paths.
  3. Add axios response interceptor: 401 → `window.dispatchEvent(new CustomEvent('auth:expired'))`; `AuthProvider` listens and calls `setUser(null)`.
  4. `npm i @tanstack/react-query`; wrap `<App />` in `<QueryClientProvider>`.
  5. Co-locate hooks with API layer: `services/api.ts` exports `useWorkActivities(filters)`, `useClient(id)`, `useUpdateWorkActivity()`, etc.
  6. Cache keys: `['work-activities', filters]`, `['clients', id]`, `['clients', id, 'work-activities']`.
  7. Migrate file-by-file: start with `Dashboard.tsx` and `ClientDetail.tsx` (most state to retire).
  8. Replace local `axios.create()` in `NotionSync.tsx:47`, `Admin.tsx:66`, `NaturalLanguageSQL.tsx` with the canonical client.
  9. Add ESLint rule `no-restricted-globals: ['error', 'fetch']` after migration complete.
- **Verify**: `grep -rn "fetch(" src/` returns empty (or only inside `services/`). Session expiry → automatic redirect to login. Mutating a work activity in one component invalidates other components' caches.

## 8.2 — Canonical entity types (Finding #26)

- **Files**: `src/types/entities.ts` (new); 10+ component files declaring `interface WorkActivity` / `Client` / `Employee` / `OtherCharge`
- **Problem**: `WorkActivity` defined in 10 files; `Client` in 3; `Employee` in 4. Definitions have already drifted — `services/api.ts:193` has 14 fields; `WorkActivityEditDialog.tsx:37` has 27 fields. `priorityLevel` is `string` in one and `'High' | 'Medium' | 'Low'` in another (causes the `as any` at `ClientDetail.tsx:617`).
- **Approach**:
  1. Create `src/types/entities.ts` exporting `WorkActivity`, `Client`, `Employee`, `Project`, `OtherCharge`, `PlantListItem`, `ClientNote`. Use the most complete shape (typically from `*EditDialog.tsx` files).
  2. **Bonus**: Use `drizzle-zod` to generate types from `server/src/db/schema.ts` and share via a `shared/` package — this prevents future drift permanently.
  3. Replace local interface declarations with `import { WorkActivity } from '../types/entities'`.
  4. ESLint rule: `no-restricted-syntax: TSInterfaceDeclaration[id.name=/^(WorkActivity|Client|Employee|Project)$/]` outside `src/types/`.
  5. Tighten unions where text was used: `priorityLevel: 'High' | 'Medium' | 'Low'`, `status: 'planned' | 'in_progress' | ...`. Removes the `as any` at `ClientDetail.tsx:617`.
- **Verify**: `tsc --noEmit` passes. Adding a new field to `WorkActivity` requires touching exactly 1 file (+ Drizzle schema if shared).
