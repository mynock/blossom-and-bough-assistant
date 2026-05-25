import { describe, expect, it, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { DatabaseService } from '../services/DatabaseService';
import { WorkActivityService, CreateWorkActivityData } from '../services/WorkActivityService';
import { DataMigrationService } from '../services/DataMigrationService';
import {
  workActivities,
  workActivityEmployees,
  otherCharges,
  plantList,
  clients,
  clientNotes,
  projects,
  employees
} from '../db/schema';

/**
 * Integration tests for the transactional write paths added in Plan 2.1.
 *
 * Every test below works the same way: prove that when a write fails inside a
 * multi-statement operation, *none* of the operation's writes survive. Each
 * test forces a failure mid-flight (either by throwing inside an outer
 * transaction the service joins, or by spying on the underlying db call) and
 * then asserts the count of rows in every affected table is unchanged.
 */
describe('Transaction rollback', () => {
  let dbService: DatabaseService;
  let workActivityService: WorkActivityService;
  let testEmployeeId: number;
  let testClientId: number;
  let testCounter = 0;

  beforeAll(() => {
    dbService = new DatabaseService();
    workActivityService = new WorkActivityService();
  });

  afterAll(async () => {
    await dbService.db.delete(plantList);
    await dbService.db.delete(otherCharges);
    await dbService.db.delete(workActivityEmployees);
    await dbService.db.delete(workActivities);
    await dbService.db.delete(employees);
    await dbService.db.delete(clients);
  });

  beforeEach(async () => {
    await dbService.db.delete(plantList);
    await dbService.db.delete(otherCharges);
    await dbService.db.delete(workActivityEmployees);
    await dbService.db.delete(workActivities);
    await dbService.db.delete(clientNotes);
    await dbService.db.delete(projects);
    await dbService.db.delete(employees);
    await dbService.db.delete(clients);

    testCounter++;
    const id = `${Date.now()}_${testCounter}`;
    const [emp] = await dbService.db.insert(employees).values({
      employeeId: `TXN_EMP_${id}`,
      name: 'Txn Test Employee',
      regularWorkdays: 'monday,tuesday,wednesday,thursday,friday',
      homeAddress: '123 Test St',
      minHoursPerDay: 4,
      maxHoursPerDay: 8,
      capabilityLevel: 1.0
    }).returning();
    testEmployeeId = emp.id;

    const [cli] = await dbService.db.insert(clients).values({
      clientId: `TXN_CLI_${id}`,
      name: 'Txn Test Client',
      address: '123 Test St',
      geoZone: 'Test Zone'
    }).returning();
    testClientId = cli.id;
  });

  const sampleActivity = (date = '2025-01-20'): CreateWorkActivityData => ({
    workActivity: {
      workType: 'maintenance',
      date,
      status: 'completed',
      billableHours: 4.0,
      totalHours: 4.0,
      hourlyRate: null,
      projectId: null,
      clientId: testClientId,
      travelTimeMinutes: 0,
      notes: 'txn rollback test',
      tasks: null,
      lastUpdatedBy: 'web_app'
    },
    employees: [{ employeeId: testEmployeeId, hours: 4.0 }],
    charges: [
      {
        chargeType: 'material',
        description: 'Test material',
        quantity: 1,
        unitRate: 10,
        totalCost: 10,
        billable: true
      }
    ],
    plants: [{ name: 'Lavender', quantity: 2 }]
  });

  describe('WorkActivityService.createWorkActivity', () => {
    it('persists nothing when an outer transaction it joins rolls back', async () => {
      // The service accepts an external `tx` so callers composing across
      // services can wrap multiple writes in one atomic unit. If that outer
      // transaction throws after the create, the work activity, its employee
      // row, its charges, and its plants must all roll back together.
      const synthetic = new Error('synthetic failure after createWorkActivity');

      await expect(
        dbService.db.transaction(async (tx) => {
          await workActivityService.createWorkActivity(sampleActivity(), tx);
          throw synthetic;
        })
      ).rejects.toBe(synthetic);

      expect(await dbService.db.select().from(workActivities)).toHaveLength(0);
      expect(await dbService.db.select().from(workActivityEmployees)).toHaveLength(0);
      expect(await dbService.db.select().from(otherCharges)).toHaveLength(0);
      expect(await dbService.db.select().from(plantList)).toHaveLength(0);
    });

    it('rolls back the activity insert when a later insert in its own transaction fails', async () => {
      // No external tx — createWorkActivity opens its own. Force the second
      // insert (employees) to fail at the DB layer by violating a NOT NULL
      // constraint, and assert the work activity insert that ran first is
      // rolled back. Without the transaction the activity row would persist
      // as an orphan with no assignments or charges.
      const bad: CreateWorkActivityData = {
        ...sampleActivity(),
        employees: [{ employeeId: testEmployeeId, hours: null as unknown as number }]
      };

      await expect(workActivityService.createWorkActivity(bad)).rejects.toThrow();

      expect(await dbService.db.select().from(workActivities)).toHaveLength(0);
      expect(await dbService.db.select().from(workActivityEmployees)).toHaveLength(0);
      expect(await dbService.db.select().from(otherCharges)).toHaveLength(0);
      expect(await dbService.db.select().from(plantList)).toHaveLength(0);
    });
  });

  describe('WorkActivityService.deleteWorkActivity', () => {
    it('restores all related rows when the outer transaction rolls back', async () => {
      const created = await workActivityService.createWorkActivity(sampleActivity());

      // Sanity: children exist before delete
      expect(await dbService.db.select().from(workActivityEmployees)).toHaveLength(1);
      expect(await dbService.db.select().from(otherCharges)).toHaveLength(1);
      expect(await dbService.db.select().from(plantList)).toHaveLength(1);

      const synthetic = new Error('synthetic failure after deleteWorkActivity');
      await expect(
        dbService.db.transaction(async (tx) => {
          await workActivityService.deleteWorkActivity(created.id, tx);
          throw synthetic;
        })
      ).rejects.toBe(synthetic);

      // Everything should still be there — no half-deleted activity with
      // orphan child rows, and no fully-deleted activity either.
      expect(await dbService.db.select().from(workActivities)).toHaveLength(1);
      expect(await dbService.db.select().from(workActivityEmployees)).toHaveLength(1);
      expect(await dbService.db.select().from(otherCharges)).toHaveLength(1);
      expect(await dbService.db.select().from(plantList)).toHaveLength(1);
    });

    it('actually deletes everything when the transaction commits', async () => {
      const created = await workActivityService.createWorkActivity(sampleActivity());

      const ok = await workActivityService.deleteWorkActivity(created.id);

      expect(ok).toBe(true);
      expect(await dbService.db.select().from(workActivities)).toHaveLength(0);
      expect(await dbService.db.select().from(workActivityEmployees)).toHaveLength(0);
      expect(await dbService.db.select().from(otherCharges)).toHaveLength(0);
      expect(await dbService.db.select().from(plantList)).toHaveLength(0);
    });
  });

  describe('DataMigrationService.clearAllData', () => {
    it('actually wipes everything on the happy path', async () => {
      // Smoke test the commit path of the wrapped transaction. The rollback
      // semantics themselves are exercised by the createWorkActivity and
      // deleteWorkActivity tests above — drizzle's `db.transaction` provides
      // a single guarantee that applies to every call site.
      await workActivityService.createWorkActivity(sampleActivity('2025-01-21'));
      await workActivityService.createWorkActivity(sampleActivity('2025-01-22'));
      expect(await dbService.db.select().from(workActivities)).toHaveLength(2);

      await new DataMigrationService().clearAllData();

      expect(await dbService.db.select().from(otherCharges)).toHaveLength(0);
      expect(await dbService.db.select().from(workActivityEmployees)).toHaveLength(0);
      expect(await dbService.db.select().from(workActivities)).toHaveLength(0);
      expect(await dbService.db.select().from(clientNotes)).toHaveLength(0);
      expect(await dbService.db.select().from(projects)).toHaveLength(0);
      expect(await dbService.db.select().from(clients)).toHaveLength(0);
      expect(await dbService.db.select().from(employees)).toHaveLength(0);
    });
  });
});
