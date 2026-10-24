// The destructive migration endpoints wipe every table. They exist for local seeding and
// must not run against production data, whoever is logged in.
jest.mock('../../services/DataMigrationService');

import express from 'express';
import request from 'supertest';
import migrationRouter from '../../routes/migration';
import { services } from '../../services/container';

const app = express();
app.use(express.json());
app.use('/api/migration', migrationRouter);

describe('routes/migration destructive endpoints', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('in production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('POST /seed-reset is refused without touching data', async () => {
      const res = await request(app)
        .post('/api/migration/seed-reset')
        .send({ confirm: 'RESET_AND_SEED' });

      expect(res.status).toBe(403);
      expect(services.dataMigrationService.clearAllData).not.toHaveBeenCalled();
    });

    it('POST /clear is refused without touching data', async () => {
      const res = await request(app).post('/api/migration/clear');

      expect(res.status).toBe(403);
      expect(services.dataMigrationService.clearAllData).not.toHaveBeenCalled();
    });
  });

  describe('outside production', () => {
    it('POST /seed-reset still requires the confirmation phrase', async () => {
      process.env.NODE_ENV = 'development';

      const res = await request(app).post('/api/migration/seed-reset').send({});

      expect(res.status).toBe(400);
    });
  });
});
