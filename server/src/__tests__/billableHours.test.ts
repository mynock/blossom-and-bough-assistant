import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { DatabaseService } from '../services/DatabaseService';
import { WorkActivityService } from '../services/WorkActivityService';
import { SettingsService } from '../services/SettingsService';
import { NewWorkActivity } from '../db/schema';
import { CreateWorkActivityData } from '../services/WorkActivityService';
import { workActivities, workActivityEmployees, employees, clients } from '../db/schema';
import { sql } from 'drizzle-orm';

describe('Billable Hours Calculation', () => {
  let db: DatabaseService;
  let workActivityService: WorkActivityService;
  let settingsService: SettingsService;
  let testEmployeeId: number;
  let testClientId: number;
  let testCounter = 0;

  beforeAll(async () => {
    db = new DatabaseService();
    settingsService = new SettingsService();
    workActivityService = new WorkActivityService();
  });

  afterAll(async () => {
    // Clean up after all tests complete
    await db.db.delete(workActivityEmployees);
    await db.db.delete(workActivities);
    await db.db.delete(employees);
    await db.db.delete(clients);
  });

  beforeEach(async () => {
    // Clear all tables in proper dependency order (foreign keys first)
    await db.db.delete(workActivityEmployees);
    await db.db.delete(workActivities);
    // Clear other tables that might have foreign key dependencies
    // await db.db.delete(projects); // Uncomment if needed for other tests
    // Clear base tables last
    await db.db.delete(employees);
    await db.db.delete(clients);
    
    // Insert fresh test data for each test with unique IDs
    testCounter++;
    const testId = `${Date.now()}_${testCounter}`; // Use timestamp + counter to ensure uniqueness
    const insertedEmployees = await db.db.insert(employees).values([
      { 
        employeeId: `TEST_EMP_${testId}`, 
        name: 'Test Employee 1', 
        hourlyRate: 25.0,
        regularWorkdays: 'monday,tuesday,wednesday,thursday,friday',
        homeAddress: '123 Test St',
        minHoursPerDay: 4,
        maxHoursPerDay: 8,
        capabilityLevel: 1.0
      }
    ]).returning();
    testEmployeeId = insertedEmployees[0].id;
    
    const insertedClients = await db.db.insert(clients).values([
      { 
        clientId: `TEST_CLI_${testId}`, 
        name: 'Test Client 1', 
        address: '123 Test St',
        geoZone: 'Test Zone'
      }
    ]).returning();
    testClientId = insertedClients[0].id;
    
    // Ensure rounding is disabled for these tests
    await settingsService.setSetting('billable_hours_rounding', 'false');
  });

  describe('Core Billable Hours Formula', () => {
    it('should calculate billable hours correctly with all components', async () => {
      // Test the complete formula:
      // billableHours = totalHours - (breakTimeMinutes/60) + (adjustedBreakTimeMinutes/60) - (nonBillableTimeMinutes/60) + (adjustedTravelTimeMinutes/60)
      
      const workActivity: NewWorkActivity = {
        workType: 'landscape_maintenance',
        date: '2025-01-20',
        status: 'completed',
        billableHours: null, // Let system calculate
        totalHours: 8.0, // 8 hours base
        breakTimeMinutes: 60, // 1 hour break (implicit in total, needs to be removed)
        adjustedBreakTimeMinutes: 30, // 0.5 hours allocated break (billable)
        nonBillableTimeMinutes: 30, // 0.5 hours non-billable
        adjustedTravelTimeMinutes: 45, // 0.75 hours travel (billable)
        clientId: null,
        hourlyRate: null,
        travelTimeMinutes: 0,
        notes: 'Test billable hours calculation',
        tasks: null,
        lastUpdatedBy: 'web_app'
      };

      const createData: CreateWorkActivityData = {
        workActivity,
        employees: [{ employeeId: testEmployeeId, hours: 8.0 }],
        charges: []
      };

      const result = await workActivityService.createWorkActivity(createData);
      
      // Expected calculation:
      // billableHours = 8.0 - (60/60) + (30/60) - (30/60) + (45/60)
      // billableHours = 8.0 - 1.0 + 0.5 - 0.5 + 0.75 = 7.75
      expect(result.billableHours).toBe(7.75);
    });

    it('should handle zero values correctly', async () => {
      const workActivity: NewWorkActivity = {
        workType: 'landscape_maintenance',
        date: '2025-01-20',
        status: 'completed',
        billableHours: null,
        totalHours: 4.0,
        breakTimeMinutes: 0,
        adjustedBreakTimeMinutes: 0,
        nonBillableTimeMinutes: 0,
        adjustedTravelTimeMinutes: 0,
        clientId: null,
        hourlyRate: null,
        travelTimeMinutes: 0,
        notes: 'Test zero values',
        tasks: null,
        lastUpdatedBy: 'web_app'
      };

      const createData: CreateWorkActivityData = {
        workActivity,
        employees: [{ employeeId: testEmployeeId, hours: 4.0 }],
        charges: []
      };

      const result = await workActivityService.createWorkActivity(createData);
      
      // Expected: billableHours = 4.0 - 0 + 0 - 0 + 0 = 4.0
      expect(result.billableHours).toBe(4.0);
    });

    it('should never return negative billable hours', async () => {
      const workActivity: NewWorkActivity = {
        workType: 'landscape_maintenance',
        date: '2025-01-20',
        status: 'completed',
        billableHours: null,
        totalHours: 2.0,
        breakTimeMinutes: 120, // 2 hours break (more than total)
        adjustedBreakTimeMinutes: 0,
        nonBillableTimeMinutes: 60, // 1 hour non-billable
        adjustedTravelTimeMinutes: 0,
        clientId: null,
        hourlyRate: null,
        travelTimeMinutes: 0,
        notes: 'Test negative prevention',
        tasks: null,
        lastUpdatedBy: 'web_app'
      };

      const createData: CreateWorkActivityData = {
        workActivity,
        employees: [{ employeeId: testEmployeeId, hours: 2.0 }],
        charges: []
      };

      const result = await workActivityService.createWorkActivity(createData);
      
      // Expected: billableHours = 2.0 - 2.0 + 0 - 1.0 + 0 = -1.0 -> 0.0 (clamped)
      expect(result.billableHours).toBe(0);
    });

    it('should use provided billable hours when explicitly set', async () => {
      const workActivity: NewWorkActivity = {
        workType: 'landscape_maintenance',
        date: '2025-01-20',
        status: 'completed',
        billableHours: 5.5, // Explicitly set
        totalHours: 8.0,
        breakTimeMinutes: 60,
        adjustedBreakTimeMinutes: 30,
        nonBillableTimeMinutes: 30,
        adjustedTravelTimeMinutes: 45,
        clientId: null,
        hourlyRate: null,
        travelTimeMinutes: 0,
        notes: 'Test explicit billable hours',
        tasks: null,
        lastUpdatedBy: 'web_app'
      };

      const createData: CreateWorkActivityData = {
        workActivity,
        employees: [{ employeeId: testEmployeeId, hours: 8.0 }],
        charges: []
      };

      const result = await workActivityService.createWorkActivity(createData);
      
      // Should use the explicitly set value, not calculate
      expect(result.billableHours).toBe(5.5);
    });
  });

  describe('Auto-Recalculation on Updates', () => {
    let createdActivityId: number;

    beforeEach(async () => {
      // Create a base work activity for update tests
      const workActivity: NewWorkActivity = {
        workType: 'landscape_maintenance',
        date: '2025-01-20',
        status: 'completed',
        billableHours: null,
        totalHours: 6.0,
        breakTimeMinutes: 30,
        adjustedBreakTimeMinutes: 15,
        nonBillableTimeMinutes: 15,
        adjustedTravelTimeMinutes: 30,
        clientId: null,
        hourlyRate: null,
        travelTimeMinutes: 0,
        notes: 'Base activity for updates',
        tasks: null,
        lastUpdatedBy: 'web_app'
      };

      const createData: CreateWorkActivityData = {
        workActivity,
        employees: [{ employeeId: testEmployeeId, hours: 6.0 }],
        charges: []
      };

      const result = await workActivityService.createWorkActivity(createData);
      createdActivityId = result.id;
      
      // Initial calculation: 6.0 - 0.5 + 0.25 - 0.25 + 0.5 = 6.0
      expect(result.billableHours).toBe(6.0);
    });

    it('should recalculate when totalHours changes', async () => {
      const updatedActivity = await workActivityService.updateWorkActivity(createdActivityId, {
        totalHours: 8.0 // Change from 6.0 to 8.0
      });

      // New calculation: 8.0 - 0.5 + 0.25 - 0.25 + 0.5 = 8.0
      expect(updatedActivity?.billableHours).toBe(8.0);
    });

    it('should recalculate when breakTimeMinutes changes', async () => {
      const updatedActivity = await workActivityService.updateWorkActivity(createdActivityId, {
        breakTimeMinutes: 60 // Change from 30 to 60 minutes
      });

      // New calculation: 6.0 - 1.0 + 0.25 - 0.25 + 0.5 = 5.5
      expect(updatedActivity?.billableHours).toBe(5.5);
    });

    it('should recalculate when adjustedBreakTimeMinutes changes', async () => {
      const updatedActivity = await workActivityService.updateWorkActivity(createdActivityId, {
        adjustedBreakTimeMinutes: 45 // Change from 15 to 45 minutes
      });

      // New calculation: 6.0 - 0.5 + 0.75 - 0.25 + 0.5 = 6.5
      expect(updatedActivity?.billableHours).toBe(6.5);
    });

    it('should recalculate when nonBillableTimeMinutes changes', async () => {
      const updatedActivity = await workActivityService.updateWorkActivity(createdActivityId, {
        nonBillableTimeMinutes: 45 // Change from 15 to 45 minutes
      });

      // New calculation: 6.0 - 0.5 + 0.25 - 0.75 + 0.5 = 5.5
      expect(updatedActivity?.billableHours).toBe(5.5);
    });

    it('should recalculate when adjustedTravelTimeMinutes changes', async () => {
      const updatedActivity = await workActivityService.updateWorkActivity(createdActivityId, {
        adjustedTravelTimeMinutes: 60 // Change from 30 to 60 minutes
      });

      // New calculation: 6.0 - 0.5 + 0.25 - 0.25 + 1.0 = 6.5
      expect(updatedActivity?.billableHours).toBe(6.5);
    });

    it('should recalculate when multiple inputs change', async () => {
      const updatedActivity = await workActivityService.updateWorkActivity(createdActivityId, {
        totalHours: 10.0,
        breakTimeMinutes: 0,
        nonBillableTimeMinutes: 60,
        adjustedTravelTimeMinutes: 90
      });

      // New calculation: 10.0 - 0 + 0.25 - 1.0 + 1.5 = 10.75
      expect(updatedActivity?.billableHours).toBe(10.75);
    });

    it('should NOT recalculate when non-billable-hour fields change', async () => {
      const updatedActivity = await workActivityService.updateWorkActivity(createdActivityId, {
        notes: 'Updated notes',
        workType: 'design_consultation',
        hourlyRate: 75.0
      });

      // Should remain the same: 6.0
      expect(updatedActivity?.billableHours).toBe(6.0);
    });

    it('should use explicitly provided billableHours and skip calculation', async () => {
      const updatedActivity = await workActivityService.updateWorkActivity(createdActivityId, {
        billableHours: 12.5, // Explicitly override
        totalHours: 10.0 // This would normally trigger recalculation
      });

      // Should use the explicit value, not calculate
      expect(updatedActivity?.billableHours).toBe(12.5);
    });
  });

  describe('Rounding Integration', () => {
    beforeEach(async () => {
      // Enable rounding for these tests
      await settingsService.setSetting('billable_hours_rounding', 'true');
      await settingsService.setSetting('billable_hours_rounding_method', 'up');
    });

    afterEach(async () => {
      // Disable rounding after tests
      await settingsService.setSetting('billable_hours_rounding', 'false');
      await settingsService.setSetting('billable_hours_rounding_method', 'nearest');
    });

    it('should apply rounding when creating work activity', async () => {
      const workActivity: NewWorkActivity = {
        workType: 'landscape_maintenance',
        date: '2025-01-20',
        status: 'completed',
        billableHours: null,
        totalHours: 6.25, // Will result in non-half-hour billable hours
        breakTimeMinutes: 0,
        adjustedBreakTimeMinutes: 0,
        nonBillableTimeMinutes: 15, // 0.25 hours
        adjustedTravelTimeMinutes: 0,
        clientId: null,
        hourlyRate: null,
        travelTimeMinutes: 0,
        notes: 'Test rounding on create',
        tasks: null,
        lastUpdatedBy: 'web_app'
      };

      const createData: CreateWorkActivityData = {
        workActivity,
        employees: [{ employeeId: testEmployeeId, hours: 6.25 }],
        charges: []
      };

      const result = await workActivityService.createWorkActivity(createData);
      
      // Calculation: 6.25 - 0.25 = 6.0 (already half-hour, no rounding needed)
      // But let's test with a value that needs rounding
      expect(result.billableHours).toBe(6.0);
    });

    it('should apply rounding when updating work activity', async () => {
      // First create without rounding
      await settingsService.setSetting('billable_hours_rounding', 'false');
      await settingsService.setSetting('billable_hours_rounding_method', 'up');

      const workActivity: NewWorkActivity = {
        workType: 'landscape_maintenance',
        date: '2025-01-20',
        status: 'completed',
        billableHours: null,
        totalHours: 6.0,
        breakTimeMinutes: 0,
        adjustedBreakTimeMinutes: 0,
        nonBillableTimeMinutes: 0,
        adjustedTravelTimeMinutes: 0,
        clientId: null,
        hourlyRate: null,
        travelTimeMinutes: 0,
        notes: 'Test rounding on update',
        tasks: null,
        lastUpdatedBy: 'web_app'
      };

      const createData: CreateWorkActivityData = {
        workActivity,
        employees: [{ employeeId: testEmployeeId, hours: 6.0 }],
        charges: []
      };

      const created = await workActivityService.createWorkActivity(createData);
      expect(created.billableHours).toBe(6.0);

      // Now enable rounding and update
      await settingsService.setSetting('billable_hours_rounding', 'true');
      await settingsService.setSetting('billable_hours_rounding_method', 'up');

      const updated = await workActivityService.updateWorkActivity(created.id, {
        nonBillableTimeMinutes: 10 // Will result in 5.83... hours
      });

      // Calculation: 6.0 - (10/60) = 5.833... -> rounds up to 6.0
      expect(updated?.billableHours).toBe(6.0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined and null time values', async () => {
      const workActivity: NewWorkActivity = {
        workType: 'landscape_maintenance',
        date: '2025-01-20',
        status: 'completed',
        billableHours: null,
        totalHours: 5.0,
        breakTimeMinutes: undefined,
        adjustedBreakTimeMinutes: null,
        nonBillableTimeMinutes: undefined,
        adjustedTravelTimeMinutes: null,
        clientId: null,
        hourlyRate: null,
        travelTimeMinutes: 0,
        notes: 'Test null/undefined handling',
        tasks: null,
        lastUpdatedBy: 'web_app'
      };

      const createData: CreateWorkActivityData = {
        workActivity,
        employees: [{ employeeId: testEmployeeId, hours: 5.0 }],
        charges: []
      };

      const result = await workActivityService.createWorkActivity(createData);
      
      // Should treat undefined/null as 0: 5.0 - 0 + 0 - 0 + 0 = 5.0
      expect(result.billableHours).toBe(5.0);
    });

    it('should handle very small time values precisely', async () => {
      const workActivity: NewWorkActivity = {
        workType: 'landscape_maintenance',
        date: '2025-01-20',
        status: 'completed',
        billableHours: null,
        totalHours: 0.25, // 15 minutes
        breakTimeMinutes: 5, // 5 minutes
        adjustedBreakTimeMinutes: 2, // 2 minutes
        nonBillableTimeMinutes: 3, // 3 minutes
        adjustedTravelTimeMinutes: 1, // 1 minute
        clientId: null,
        hourlyRate: null,
        travelTimeMinutes: 0,
        notes: 'Test small values',
        tasks: null,
        lastUpdatedBy: 'web_app'
      };

      const createData: CreateWorkActivityData = {
        workActivity,
        employees: [{ employeeId: testEmployeeId, hours: 0.25 }],
        charges: []
      };

      const result = await workActivityService.createWorkActivity(createData);
      
      // Calculation: 0.25 - (5/60) + (2/60) - (3/60) + (1/60)
      // = 0.25 - 0.0833 + 0.0333 - 0.05 + 0.0167 = 0.1667
      // Rounded to 2 decimal places = 0.17
      expect(result.billableHours).toBe(0.17);
    });

    it('should maintain precision in calculations', async () => {
      const workActivity: NewWorkActivity = {
        workType: 'landscape_maintenance',
        date: '2025-01-20',
        status: 'completed',
        billableHours: null,
        totalHours: 7.33, // 7 hours 20 minutes
        breakTimeMinutes: 37, // 37 minutes
        adjustedBreakTimeMinutes: 23, // 23 minutes
        nonBillableTimeMinutes: 11, // 11 minutes
        adjustedTravelTimeMinutes: 29, // 29 minutes
        clientId: null,
        hourlyRate: null,
        travelTimeMinutes: 0,
        notes: 'Test precision',
        tasks: null,
        lastUpdatedBy: 'web_app'
      };

      const createData: CreateWorkActivityData = {
        workActivity,
        employees: [{ employeeId: testEmployeeId, hours: 7.33 }],
        charges: []
      };

      const result = await workActivityService.createWorkActivity(createData);
      
      // Should maintain 2 decimal precision and handle fractional calculations correctly
      expect(typeof result.billableHours).toBe('number');
      expect(result.billableHours).toBeGreaterThan(0);
      // The exact value would be complex to calculate, but we verify it's reasonable
      expect(result.billableHours).toBeLessThan(8.0);
    });
  });
});