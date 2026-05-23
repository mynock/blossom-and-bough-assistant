# Plan 9 — God Class Decomposition

**Findings**: #27 (4 sub-plans)
**Effort**: 2–3 weeks
**Tier**: 🏗️ Debt

## Why

Four files past the threshold where additional features cost more than they deliver. Splits are designed to make domain testing possible and unblock parallel work by multiple engineers.

## 🚧 Prerequisite

**This plan requires [Plan 10 (Test Coverage Foundation)](./10-test-coverage.md) for the `NotionSyncService` and `AnthropicService` paths.** Frontend components (9.3 and 9.4) can be split safely with render tests in place.

Also benefits from:
- [Plan 7.1 (DI container)](./07-backend-architecture.md) before 9.2 (removes circular-dep hack)
- [Plan 8 (Frontend Foundation)](./08-frontend-foundation.md) before 9.4 (cleaner `useClientData` hook)

## 9.1 — Split `NotionSyncService` (1987 lines)

- **Files**: `server/src/services/NotionSyncService.ts`
- **Target modules** (all in `server/src/services/notion/`):
  - `NotionClient.ts` — wraps `@notionhq/client`, no business logic (~100 lines)
  - `NotionPageParser.ts` — `get*Property`, `parse*`, `extractTextFromRichText`, `extractClientNameFromNotionPage`, `extractDateFromNotionPage` (~400 lines, stateless utility class)
  - `NotionPageContentParser.ts` — `getPageContent`, `parseChargeFromText` (~300 lines)
  - `ClientMatcher.ts` — `calculateSimilarity`, `findBestClientMatch`, `ensureClientExists` (~150 lines)
  - `EmployeeMatcher.ts` — name variants + matching (~100 lines)
  - `WorkActivityMapper.ts` — parsed Notion data → `CreateWorkActivityData` (pure functions, ~200 lines)
  - `NotionSyncOrchestrator.ts` — `syncNotionPages`, `processSingleNotionPage`, SSE progress (~300 lines, only this one has DI dependencies)
- **Approach**: Build new modules with tests, then incrementally replace methods on the existing service, then delete the old class once parity confirmed. Use [Plan 2.1](./02-data-integrity.md) transaction wrappers in `WorkActivityMapper` consumers.
- **Verify**: New unit tests pass for parsers (no DB/Notion needed — pure functions). Integration test against a fixture Notion page returns same result as the prior implementation.

## 9.2 — Split `AnthropicService` (1565 lines)

- **Files**: `server/src/services/AnthropicService.ts`
- **Target modules** (in `server/src/services/anthropic/`):
  - `AnthropicClient.ts` — SDK wrapper + retry + cache headers (~80 lines)
  - `SchedulingTools.ts` — tool schema definitions + dispatch table (pure data + small dispatch fn, ~250 lines)
  - `SchedulingChatService.ts` — `getSchedulingRecommendation`, tool-call loop (~400 lines, depends on SchedulingService)
  - `WorkNotesParser.ts` — `parseWorkNotes` (~200 lines)
  - `HistoricalSheetParser.ts` — `parseHistoricalSheetData` + batching/progress (~300 lines)
  - `InvoiceLineItemGenerator.ts` — `generateInvoiceLineItems` (~150 lines)
  - `NotionDataExtractor.ts` — `processStructuredNotionData` (~150 lines, used by NotionSyncService)
- **Approach**: Eliminates the circular-dep `setSchedulingService` hack — `SchedulingChatService` simply receives `SchedulingService` via constructor injection ([Plan 7.1](./07-backend-architecture.md)).
- **Verify**: `/api/chat` returns identical responses to a known query before/after split. Tool execution still works.

## 9.3 — Split `WorkActivityReviewFlow.tsx` (2281 lines)

- **Files**: `src/components/WorkActivityReviewFlow.tsx`
- **Target modules** (in `src/components/workActivityReview/`):
  - `WorkActivityReviewFlow.tsx` (~400 lines) — top-level orchestrator
  - `ReviewCarousel.tsx` (~250 lines) — single-activity card + next/prev/skip
  - `BulkAllocationStep.tsx` (~400 lines) — wraps existing `TravelTimeAllocation`/`BreakTimeAllocation`
  - `hooks/useReviewQueue.ts` — currentIndex, approvedActivityIds, navigation (~80 lines)
  - `hooks/useBulkTravelTimeAllocation.ts` (~200 lines)
  - `hooks/useBulkBreakTimeAllocation.ts` (~200 lines)
  - `utils/workActivityCalculations.ts` — `calculateBillableHours`, `distributeHoursProportionally` (pure, testable, ~40 lines)
- **Critical**: Delete the inline 240-line edit dialog (lines 1735-1995). Use existing `<WorkActivityEditDialog>` with a new `mode="quick-review"` prop that hides charges/plants sections. Saving from the current inline dialog silently drops edits to charges/plants — this is a real bug being fixed.
- **Verify**: All review flow user actions still work (approve, skip, edit, bulk allocate). Render tests on each extracted component pass.

## 9.4 — Split `ClientDetail.tsx` (1462 lines)

- **Files**: `src/components/ClientDetail.tsx`
- **Target modules** (in `src/components/clientDetail/`):
  - `ClientDetail.tsx` (~300 lines) — tabs/layout
  - `ClientEditDialog.tsx` (~250 lines) — extract from inline dialog at line 1232+
  - `ClientInvoiceCreator.tsx` (~300 lines) — extract from lines 490-540, 802-880, 950-1228
  - `ClientNoteEditor.tsx` (~150 lines) — extract notes dialog
  - `hooks/useClientData.ts` — React Query wrapper returning `{ client, workActivities, summary, schedule, notes }`
- **Approach**: Once React Query is in place ([Plan 8.1](./08-frontend-foundation.md)), `useClientData` replaces the 4 sequential `useEffect` fetches and prevents the artificially-slow page load.
- **Verify**: Client detail page renders identically. All CRUD actions (edit client, add note, create invoice, edit activity) still work.
