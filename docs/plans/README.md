# Architectural Remediation Plans

A portfolio of independent, executable plans for addressing findings from a multi-agent architectural review of the codebase. Each plan is self-contained — an agent (or developer) given a single plan should be able to execute it without reading the others. Cross-plan dependencies are called out where they exist.

## Context

A multi-agent architectural review of the codebase surfaced 32 substantial findings spanning security, data integrity, performance, frontend architecture, backend architecture, and code quality. They fall into known categories: critical security gaps, silent data-loss risks, performance ceilings that will hit at moderate scale, and architectural debt that slows feature work.

Finding #7 ("all authenticated users are admins") is intentionally omitted from these plans — the app is only used by ~2 people, so role-separation isn't worth doing yet.

Finding #12 (FK on-delete behavior, Plan 2.5) is intentionally skipped — see `02-data-integrity.md` for rationale. Same scale reasoning: `NO ACTION` fails loudly today, and a `deleted_at`-everywhere change isn't justified at ~2 users.

## Index

| # | Plan | Findings | Effort | Tier | Status |
|---|---|---|---|---|---|
| 1 | [Security Hardening](./01-security-hardening.md) | #1, #2, #3, #4, #5, #6 | 2–3 days | 🚨 Urgent | 🟡 In review ([#54](https://github.com/mynock/blossom-and-bough-assistant/pull/54)) |
| 2 | [Data Integrity & Schema](./02-data-integrity.md) | #8, #9, #10, #11, ~~#12~~ | 1.5 weeks | 🚨 Urgent | 🟢 2.1–2.4 merged · 2.5 🚫 won't do |
| 3 | [Background Job Reliability](./03-background-jobs.md) | #13 | 1 week | 📉 Medium | ⚪ Not started |
| 4 | [Query Performance](./04-query-performance.md) | #14, #15, #19 | 1 week | 📉 Urgent-soon | ⚪ Not started |
| 5 | [Integration Efficiency](./05-integration-efficiency.md) | #16, #17, #18 | 4–5 days | 📉 Medium | ⚪ Not started |
| 6 | [Frontend Bundle & Rendering](./06-frontend-bundle.md) | #20 | 1–2 days | 📉 Medium | ⚪ Not started |
| 7 | [Backend Architecture Cleanup](./07-backend-architecture.md) | #21, #22, #23, #24, #29, #30, #31 | 2 weeks | 🏗️ Debt | ⚪ Not started |
| 8 | [Frontend Foundation](./08-frontend-foundation.md) | #25, #26 | 1 week | 🏗️ Debt | ⚪ Not started |
| 9 | [God Class Decomposition](./09-god-class-decomposition.md) | #27 (4 sub-plans) | 2–3 weeks | 🏗️ Debt | ⚪ Not started |
| 10 | [Test Coverage Foundation](./10-test-coverage.md) | #28 | 1–2 weeks | 🏗️ Enabler | ⚪ Not started |
| 11 | [Tooling & Hygiene](./11-tooling-hygiene.md) | #32 + repo cleanup | 1 day | 🧹 Cleanup | ⚪ Not started |

**Status legend:** ⚪ Not started · 🟡 In review · ✅ Merged · ⏸️ Paused · 🚫 Won't do

## Cross-Plan Dependency Graph

```
Plan 1 (Security) ──── independent ──── ship anytime
Plan 2 (Data Integrity)
  ├─ 2.1 (transactions) ── independent ── ship first
  └─ 2.2-2.4 ─────── independent migrations (2.5 won't do)
Plan 3 (Background Jobs) ── independent ── ship anytime
Plan 4 (Query Perf)
  ├─ 4.1 (indexes) ── ship first
  └─ 4.2-4.5 ─── benefits multiply with 4.1
Plan 5 (Integration Perf) ── independent ── ship anytime
Plan 6 (Frontend Bundle) ── independent ── ship anytime
Plan 7 (Backend Arch Cleanup)
  ├─ 7.5 (config) ── enables 7.7 (QBO OAuth secrets)
  ├─ 7.1 (DI) ── enables removal of AnthropicService hack in 9.2
  └─ 7.2-7.4, 7.6 ── independent
Plan 8 (Frontend Foundation)
  ├─ 8.2 (types) ── ship first; enables cleaner 8.1
  └─ 8.1 (API + React Query) ── enables cleaner 9.4
Plan 9 (God Class Splits) ─── REQUIRES Plan 10 (tests) ─── frontend splits benefit from Plan 8
Plan 10 (Tests) ─── enables Plan 9 ─── ship before Plan 9
Plan 11 (Hygiene)
  └─ both items independent ── ship anytime
```

## Suggested Execution Order (if doing sequentially)

1. **Week 1 — stop the bleeding**: Plan 1 (all), Plan 2.1 (transactions), Plan 11 (hygiene)
2. **Week 2 — make it fast**: Plan 4 (all), Plan 5.1 (Anthropic caching)
3. **Week 3 — make it correct long-term**: Plan 2.2–2.4 (types + constraints), Plan 5.2 (Notion sync), Plan 5.3 (QBO)
4. **Week 4 — frontend foundation**: Plan 8.2 → Plan 8.1, Plan 6
5. **Weeks 5–6 — backend architecture**: Plan 7.5 → Plan 7.1, then 7.2, 7.3, 7.4, 7.6, 7.7
6. **Weeks 7–8 — testing foundation**: Plan 10
7. **Weeks 9–11 — decomposition**: Plan 9.1 → 9.2 → 9.3 → 9.4 (after Plan 10 lands)
8. **Anytime in parallel**: Plan 3 (background jobs)

## Verification (cross-cutting)

After any plan ships:
- `cd server && npm run type-check` and `npm run build` — both pass
- `cd server && npm test` — existing tests still pass
- `npm run type-check` (frontend) and `npm run build:production` — both pass
- Smoke test: log in, view dashboard, view a client detail, edit a work activity, run a Notion sync, generate an invoice. All work.
- For data-touching plans: take a `pg_dump` snapshot before running migrations; verify row counts and key invariants (`SELECT SUM(billable_hours) FROM work_activities WHERE date >= '2024-01-01'`) unchanged unless the plan explicitly modifies them.
