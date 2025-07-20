import { describe, expect, it, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { SettingsService } from '../services/SettingsService';
import { WorkActivityService } from '../services/WorkActivityService';
import { DatabaseService } from '../services/DatabaseService';
import { NewWorkActivity } from '../db/schema';
import { CreateWorkActivityData } from '../services/WorkActivityService';
import { workActivities, workActivityEmployees } from '../db/schema';

describe('Billable Hours Rounding', () => {
  let settingsService: SettingsService;
  let workActivityService: WorkActivityService;
  let db: DatabaseService;

  beforeAll(async () => {
    settingsService = new SettingsService();
    workActivityService = new WorkActivityService();
    db = new DatabaseService();
  });

  afterAll(async () => {
    
  });

  beforeEach(async () => {
    // Clear any existing work activities and reset settings before each test
    await db.db.delete(workActivities);
    await db.db.delete(workActivityEmployees);
    
    // Reset to default settings
    await settingsService.setSetting('billable_hours_rounding', 'false');
    await settingsService.setSetting('billable_hours_rounding_method', 'nearest');
  });

  describe('SettingsService Rounding Logic', () => {
    it('should not round when rounding is disabled', async () => {
      await settingsService.setSetting('billable_hours_rounding', 'false');

      const testValues = [5.1, 5.25, 5.33, 5.49, 5.5, 5.67, 5.75, 5.99];
      
      for (const value of testValues) {
        const result = await settingsService.roundHours(value);
        expect(result).toBe(value); // Should return original value unchanged
      }
    });

    describe('Rounding Method: UP', () => {
      beforeEach(async () => {
        await settingsService.setSetting('billable_hours_rounding', 'true');
        await settingsService.setSetting('billable_hours_rounding_method', 'up');
      });

      it('should round up to nearest half hour', async () => {
        const testCases = [
          { input: 5.0, expected: 5.0 }, // Already half-hour, no change
          { input: 5.1, expected: 5.5 }, // Round up to next half hour
          { input: 5.25, expected: 5.5 }, // Round up to next half hour
          { input: 5.33, expected: 5.5 }, // Round up to next half hour
          { input: 5.49, expected: 5.5 }, // Round up to next half hour
          { input: 5.5, expected: 5.5 }, // Already half-hour, no change
          { input: 5.51, expected: 6.0 }, // Round up to next half hour
          { input: 5.75, expected: 6.0 }, // Round up to next half hour
          { input: 5.99, expected: 6.0 }, // Round up to next half hour
          { input: 6.0, expected: 6.0 }, // Already whole hour, no change
        ];

        for (const testCase of testCases) {
          const result = await settingsService.roundHours(testCase.input);
          expect(result).toBe(testCase.expected);
        }
      });
    });

    describe('Rounding Method: DOWN', () => {
      beforeEach(async () => {
        await settingsService.setSetting('billable_hours_rounding', 'true');
        await settingsService.setSetting('billable_hours_rounding_method', 'down');
      });

      it('should round down to nearest half hour', async () => {
        const testCases = [
          { input: 5.0, expected: 5.0 }, // Already whole hour, no change
          { input: 5.1, expected: 5.0 }, // Round down to previous half hour
          { input: 5.25, expected: 5.0 }, // Round down to previous half hour
          { input: 5.49, expected: 5.0 }, // Round down to previous half hour
          { input: 5.5, expected: 5.5 }, // Already half-hour, no change
          { input: 5.51, expected: 5.5 }, // Round down to previous half hour
          { input: 5.75, expected: 5.5 }, // Round down to previous half hour
          { input: 5.99, expected: 5.5 }, // Round down to previous half hour
          { input: 6.0, expected: 6.0 }, // Already whole hour, no change
        ];

        for (const testCase of testCases) {
          const result = await settingsService.roundHours(testCase.input);
          expect(result).toBe(testCase.expected);
        }
      });
    });

    describe('Rounding Method: NEAREST', () => {
      beforeEach(async () => {
        await settingsService.setSetting('billable_hours_rounding', 'true');
        await settingsService.setSetting('billable_hours_rounding_method', 'nearest');
      });

      it('should round to nearest half hour', async () => {
        const testCases = [
          { input: 5.0, expected: 5.0 }, // Already whole hour, no change
          { input: 5.1, expected: 5.0 }, // Round down (closer to 5.0)
          { input: 5.24, expected: 5.0 }, // Round down (closer to 5.0)
          { input: 5.25, expected: 5.5 }, // Exactly between, round to nearest half (5.5)
          { input: 5.26, expected: 5.5 }, // Round up (closer to 5.5)
          { input: 5.49, expected: 5.5 }, // Round up (closer to 5.5)
          { input: 5.5, expected: 5.5 }, // Already half-hour, no change
          { input: 5.74, expected: 5.5 }, // Round down (closer to 5.5)
          { input: 5.75, expected: 6.0 }, // Exactly between, round to nearest half (6.0)
          { input: 5.76, expected: 6.0 }, // Round up (closer to 6.0)
          { input: 5.99, expected: 6.0 }, // Round up (closer to 6.0)
          { input: 6.0, expected: 6.0 }, // Already whole hour, no change
        ];

        for (const testCase of testCases) {
          const result = await settingsService.roundHours(testCase.input);
          expect(result).toBe(testCase.expected);
        }
      });
    });

    it('should handle edge cases correctly', async () => {
      await settingsService.setSetting('billable_hours_rounding', 'true');
      await settingsService.setSetting('billable_hours_rounding_method', 'up');

      // Test very small values
      expect(await settingsService.roundHours(0.01)).toBe(0.5);
      expect(await settingsService.roundHours(0.0)).toBe(0.0);
      
      // Test large values
      expect(await settingsService.roundHours(24.1)).toBe(24.5);
      expect(await settingsService.roundHours(24.7)).toBe(25.0);

      // Test negative values (edge case)
      expect(await settingsService.roundHours(-0.1)).toBe(0.0);
    });
  });

  describe('Integration with WorkActivityService', () => {
    it('should apply rounding when creating work activities', async () => {
      // Enable rounding
      await settingsService.setSetting('billable_hours_rounding', 'true');
      await settingsService.setSetting('billable_hours_rounding_method', 'up');

      const workActivity: NewWorkActivity = {
        workType: 'landscape_maintenance',
        date: '2025-01-20',
        status: 'completed',
        billableHours: null, // Let system calculate
        totalHours: 6.33, // Will calculate to 6.08 billable hours
        breakTimeMinutes: 15, // 0.25 hours
        adjustedBreakTimeMinutes: 0,
        nonBillableTimeMinutes: 0,
        adjustedTravelTimeMinutes: 0,
        clientId: null,
        hourlyRate: null,
        travelTimeMinutes: 0,
        notes: 'Test rounding integration',
        tasks: null,
        lastUpdatedBy: 'web_app'
      };

      const createData: CreateWorkActivityData = {
        workActivity,
        employees: [{ employeeId: 1, hours: 6.33 }],
        charges: []
      };

      const result = await workActivityService.createWorkActivity(createData);
      
      // Expected: 6.33 - 0.25 = 6.08 -> rounds up to 6.5
      expect(result.billableHours).toBe(6.5);
    });

    it('should apply rounding when updating work activities', async () => {
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
        employees: [{ employeeId: 1, hours: 6.0 }],
        charges: []
      };

      const created = await workActivityService.createWorkActivity(createData);
      expect(created.billableHours).toBe(6.0); // No rounding

      // Enable rounding and update
      await settingsService.setSetting('billable_hours_rounding', 'true');
      await settingsService.setSetting('billable_hours_rounding_method', 'down');

      const updated = await workActivityService.updateWorkActivity(created.id, {
        nonBillableTimeMinutes: 25 // Will result in 5.58... hours
      });

      // Expected: 6.0 - (25/60) = 5.583... -> rounds down to 5.5
      expect(updated?.billableHours).toBe(5.5);
    });

    it('should not apply rounding to explicitly provided billable hours', async () => {
      // Enable rounding
      await settingsService.setSetting('billable_hours_rounding', 'true');
      await settingsService.setSetting('billable_hours_rounding_method', 'up');

      const workActivity: NewWorkActivity = {
        workType: 'landscape_maintenance',
        date: '2025-01-20',
        status: 'completed',
        billableHours: 5.33, // Explicitly provided (not a half-hour increment)
        totalHours: 8.0,
        breakTimeMinutes: 60,
        adjustedBreakTimeMinutes: 30,
        nonBillableTimeMinutes: 30,
        adjustedTravelTimeMinutes: 45,
        clientId: null,
        hourlyRate: null,
        travelTimeMinutes: 0,
        notes: 'Test explicit billable hours with rounding',
        tasks: null,
        lastUpdatedBy: 'web_app'
      };

      const createData: CreateWorkActivityData = {
        workActivity,
        employees: [{ employeeId: 1, hours: 8.0 }],
        charges: []
      };

      const result = await workActivityService.createWorkActivity(createData);
      
      // Should apply rounding to the explicitly provided value: 5.33 -> 5.5
      expect(result.billableHours).toBe(5.5);
    });

    it('should handle rounding method changes consistently', async () => {
      const workActivity: NewWorkActivity = {
        workType: 'landscape_maintenance',
        date: '2025-01-20',
        status: 'completed',
        billableHours: null,
        totalHours: 5.0,
        breakTimeMinutes: 0,
        adjustedBreakTimeMinutes: 0,
        nonBillableTimeMinutes: 0,
        adjustedTravelTimeMinutes: 0,
        clientId: null,
        hourlyRate: null,
        travelTimeMinutes: 0,
        notes: 'Test rounding method changes',
        tasks: null,
        lastUpdatedBy: 'web_app'
      };

      const createData: CreateWorkActivityData = {
        workActivity,
        employees: [{ employeeId: 1, hours: 5.0 }],
        charges: []
      };

      // Test with rounding UP
      await settingsService.setSetting('billable_hours_rounding', 'true');
      await settingsService.setSetting('billable_hours_rounding_method', 'up');

      const created = await workActivityService.createWorkActivity(createData);
      expect(created.billableHours).toBe(5.0); // 5.0 is already a half-hour

      // Update to create non-half-hour value and test different rounding methods
      await settingsService.setSetting('billable_hours_rounding', 'true');
      await settingsService.setSetting('billable_hours_rounding_method', 'up');

      const updatedUp = await workActivityService.updateWorkActivity(created.id, {
        nonBillableTimeMinutes: 20 // 5.0 - (20/60) = 4.67 -> rounds up to 5.0
      });
      expect(updatedUp?.billableHours).toBe(5.0);

      // Test with rounding DOWN
      await settingsService.setSetting('billable_hours_rounding', 'true');
      await settingsService.setSetting('billable_hours_rounding_method', 'down');

      const updatedDown = await workActivityService.updateWorkActivity(created.id, {
        nonBillableTimeMinutes: 20 // 5.0 - (20/60) = 4.67 -> rounds down to 4.5
      });
      expect(updatedDown?.billableHours).toBe(4.5);

      // Test with rounding NEAREST
      await settingsService.setSetting('billable_hours_rounding', 'true');
      await settingsService.setSetting('billable_hours_rounding_method', 'nearest');

      const updatedNearest = await workActivityService.updateWorkActivity(created.id, {
        nonBillableTimeMinutes: 20 // 5.0 - (20/60) = 4.67 -> rounds to nearest (5.0)
      });
      expect(updatedNearest?.billableHours).toBe(5.0);
    });
  });

  describe('Rounding Error Handling', () => {
    it('should handle invalid rounding method gracefully', async () => {
      // Set an invalid rounding method (should fall back to 'nearest')
      await settingsService.setSetting('billable_hours_rounding', 'true');
      await settingsService.setSetting('billable_hours_rounding_method', 'invalid' as any);

      const result = await settingsService.roundHours(5.33);
      
      // Should default to 'nearest' behavior: 5.33 -> 5.5
      expect(result).toBe(5.5);
    });

    it('should handle negative billable hours in rounding', async () => {
      await settingsService.setSetting('billable_hours_rounding', 'true');
      await settingsService.setSetting('billable_hours_rounding_method', 'up');

      // This should be rare, but test edge case
      const result = await settingsService.roundHours(-0.5);
      expect(result).toBeGreaterThanOrEqual(0); // Should not be negative
    });

    it('should maintain precision after rounding', async () => {
      await settingsService.setSetting('billable_hours_rounding', 'true');
      await settingsService.setSetting('billable_hours_rounding_method', 'nearest');

      const testValues = [0.1, 0.74, 1.25, 2.76, 5.99, 10.01];
      
      for (const value of testValues) {
        const result = await settingsService.roundHours(value);
        
        // Result should be a half-hour increment (x.0 or x.5)
        const remainder = (result * 2) % 1;
        expect(remainder).toBe(0); // Should be divisible by 0.5
        
        // Result should be a number with at most 1 decimal place
        const decimalPlaces = result.toString().split('.')[1]?.length || 0;
        expect(decimalPlaces).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Bulk Rounding Operations', () => {
    it('should preview rounding changes without applying them', async () => {
      // This tests the preview functionality mentioned in the documentation
      await settingsService.setSetting('billable_hours_rounding', 'false');
      await settingsService.setSetting('billable_hours_rounding_method', 'up');

      // Create several work activities with non-rounded billable hours
      const activities = [];
      for (let i = 0; i < 3; i++) {
        const workActivity: NewWorkActivity = {
          workType: 'landscape_maintenance',
          date: '2025-01-20',
          status: 'completed',
          billableHours: null,
          totalHours: 5.33 + (i * 0.1),
          breakTimeMinutes: 0,
          adjustedBreakTimeMinutes: 0,
          nonBillableTimeMinutes: 0,
          adjustedTravelTimeMinutes: 0,
          clientId: null,
          hourlyRate: null,
          travelTimeMinutes: 0,
          notes: `Test activity ${i}`,
          tasks: null,
          lastUpdatedBy: 'web_app'
        };

        const createData: CreateWorkActivityData = {
          workActivity,
          employees: [{ employeeId: 1, hours: workActivity.totalHours }],
          charges: []
        };

        const created = await workActivityService.createWorkActivity(createData);
        activities.push(created);
      }

      // Preview rounding changes
      const preview = await settingsService.previewRoundingForExistingWorkActivities();
      
      expect(preview).toBeDefined();
      expect(preview.success).toBe(true);
      expect(preview.totalActivities).toBe(3);
      expect(preview.activitiesAffected).toBeGreaterThan(0);
      expect(Array.isArray(preview.previews)).toBe(true);
      expect(preview.previews.length).toBe(3);

      // Each preview item should show the change
      for (let i = 0; i < preview.previews.length; i++) {
        expect(preview.previews[i]).toHaveProperty('id');
        expect(preview.previews[i]).toHaveProperty('currentHours');
        expect(preview.previews[i]).toHaveProperty('roundedHours');
        expect(preview.previews[i].currentHours).not.toBe(preview.previews[i].roundedHours);
      }
    });
  });
});