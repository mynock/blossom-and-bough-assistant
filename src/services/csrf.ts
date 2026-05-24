// SECURITY: shared CSRF token helper — see docs/plans/01-security-hardening.md §1.5.
// Both the axios client (services/api.ts) and the deprecated fetch client (config/api.ts)
// pull the token from here so every state-changing request carries X-CSRF-Token.

const API_BASE = process.env.REACT_APP_API_URL || '/api';

let csrfTokenPromise: Promise<string> | null = null;

export function fetchCsrfToken(): Promise<string> {
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch(`${API_BASE}/csrf-token`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`csrf-token fetch failed: ${res.status}`);
        return res.json() as Promise<{ csrfToken: string }>;
      })
      .then((body) => body.csrfToken)
      .catch((err) => {
        csrfTokenPromise = null;
        throw err;
      });
  }
  return csrfTokenPromise;
}

export function invalidateCsrfToken(): void {
  csrfTokenPromise = null;
}

export const CSRF_SAFE_METHODS = new Set(['get', 'head', 'options', 'GET', 'HEAD', 'OPTIONS']);

/**
 * Drop-in fetch wrapper that attaches X-CSRF-Token + credentials for state-changing requests.
 * Use for bare fetch() calls that hit our own API.
 */
export async function secureFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const needsCsrf = !CSRF_SAFE_METHODS.has(method);
  const headers = new Headers(init.headers || {});
  if (needsCsrf) {
    try {
      const token = await fetchCsrfToken();
      headers.set('X-CSRF-Token', token);
    } catch {
      // Same rationale as the axios interceptor — see services/api.ts.
    }
  }
  return fetch(input, { ...init, credentials: 'include', headers });
}
