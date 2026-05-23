# Notification Center (Follow-Up)

Status: **Proposed — not yet built.**

## Motivation

Several background processes (Notion sync, cron jobs, future imports) produce
events that the user needs to *eventually* act on but that shouldn't block the
operation that produced them. Today these events are surfaced inconsistently:

- Some are returned as `warnings: string[]` on a sync response and shown only
  on the page that triggered the sync.
- Some only land in server logs.
- None of them persist — close the tab and the signal is gone.

This makes it easy to miss things that genuinely need a human, e.g. an
auto-created employee record from a Notion typo (see
[`NotionSyncService.resolveTeamMembers`](../../server/src/services/NotionSyncService.ts)).

## What needs to exist

A central, persistent place where the app records "something happened that you
should probably review" — and a UI surface that makes those events visible
across the app, not just on the page that produced them.

### Triggering cases (initial)

1. **Auto-created employees from Notion sync.** Currently surfaced as an
   in-line warning on the sync result. The new employee has
   `notes: 'Auto-created from Notion sync - please review and update'`. The
   notification should link directly to the employee detail page and the
   originating Notion page.
2. **Ambiguous employee matches.** When a Notion team-member name matches
   multiple DB employees (e.g. two "Anne"s), `findEmployeeMatch` now refuses
   the match and auto-creates instead. The notification should explain the
   ambiguity so the user can merge.
3. **Auto-created clients** (`ensureClientExists`) — same pattern.
4. **Failed cron runs** (Notion maintenance cron, etc.).
5. **Hours adjustments that couldn't be parsed.**

### Suggested shape

- New table `notifications` with: `id`, `type` (enum), `severity`
  (info/warn/error), `title`, `body`, `link`, `entity_type`, `entity_id`,
  `created_at`, `read_at`, `dismissed_at`.
- A `NotificationService` with `create()` / `list()` / `markRead()` /
  `dismiss()`.
- A bell-icon in the app chrome that shows the unread count and opens a panel.
- A dedicated `/notifications` page for the full history with filters.

### Migration of existing call sites

- Replace `warnings: string[]` on sync responses with notification records.
  Keep the in-line warning on the immediate sync result (still useful), but
  also write a notification so it persists.
- Audit `debugLog.warn` calls that represent user-actionable events and
  promote them to notifications.

## Non-goals

- Real-time push / websockets. Polling on app load is fine for v1.
- Email/SMS delivery.
- Per-user routing. Single-tenant for now.

## Tracking

This doc exists so the auto-create warnings added in commit `6a3fd4e` aren't
the last we hear of this need. When this is built, the relevant code paths
in `NotionSyncService` (`resolveTeamMembers`, `ensureClientExists`,
hours-adjustment parsing) should switch from `warnings: string[]` to writing
notification records.
