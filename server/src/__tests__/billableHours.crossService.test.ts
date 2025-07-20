import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { WorkActivityService } from '../services/WorkActivityService';
import { NotionSyncService } from '../services/NotionSyncService';
import { AnthropicService } from '../services/AnthropicService';
import { SettingsService } from '../services/SettingsService';

describe('Cross-Service Billable Hours Consistency (WorkActivity vs NotionSync)', () => {
  let workActivityService: WorkActivityService;
  let notionSyncService: NotionSyncService;
  let settingsService: SettingsService;
  let anthropicService: AnthropicService;

  beforeAll(async () => {
    workActivityService = new WorkActivityService();
    notionSyncService = new NotionSyncService();
    anthropicService = new AnthropicService();
    settingsService = new SettingsService();
  });

  describe('Billable Hours Formula Consistency', () => {
    const testCases = [
      {
        name: 'basic calculation',
        totalHours: 8.0,
        breakTimeMinutes: 60,
        adjustedBreakTimeMinutes: 30,
        nonBillableTimeMinutes: 30,
        adjustedTravelTimeMinutes: 45,
        expected: 7.75 // 8.0 - 1.0 + 0.5 - 0.5 + 0.75
      },
      {
        name: 'zero values',
        totalHours: 4.0,
        breakTimeMinutes: 0,
        adjustedBreakTimeMinutes: 0,
        nonBillableTimeMinutes: 0,
        adjustedTravelTimeMinutes: 0,
        expected: 4.0
      },
      {
        name: 'complex fractional values',
        totalHours: 6.75,
        breakTimeMinutes: 45,
        adjustedBreakTimeMinutes: 20,
        nonBillableTimeMinutes: 25,
        adjustedTravelTimeMinutes: 35,
        expected: 6.42 // 6.75 - 0.75 + 0.33 - 0.42 + 0.58 (rounded to 2 decimals)
      },
      {
        name: 'potential negative result clamped to zero',
        totalHours: 1.0,
        breakTimeMinutes: 120,
        adjustedBreakTimeMinutes: 0,
        nonBillableTimeMinutes: 30,
        adjustedTravelTimeMinutes: 0,
        expected: 0.0 // 1.0 - 2.0 + 0 - 0.5 + 0 = -1.5 -> 0.0
      }
    ];

    testCases.forEach(testCase => {
      it(`should calculate ${testCase.name} consistently across services`, () => {
        // Test WorkActivityService calculation using the private method
        // We'll use reflection to access the private method for testing
        const workActivityResult = (workActivityService as any).calculateBillableHours(
          testCase.totalHours,
          testCase.breakTimeMinutes,
          testCase.adjustedBreakTimeMinutes,
          testCase.nonBillableTimeMinutes,
          testCase.adjustedTravelTimeMinutes
        );

        // Test NotionSyncService calculation using the private method
        const notionSyncResult = (notionSyncService as any).calculateBillableHours(
          testCase.totalHours,
          testCase.breakTimeMinutes, // Note: NotionSync uses this as "lunchTime"
          testCase.nonBillableTimeMinutes,
          testCase.adjustedTravelTimeMinutes,
          [] // No hours adjustments for this test
        );

        // Both services should produce the same result
        expect(workActivityResult).toBe(testCase.expected);
        expect(notionSyncResult).toBe(testCase.expected);

        // Verify both services agree with each other
        expect(workActivityResult).toBe(notionSyncResult);
      });
    });

    it('should handle hours adjustments consistently in Notion sync service', () => {
      const hoursAdjustments = [
        { person: 'Andrea', adjustment: '1:30', notes: 'stayed late', hours: 1.5 },
        { person: 'Virginia', adjustment: '-0:15', notes: 'left early', hours: -0.25 }
      ];

      const totalHours = 6.0;
      const breakTimeMinutes = 30;
      const nonBillableTimeMinutes = 15;
      const adjustedTravelTimeMinutes = 20;

      // Expected calculation with hours adjustments:
      // adjustedTotalHours = 6.0 + 1.5 - 0.25 = 7.25
      // billableHours = 7.25 - 0.5 + 0 - 0.25 + 0.33 = 6.83
      const expected = 6.83;

      const notionSyncResult = (notionSyncService as any).calculateBillableHours(
        totalHours,
        breakTimeMinutes,
        nonBillableTimeMinutes,
        adjustedTravelTimeMinutes,
        hoursAdjustments
      );

      expect(notionSyncResult).toBe(expected);
    });
  });

  describe('Precision and Rounding Consistency', () => {
    it('should maintain 2-decimal precision across services', () => {
      const totalHours = 5.333; // 5 hours 20 minutes
      const breakTimeMinutes = 17; // 17 minutes
      const adjustedBreakTimeMinutes = 8; // 8 minutes
      const nonBillableTimeMinutes = 13; // 13 minutes
      const adjustedTravelTimeMinutes = 22; // 22 minutes

      const workActivityResult = (workActivityService as any).calculateBillableHours(
        totalHours,
        breakTimeMinutes,
        adjustedBreakTimeMinutes,
        nonBillableTimeMinutes,
        adjustedTravelTimeMinutes
      );

      const notionSyncResult = (notionSyncService as any).calculateBillableHours(
        totalHours,
        breakTimeMinutes,
        nonBillableTimeMinutes,
        adjustedTravelTimeMinutes,
        []
      );

      // Both results should be numbers with at most 2 decimal places
      expect(workActivityResult).toEqual(expect.any(Number));
      expect(notionSyncResult).toEqual(expect.any(Number));

      // Check that precision is consistent (2 decimal places max)
      expect(workActivityResult.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
      expect(notionSyncResult.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);

      // Both should be equal
      expect(workActivityResult).toBe(notionSyncResult);
    });

    it('should never return negative values across services', () => {
      const totalHours = 1.0;
      const breakTimeMinutes = 90; // 1.5 hours (more than total)
      const adjustedBreakTimeMinutes = 0;
      const nonBillableTimeMinutes = 45; // 0.75 hours
      const adjustedTravelTimeMinutes = 0;

      const workActivityResult = (workActivityService as any).calculateBillableHours(
        totalHours,
        breakTimeMinutes,
        adjustedBreakTimeMinutes,
        nonBillableTimeMinutes,
        adjustedTravelTimeMinutes
      );

      const notionSyncResult = (notionSyncService as any).calculateBillableHours(
        totalHours,
        breakTimeMinutes,
        nonBillableTimeMinutes,
        adjustedTravelTimeMinutes,
        []
      );

      // Both services should clamp negative results to 0
      expect(workActivityResult).toBe(0);
      expect(notionSyncResult).toBe(0);
    });
  });

  describe('Edge Case Handling Consistency', () => {
    it('should handle null/undefined values consistently', () => {
      const totalHours = 5.0;
      // Test with various combinations of null/undefined

      const workActivityResult = (workActivityService as any).calculateBillableHours(
        totalHours,
        undefined, // breakTimeMinutes
        null, // adjustedBreakTimeMinutes
        0, // nonBillableTimeMinutes
        undefined // adjustedTravelTimeMinutes
      );

      const notionSyncResult = (notionSyncService as any).calculateBillableHours(
        totalHours,
        undefined, // lunchTime
        0, // nonBillableTime
        undefined, // adjustedTravelTimeMinutes
        undefined // hoursAdjustments
      );

      // Should both treat null/undefined as 0
      expect(workActivityResult).toBe(5.0);
      expect(notionSyncResult).toBe(5.0);
    });

    it('should handle very small values consistently', () => {
      const totalHours = 0.1; // 6 minutes
      const breakTimeMinutes = 2; // 2 minutes
      const adjustedBreakTimeMinutes = 1; // 1 minute
      const nonBillableTimeMinutes = 1; // 1 minute
      const adjustedTravelTimeMinutes = 2; // 2 minutes

      const workActivityResult = (workActivityService as any).calculateBillableHours(
        totalHours,
        breakTimeMinutes,
        adjustedBreakTimeMinutes,
        nonBillableTimeMinutes,
        adjustedTravelTimeMinutes
      );

      const notionSyncResult = (notionSyncService as any).calculateBillableHours(
        totalHours,
        breakTimeMinutes,
        nonBillableTimeMinutes,
        adjustedTravelTimeMinutes,
        []
      );

      // Both should handle small values precisely and consistently
      expect(workActivityResult).toBe(notionSyncResult);
      expect(workActivityResult).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Formula Documentation Compliance', () => {
    it('should implement the exact formula from documentation', () => {
      // Formula from docs: 
      // adjustedTotalHours = totalHours + hoursAdjustments
      // billableHours = adjustedTotalHours - (breakTimeMinutes/60) + (adjustedBreakTimeMinutes/60) - (nonBillableTimeMinutes/60) + (adjustedTravelTimeMinutes/60)

      const totalHours = 8.0;
      const hoursAdjustments = [{ person: 'Test', adjustment: '0:30', notes: 'test', hours: 0.5 }];
      const breakTimeMinutes = 60; // 1.0 hours
      const adjustedBreakTimeMinutes = 45; // 0.75 hours
      const nonBillableTimeMinutes = 30; // 0.5 hours
      const adjustedTravelTimeMinutes = 90; // 1.5 hours

      // Manual calculation:
      // adjustedTotalHours = 8.0 + 0.5 = 8.5
      // billableHours = 8.5 - 1.0 + 0.75 - 0.5 + 1.5 = 9.25
      const expectedResult = 9.25;

      // Test with hours adjustments (Notion sync service)
      const notionSyncResult = (notionSyncService as any).calculateBillableHours(
        totalHours,
        breakTimeMinutes,
        nonBillableTimeMinutes,
        adjustedTravelTimeMinutes,
        hoursAdjustments
      );

      expect(notionSyncResult).toBe(expectedResult);

      // Test without hours adjustments (WorkActivityService)
      // adjustedTotalHours = 8.0 + 0 = 8.0
      // billableHours = 8.0 - 1.0 + 0.75 - 0.5 + 1.5 = 8.75
      const expectedWithoutAdjustments = 8.75;

      const workActivityResult = (workActivityService as any).calculateBillableHours(
        totalHours,
        breakTimeMinutes,
        adjustedBreakTimeMinutes,
        nonBillableTimeMinutes,
        adjustedTravelTimeMinutes
      );

      expect(workActivityResult).toBe(expectedWithoutAdjustments);
    });
  });
});