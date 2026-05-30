# AGENTS.md

Agent-facing guidance that complements `CLAUDE.md`. Keep this short and rule-shaped — patterns that are easy to miss because they only fail in production, not locally.

## Frontend: every state-changing request must use `secureFetch`

`server/src/server.ts` mounts `doubleCsrfProtection` globally. In **production**, every non-GET/HEAD/OPTIONS request must carry an `X-CSRF-Token` header or the server returns 403. CSRF is silently bypassed in dev (MemoryStore sessions don't survive backend restarts), so a bare `fetch()` will *appear to work locally* and then break in prod.

**Rule**: when writing or reviewing frontend code, any `fetch()` with `method` `POST`, `PUT`, `PATCH`, or `DELETE` against `/api/...` must use `secureFetch` from `src/services/csrf.ts`.

```ts
// ❌ Wrong — works in dev, 403s in prod.
await fetch('/api/qbo/invoices/sync-all', { method: 'POST', body: ... });

// ✅ Right — attaches X-CSRF-Token + credentials.
import { secureFetch } from '../services/csrf';
await secureFetch('/api/qbo/invoices/sync-all', { method: 'POST', body: ... });
```

`secureFetch` also adds `credentials: 'include'`, so you don't need to pass that separately.

Exceptions: routes explicitly listed in `skipCsrfProtection` in `server/src/server.ts` (`/api/health`, `/api/csrf-token`, `/api/auth/*`, `/api/notion/*`, `/api/cron/*`, `/api/data-export*`). Everything else needs the token.

## Backend: pass `tx` through service composition

`DatabaseService` exports `DbOrTx`. Service methods that need to participate in a caller's transaction should accept `tx?: DbOrTx` and `conn = tx ?? this.db` (see `WorkActivityService.setStatus` for the pattern). Avoid raw `tx.insert(...)` from outside a service — add the `tx?` overload to the owning service instead.
