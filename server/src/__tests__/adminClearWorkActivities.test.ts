import { describe, expect, it, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { AdminService } from '../services/AdminService';
import { DatabaseService } from '../services/DatabaseService';
import { DataMigrationService } from '../services/DataMigrationService';
import {
  clients,
  invoiceLineItems,
  invoices,
  otherCharges,
  plantList,
  workActivities,
  workActivityEmployees
} from '../db/schema';

/**
 * Integration tests (need the test Postgres): the admin "clear" operations must not fail
 * once invoices reference work activities or charges. Partial clears keep the invoices
 * (they mirror QuickBooks) and just unlink them; the full wipe removes them too.
 */
describe('clearing work data while invoices exist', () => {
  let dbService: DatabaseService;
  let adminService: AdminService;

  const cleanTables = async () => {
    await dbService.db.delete(invoiceLineItems);
    await dbService.db.delete(invoices);
    await dbService.db.delete(plantList);
    await dbService.db.delete(otherCharges);
    await dbService.db.delete(workActivityEmployees);
    await dbService.db.delete(workActivities);
    await dbService.db.delete(clients);
  };

  const seedInvoicedActivity = async () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const [client] = await dbService.db.insert(clients).values({
      clientId: `CLR_${suffix}`,
      name: 'Clear Test Client',
      address: '1 Test St',
      geoZone: 'Southeast'
    }).returning();

    const [activity] = await dbService.db.insert(workActivities).values({
      workType: 'maintenance',
      date: '2026-10-01',
      status: 'invoiced',
      totalHours: 2,
      clientId: client.id
    }).returning();

    const [charge] = await dbService.db.insert(otherCharges).values({
      workActivityId: activity.id,
      chargeType: 'debris',
      description: '1 debris bag',
      totalCost: 15
    }).returning();

    const [invoice] = await dbService.db.insert(invoices).values({
      qboInvoiceId: `QBO_${suffix}`,
      qboCustomerId: 'CUST_1',
      clientId: client.id,
      invoiceNumber: '1001',
      status: 'paid',
      totalAmount: 125,
      invoiceDate: '2026-10-05'
    }).returning();

    await dbService.db.insert(invoiceLineItems).values([
      { invoiceId: invoice.id, workActivityId: activity.id, description: 'Garden maintenance', quantity: 2, rate: 55, amount: 110, matchStatus: 'auto' },
      { invoiceId: invoice.id, otherChargeId: charge.id, description: 'Debris bag', quantity: 1, rate: 15, amount: 15 }
    ]);
  };

  beforeAll(() => {
    dbService = new DatabaseService();
    adminService = new AdminService();
  });

  beforeEach(async () => {
    await cleanTables();
    await seedInvoicedActivity();
  });
  afterAll(cleanTables);

  const expectInvoiceLinesKeptButUnlinked = async () => {
    const lines = await dbService.db.select().from(invoiceLineItems);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.workActivityId).toBeNull();
      expect(line.otherChargeId).toBeNull();
      expect(line.matchStatus).toBe('unmatched');
    }
  };

  it('AdminService.clearWorkActivities succeeds and keeps the invoice lines, unlinked', async () => {
    const result = await adminService.clearWorkActivities();

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(await dbService.db.select().from(workActivities)).toHaveLength(0);
    await expectInvoiceLinesKeptButUnlinked();
  });

  it('AdminService.clearProjectsAndWorkData succeeds and keeps the invoice lines, unlinked', async () => {
    const result = await adminService.clearProjectsAndWorkData();

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(await dbService.db.select().from(workActivities)).toHaveLength(0);
    await expectInvoiceLinesKeptButUnlinked();
  });

  it('DataMigrationService.clearAllData wipes invoices along with everything else', async () => {
    await new DataMigrationService().clearAllData();

    expect(await dbService.db.select().from(invoiceLineItems)).toHaveLength(0);
    expect(await dbService.db.select().from(invoices)).toHaveLength(0);
    expect(await dbService.db.select().from(clients)).toHaveLength(0);
  });
});
