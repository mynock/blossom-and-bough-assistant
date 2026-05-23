# Plan 3 — Background Job Reliability

**Findings**: #13
**Effort**: 1 week
**Tier**: 📉 Medium

## Why

Long-running operations (Notion sync, historical imports, production pull) run as fire-and-forget IIFEs with progress stored in process-local `Map`s. A redeploy mid-job loses state; the polling client gets a 404 on its next check. The cleanup logic at `admin.ts:455-464` is also broken (`Date.now() - new Date().getTime() ≈ 0`). Multi-instance deployment is impossible because state isn't shared.

## Approach

- **Files**:
  - `server/src/routes/admin.ts:9-13, 16-20, 371-414, 530-592`
  - `server/src/services/CronService.ts:139-223, 249-400`
  - `server/src/services/NotionSyncService.ts` (sync entry points)
- **Steps**:
  1. `npm i pg-boss` in `server/`. Postgres already in use, so no new infra.
  2. Initialize a `JobQueue` singleton in `server/src/services/JobQueue.ts`; start it from `server.ts`.
  3. Define jobs: `import-work-activities`, `pull-from-production`, `notion-sync`, `daily-maintenance-entries`. Each handler accepts a typed payload + a `progress(percent, message)` callback that persists to the `pgboss.job` table.
  4. Routes enqueue via `jobQueue.send('notion-sync', payload)` and return `{ jobId }`. A new `GET /api/jobs/:id` returns persisted status.
  5. Migrate `CronService` from `node-cron` to `pg-boss`'s `schedule()` — also gives distributed locking for free (current `processingLocks` map is in-memory only).
  6. Delete the `activeImports` / `activePulls` Maps and the broken cleanup logic at `admin.ts:455-464`.

## Verify

- Start a long sync; kill the server mid-run; restart → job status shows the prior run + new attempt; client polling continues without 404.
- Two server instances running simultaneously → only one cron firing per scheduled tick.
- `GET /api/jobs/:id` returns the same status after a process restart (state survives).
