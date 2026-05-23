# Plan 1 — Security Hardening

**Findings**: #1, #2, #3, #4, #5, #6
**Effort**: 2–3 days
**Tier**: 🚨 Urgent

## Why

Six exploitable gaps. The most severe (#1) lets any authenticated user run arbitrary SQL; #2 + #3 + #4 together make a one-typo full-takeover. #5 is stored XSS via Notion content. #6 lets any Notion workspace worldwide trigger admin actions on a logged-in user.

## 1.1 — Disable arbitrary-SQL endpoint (Finding #1)

- **Files**: `server/src/routes/naturalLanguageSQL.ts`, `server/src/services/NaturalLanguageSQLService.ts:123-132`
- **Problem**: User input → Claude → regex extraction → `db.execute(sql.raw())` with the app's full-privilege Postgres connection. Zero allowlist, zero SELECT-only enforcement, no statement timeout, no row limits. Any authenticated user can craft a prompt that returns `DROP TABLE`, `UPDATE`, or `pg_sleep(3600)` and the server will execute it.
- **Approach**:
  1. Comment out the route mount in `server/src/server.ts` first (5 min, eliminates risk while planning hardening).
  2. To re-enable safely: (a) create a read-only Postgres role; (b) instantiate a separate `Pool` in `NaturalLanguageSQLService` using it; (c) parse generated SQL with `pg-query-parser` or similar — reject anything whose top-level statement isn't `SELECT`; reject references to `pg_*` / `information_schema`; (d) `SET LOCAL statement_timeout = '5s'`; (e) append `LIMIT 1000` if missing; (f) log every query to an audit table with requesting user email.
- **Verify**: Attempt `"DROP TABLE clients"` → rejected. Attempt `"SELECT * FROM pg_user"` → rejected. Attempt `"; UPDATE clients SET ..."` injection → rejected. Read-only role attempt at write → permission error.

## 1.2 — Fail-closed authentication (Findings #2, #3)

- **Files**: `server/src/middleware/auth.ts:31-36`, `server/src/server.ts:93`
- **Problem**: If `GOOGLE_OAUTH_CLIENT_ID` or `GOOGLE_OAUTH_CLIENT_SECRET` is unset, `requireAuth` returns `next()` with a warning. One typo during a deploy opens every protected route. Also `secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production'` — if `SESSION_SECRET` is unset, anyone can forge admin session cookies.
- **Approach**:
  1. At top of `server.ts`: `if (process.env.NODE_ENV === 'production' && (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET || !process.env.SESSION_SECRET)) throw new Error('Missing required auth env vars')`.
  2. Remove the silent-bypass branch in `auth.ts:31-36`. If OAuth not configured, return 503 from middleware, never `next()`.
  3. Delete the `'your-secret-key-change-in-production'` fallback in `server.ts:93`; require the env var.
  4. Dev bypass at `auth.ts:18-29` must also assert `NODE_ENV === 'development'`.
- **Verify**: Unset `SESSION_SECRET` locally → server refuses to start in production mode. Unset OAuth vars → all protected routes return 503.

## 1.3 — Secure session cookies (Finding #4)

- **Files**: `server/src/server.ts:90-102`
- **Problem**: `secure: false` is hardcoded. Cookies travel over HTTP. Anyone on the same wifi captures the session.
- **Approach**:
  1. `cookie.secure: process.env.NODE_ENV === 'production'`
  2. `saveUninitialized: false`
  3. Add `app.set('trust proxy', 1)` so Express honors `X-Forwarded-Proto` from the load balancer.
- **Verify**: In production, inspect `Set-Cookie` → contains `Secure; HttpOnly; SameSite=Lax`. Locally, cookies still work over HTTP.

## 1.4 — Sanitize Notion-sourced HTML (Finding #5)

- **Files**: `src/components/WorkActivityDetail.tsx:521,535`; `src/components/ClientNotesList.tsx:248`; `src/components/WorkActivitiesTable.tsx:521,543`; `server/src/server.ts:583` (CSP for `/notion-embed`)
- **Problem**: `activity.notes` and `activity.tasks` rendered with `dangerouslySetInnerHTML` without sanitization. These fields are populated from a WYSIWYG editor and AI-parsed Notion pages (user-controlled). The `/notion-embed` CSP allows `'unsafe-inline'` for script-src, so the embed iframe is fully exploitable.
- **Approach**:
  1. `npm i dompurify @types/dompurify` in the root package.
  2. Create `src/utils/sanitizeHtml.ts` exporting `sanitize(html: string): string` using DOMPurify with a restrictive allowlist (strip `<script>`, `on*` handlers, `javascript:` URLs).
  3. Wrap every `dangerouslySetInnerHTML={{ __html: x }}` with `__html: sanitize(x)`.
  4. Remove `'unsafe-inline'` from `scriptSrc` in the `/notion-embed` CSP block.
- **Verify**: Manual XSS payload (`<img src=x onerror=alert(1)>`) in a Notion note → renders as inert text in the work activities table. Embed page no longer allows inline scripts (check console).

## 1.5 — Narrow CORS + add CSRF (Finding #6)

- **Files**: `server/src/server.ts:65-85`
- **Problem**: `^https://.*\.notion\.so$` is a wildcard match across Notion's multi-tenant domain. Combined with no CSRF tokens and `credentials: true`, any Notion user worldwide can publish a page that triggers `POST /api/admin/clear-all-data` against a logged-in admin.
- **Approach**:
  1. Replace the `^https://.*\.notion\.so$` wildcard with the exact embed origin(s) Notion uses for iframes — or split the API into `/api/embed/*` (no credentials, narrow CORS) vs `/api/*` (credentials, no Notion origin).
  2. `npm i csurf` (server). Mount CSRF middleware after `express.json()` for non-embed routes.
  3. Frontend axios interceptor reads CSRF token from cookie, sends as `X-CSRF-Token` header.
  4. Set `frameguard: { action: 'deny' }` globally; keep Notion `frameAncestors` only in the embed route's CSP.
- **Verify**: `curl` from non-allowlisted origin → CORS blocked. POST without CSRF token → 403. Embed iframe still loads in Notion.
