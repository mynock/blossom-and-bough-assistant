# Plan 10 — Test Coverage Foundation

**Findings**: #28
**Effort**: 1–2 weeks
**Tier**: 🏗️ Enabler

## Why

4 test files exist, all on billable-hours math + reports date helpers. Zero coverage on the highest-risk surfaces (`NotionSyncService`, `AnthropicService`, all routes, all React components). [Plan 9 (god class decomposition)](./09-god-class-decomposition.md) cannot ship safely without this.

## Approach

- **Files**:
  - `server/src/__tests__/routes/*.test.ts` (new) — supertest-based integration tests
  - `server/src/services/__tests__/*.test.ts` (new) — pure unit tests for parsers/matchers
  - `src/components/__tests__/*.test.tsx` (new) — RTL-based render tests
- **Steps**:
  1. **Integration tests for top 5 routes** (`workActivities`, `clients`, `employees`, `breakTime`, `travelTime`): use `supertest` + a test database from `server/scripts/migrate-and-exit.js`. Cover CRUD happy paths + auth rejection.
  2. **Unit tests for `NotionSyncService` extractors** (after [Plan 9.1](./09-god-class-decomposition.md) split — or do these in parallel by extracting just the pure functions first): test `NotionPageParser`, `ClientMatcher`, `WorkActivityMapper` as pure functions with fixture data.
  3. **Render tests for top 5 frontend components**: `Dashboard`, `ClientDetail`, `WorkActivityReviewFlow`, `WorkActivitiesTable`, `Reports` — render with mock API responses (MSW), assert key elements present + key user interactions fire correct mutations.
  4. Wire `npm test` into CI on every PR.

## Verify

- `npm test` passes both server and frontend.
- Coverage report shows ≥40% on services + ≥30% on routes (vs. current ~5%).
- CI fails any PR that breaks an existing test.
