# Plan 11 — Tooling & Hygiene

**Findings**: #32 + repo cleanup items
**Effort**: 1 day
**Tier**: 🧹 Cleanup

## Why

28 server-side dependency vulnerabilities (3 critical, 10 high) + 61 frontend. Plus accumulated dead files and duplicate configs at the repo root that confuse new contributors.

## 11.1 — Dependency vulnerabilities (Finding #32)

- **Files**: `package.json`, `server/package.json`
- **Notable critical/high**:
  - `axios <1.12.0` (server uses `^1.5.0`) — DoS (CVSS 7.5) and SSRF
  - `fast-xml-parser` (via `node-quickbooks`) — critical: entity-encoding bypass, DoS
  - `form-data <2.5.4` (via `node-quickbooks`) — critical: unsafe boundary RNG
  - `underscore` (via `node-quickbooks`) — high: unlimited recursion DoS
  - `validator <=13.15.20` — high: URL-validation bypass
- **Approach**:
  1. `npm audit fix` in both — apply all non-breaking patches.
  2. Replace or wrap `node-quickbooks` (drags `fast-xml-parser`, `form-data`, `underscore` vulnerabilities). Option A: pin to a maintained fork. Option B: write a thin wrapper around QBO's REST API with `axios` and drop the SDK.
  3. Bump axios to `^1.12.0`+ for the SSRF fix.
  4. Plan a follow-up migration off CRA → Vite (out of scope for this plan).
- **Verify**: `npm audit` shows no critical/high vulns. App still runs.

## 11.2 — Repo cleanup

- **Files (delete)**:
  - `test_work_notes_import.py` (orphaned — calls non-existent endpoints `/api/work-notes/parse` and `/api/work-notes/templates`)
  - `.env.example` (keep `env.example` — the longer, accurate one; the shorter version references SQLite which was migrated off)
  - `design docs/` folder (with space; move `nadler_invoice.pdf` to `docs/design/`)
  - `scripts/calendar_enhancer.py` (verify unused first)
  - `server/src/types/index.d.ts` (duplicate of `quickbooks.d.ts`)
- **Files (also consider, but verify dependencies first)**:
  - Legacy type system in `server/src/types/index.ts:36-110` (`Helper`/`Client`/`Project` interfaces marked `@deprecated`). Only valuable to delete if [Plan 7.1](./07-backend-architecture.md) migrates `SchedulingService`/`GoogleSheetsService`/`AnthropicService` off legacy shapes first.
- **Verify**: `npm run type-check` passes after each deletion. No references found via `grep -rn '<filename>' .`.
