// Route smoke tests for /api/clients.
// See workActivities.routes.test.ts for the pattern + auth approach.

process.env.GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || 'test-client-id';
process.env.GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || 'test-client-secret';

import request from 'supertest';
import { app } from '../../server';

describe('routes/clients (smoke)', () => {
  describe('unauthenticated', () => {
    beforeEach(() => {
      delete process.env.DEV_BYPASS_AUTH;
      process.env.NODE_ENV = 'test';
    });

    it('GET /api/clients is blocked (no session)', async () => {
      const res = await request(app).get('/api/clients');
      // See workActivities.routes.test.ts for why this is 302 instead of 401.
      expect([302, 401]).toContain(res.status);
      expect(res.status).not.toBe(200);
    });
  });

  describe('authenticated (dev bypass)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      process.env.DEV_BYPASS_AUTH = 'true';
    });
    afterEach(() => {
      process.env.NODE_ENV = 'test';
      delete process.env.DEV_BYPASS_AUTH;
    });

    it('GET /api/clients → 200 returns { clients: [...] }', async () => {
      const res = await request(app).get('/api/clients');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.clients)).toBe(true);
    });
  });
});
