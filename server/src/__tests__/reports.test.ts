import { describe, expect, it } from '@jest/globals';
import {
  parseDateParts,
  getDayOfWeek,
  getDayName,
  groupActivitiesByTimePeriod,
  calculateReportSummary,
} from '../routes/reports';

describe('Reports - Date Helpers', () => {
  describe('parseDateParts', () => {
    it('should parse a standard YYYY-MM-DD date', () => {
      expect(parseDateParts('2024-01-15')).toEqual({ year: 2024, month: 1, day: 15 });
    });

    it('should parse dates at month boundaries', () => {
      expect(parseDateParts('2024-01-01')).toEqual({ year: 2024, month: 1, day: 1 });
      expect(parseDateParts('2024-12-31')).toEqual({ year: 2024, month: 12, day: 31 });
    });

    it('should parse leap year date', () => {
      expect(parseDateParts('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
    });
  });

  describe('getDayOfWeek', () => {
    it('should return correct day index (0=Sunday, 6=Saturday)', () => {
      // 2024-01-15 is a Monday
      expect(getDayOfWeek('2024-01-15')).toBe(1);
      // 2024-01-14 is a Sunday
      expect(getDayOfWeek('2024-01-14')).toBe(0);
      // 2024-01-20 is a Saturday
      expect(getDayOfWeek('2024-01-20')).toBe(6);
    });

    it('should handle dates at the start of a month correctly (timezone regression)', () => {
      // This was the core bug: new Date('2024-02-01') in PST would be Jan 31 local time,
      // causing getDay() to return the wrong day
      // 2024-02-01 is a Thursday
      expect(getDayOfWeek('2024-02-01')).toBe(4);
      // 2024-01-01 is a Monday
      expect(getDayOfWeek('2024-01-01')).toBe(1);
      // 2024-03-01 is a Friday
      expect(getDayOfWeek('2024-03-01')).toBe(5);
    });

    it('should handle year boundaries correctly (timezone regression)', () => {
      // 2025-01-01 is a Wednesday
      expect(getDayOfWeek('2025-01-01')).toBe(3);
      // 2024-12-31 is a Tuesday
      expect(getDayOfWeek('2024-12-31')).toBe(2);
    });
  });

  describe('getDayName', () => {
    it('should return the correct weekday name', () => {
      expect(getDayName('2024-01-15')).toBe('Monday');
      expect(getDayName('2024-01-16')).toBe('Tuesday');
      expect(getDayName('2024-01-17')).toBe('Wednesday');
      expect(getDayName('2024-01-18')).toBe('Thursday');
      expect(getDayName('2024-01-19')).toBe('Friday');
      expect(getDayName('2024-01-20')).toBe('Saturday');
      expect(getDayName('2024-01-21')).toBe('Sunday');
    });

    it('should return correct day for first of month (timezone regression)', () => {
      // In US timezones, new Date('2024-02-01').toLocaleDateString('en-US', {weekday: 'long'})
      // would return 'Wednesday' (Jan 31) instead of 'Thursday' (Feb 1)
      expect(getDayName('2024-02-01')).toBe('Thursday');
      expect(getDayName('2024-01-01')).toBe('Monday');
    });
  });
});

describe('Reports - groupActivitiesByTimePeriod', () => {
  const makeActivity = (overrides: Record<string, any>) => ({
    date: '2024-01-15',
    billableHours: 4,
    totalHours: 5,
    travelTimeMinutes: 30,
    adjustedTravelTimeMinutes: null,
    breakTimeMinutes: 15,
    adjustedBreakTimeMinutes: null,
    ...overrides,
  });

  describe('day grouping', () => {
    it('should group activities by day', () => {
      const activities = [
        makeActivity({ date: '2024-01-15', totalHours: 3 }),
        makeActivity({ date: '2024-01-15', totalHours: 2 }),
        makeActivity({ date: '2024-01-16', totalHours: 5 }),
      ];

      const result = groupActivitiesByTimePeriod(activities, 'day');

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-01-15');
      expect(result[0].totalHours).toBe(5);
      expect(result[1].date).toBe('2024-01-16');
      expect(result[1].totalHours).toBe(5);
    });
  });

  describe('week grouping', () => {
    it('should group activities into weeks starting on Monday', () => {
      // Week of Jan 15, 2024 (Monday) to Jan 21 (Sunday)
      const activities = [
        makeActivity({ date: '2024-01-15', totalHours: 2 }), // Monday
        makeActivity({ date: '2024-01-17', totalHours: 3 }), // Wednesday
        makeActivity({ date: '2024-01-21', totalHours: 1 }), // Sunday (same week)
      ];

      const result = groupActivitiesByTimePeriod(activities, 'week');

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-01-15'); // Monday of the week
      expect(result[0].totalHours).toBe(6);
    });

    it('should put Sunday in the previous week (ISO week)', () => {
      // Jan 21, 2024 is Sunday - should be in the same week as Jan 15 (Monday)
      // Jan 22, 2024 is Monday - should be in the next week
      const activities = [
        makeActivity({ date: '2024-01-21', totalHours: 2 }), // Sunday
        makeActivity({ date: '2024-01-22', totalHours: 3 }), // Next Monday
      ];

      const result = groupActivitiesByTimePeriod(activities, 'week');

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-01-15'); // Monday of week containing Jan 21
      expect(result[0].totalHours).toBe(2);
      expect(result[1].date).toBe('2024-01-22'); // Monday of next week
      expect(result[1].totalHours).toBe(3);
    });

    it('should handle first-of-month dates correctly (timezone regression)', () => {
      // Feb 1, 2024 is Thursday - should group into week of Jan 29 (Monday)
      const activities = [
        makeActivity({ date: '2024-02-01', totalHours: 5 }),
      ];

      const result = groupActivitiesByTimePeriod(activities, 'week');

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-01-29'); // Monday of that week
    });
  });

  describe('month grouping', () => {
    it('should group activities by month', () => {
      const activities = [
        makeActivity({ date: '2024-01-05', totalHours: 2 }),
        makeActivity({ date: '2024-01-25', totalHours: 3 }),
        makeActivity({ date: '2024-02-10', totalHours: 4 }),
      ];

      const result = groupActivitiesByTimePeriod(activities, 'month');

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-01-01');
      expect(result[0].totalHours).toBe(5);
      expect(result[1].date).toBe('2024-02-01');
      expect(result[1].totalHours).toBe(4);
    });

    it('should not shift first-of-month into previous month (timezone regression)', () => {
      // This was the core timezone bug: new Date('2024-02-01') in PST = Jan 31 local,
      // so getMonth() returned 0 (January) instead of 1 (February)
      const activities = [
        makeActivity({ date: '2024-02-01', totalHours: 5 }),
      ];

      const result = groupActivitiesByTimePeriod(activities, 'month');

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-02-01'); // NOT '2024-01-01'
    });

    it('should not shift Jan 1 into December of previous year (timezone regression)', () => {
      const activities = [
        makeActivity({ date: '2024-01-01', totalHours: 3 }),
      ];

      const result = groupActivitiesByTimePeriod(activities, 'month');

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-01-01'); // NOT '2023-12-01'
    });
  });

  describe('year grouping', () => {
    it('should group activities by year', () => {
      const activities = [
        makeActivity({ date: '2024-03-15', totalHours: 2 }),
        makeActivity({ date: '2024-09-01', totalHours: 3 }),
        makeActivity({ date: '2025-01-10', totalHours: 4 }),
      ];

      const result = groupActivitiesByTimePeriod(activities, 'year');

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-01-01');
      expect(result[0].totalHours).toBe(5);
      expect(result[1].date).toBe('2025-01-01');
      expect(result[1].totalHours).toBe(4);
    });

    it('should not shift Jan 1 into previous year (timezone regression)', () => {
      const activities = [
        makeActivity({ date: '2024-01-01', totalHours: 5 }),
      ];

      const result = groupActivitiesByTimePeriod(activities, 'year');

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-01-01'); // NOT '2023-01-01'
    });
  });

  describe('nullish coalescing for adjusted time values', () => {
    it('should use adjustedTravelTimeMinutes when set to 0', () => {
      const activities = [
        makeActivity({
          travelTimeMinutes: 30,
          adjustedTravelTimeMinutes: 0, // Explicitly adjusted to zero
          breakTimeMinutes: 15,
          adjustedBreakTimeMinutes: 0,
        }),
      ];

      const result = groupActivitiesByTimePeriod(activities, 'day');

      // With || operator, 0 || 30 = 30, giving 0.5 hours (WRONG)
      // With ?? operator, 0 ?? 30 = 0, giving 0 hours (CORRECT)
      expect(result[0].travelTimeHours).toBe(0);
      expect(result[0].breakTimeHours).toBe(0);
    });

    it('should fall back to original when adjusted is null', () => {
      const activities = [
        makeActivity({
          travelTimeMinutes: 30,
          adjustedTravelTimeMinutes: null,
          breakTimeMinutes: 15,
          adjustedBreakTimeMinutes: null,
        }),
      ];

      const result = groupActivitiesByTimePeriod(activities, 'day');

      expect(result[0].travelTimeHours).toBe(0.5);  // 30 / 60
      expect(result[0].breakTimeHours).toBe(0.25);   // 15 / 60
    });

    it('should use adjusted value when non-zero', () => {
      const activities = [
        makeActivity({
          travelTimeMinutes: 30,
          adjustedTravelTimeMinutes: 20,
          breakTimeMinutes: 15,
          adjustedBreakTimeMinutes: 10,
        }),
      ];

      const result = groupActivitiesByTimePeriod(activities, 'day');

      expect(result[0].travelTimeHours).toBeCloseTo(20 / 60);
      expect(result[0].breakTimeHours).toBeCloseTo(10 / 60);
    });

    it('should handle null billableHours without treating 0 as null', () => {
      const activities = [
        makeActivity({ billableHours: null, totalHours: 5 }),
        makeActivity({ billableHours: 0, totalHours: 3 }),
        makeActivity({ billableHours: 4, totalHours: 4 }),
      ];

      const result = groupActivitiesByTimePeriod(activities, 'day');

      // null → 0, 0 stays 0, 4 stays 4 → total = 4
      expect(result[0].billableHours).toBe(4);
      expect(result[0].totalHours).toBe(12);
    });
  });

  it('should sort results chronologically', () => {
    const activities = [
      makeActivity({ date: '2024-03-01', totalHours: 1 }),
      makeActivity({ date: '2024-01-01', totalHours: 1 }),
      makeActivity({ date: '2024-02-01', totalHours: 1 }),
    ];

    const result = groupActivitiesByTimePeriod(activities, 'day');

    expect(result.map(r => r.date)).toEqual([
      '2024-01-01',
      '2024-02-01',
      '2024-03-01',
    ]);
  });
});

describe('Reports - calculateReportSummary', () => {
  const makeActivity = (overrides: Record<string, any>) => ({
    date: '2024-01-15',
    billableHours: 4,
    totalHours: 5,
    travelTimeMinutes: 30,
    adjustedTravelTimeMinutes: null,
    breakTimeMinutes: 15,
    adjustedBreakTimeMinutes: null,
    clientId: 1,
    clientName: 'Test Client',
    employeesList: [
      { employeeId: 1, employeeName: 'Employee A', hours: 5 },
    ],
    ...overrides,
  });

  it('should calculate total hours correctly', () => {
    const activities = [
      makeActivity({ billableHours: 4, totalHours: 5 }),
      makeActivity({ billableHours: 3, totalHours: 4 }),
    ];

    const result = calculateReportSummary(activities);

    expect(result.totalBillableHours).toBe(7);
    expect(result.totalHours).toBe(9);
    expect(result.totalActivities).toBe(2);
    expect(result.averageHoursPerActivity).toBe(4.5);
  });

  it('should handle null billableHours with ?? (not ||)', () => {
    const activities = [
      makeActivity({ billableHours: null, totalHours: 5 }),
      makeActivity({ billableHours: 0, totalHours: 3 }),
    ];

    const result = calculateReportSummary(activities);

    // null → 0, 0 stays 0 → total = 0
    expect(result.totalBillableHours).toBe(0);
    expect(result.totalHours).toBe(8);
  });

  it('should use ?? for adjusted travel/break time', () => {
    const activities = [
      makeActivity({
        travelTimeMinutes: 60,
        adjustedTravelTimeMinutes: 0,
        breakTimeMinutes: 30,
        adjustedBreakTimeMinutes: 0,
      }),
    ];

    const result = calculateReportSummary(activities);

    // With ??, adjustedTravelTimeMinutes=0 is used (not fallback to 60)
    expect(result.totalTravelTimeHours).toBe(0);
    expect(result.totalBreakTimeHours).toBe(0);
  });

  it('should break down by client', () => {
    const activities = [
      makeActivity({ clientId: 1, clientName: 'Client A', billableHours: 3, totalHours: 4 }),
      makeActivity({ clientId: 1, clientName: 'Client A', billableHours: 2, totalHours: 3 }),
      makeActivity({ clientId: 2, clientName: 'Client B', billableHours: 8, totalHours: 9 }),
    ];

    const result = calculateReportSummary(activities);

    expect(result.clientBreakdown).toHaveLength(2);
    // Sorted by billableHours descending
    expect(result.clientBreakdown[0].clientName).toBe('Client B');
    expect(result.clientBreakdown[0].billableHours).toBe(8);
    expect(result.clientBreakdown[0].activities).toBe(1);
    expect(result.clientBreakdown[1].clientName).toBe('Client A');
    expect(result.clientBreakdown[1].billableHours).toBe(5);
    expect(result.clientBreakdown[1].activities).toBe(2);
  });

  it('should break down by employee with proportional billable hours', () => {
    const activities = [
      makeActivity({
        billableHours: 8,
        totalHours: 10,
        employeesList: [
          { employeeId: 1, employeeName: 'Alice', hours: 6 },
          { employeeId: 2, employeeName: 'Bob', hours: 4 },
        ],
      }),
    ];

    const result = calculateReportSummary(activities);

    expect(result.employeeBreakdown).toHaveLength(2);
    const alice = result.employeeBreakdown.find(e => e.employeeName === 'Alice')!;
    const bob = result.employeeBreakdown.find(e => e.employeeName === 'Bob')!;
    // Alice: 6/10 * 8 = 4.8 billable hours
    expect(alice.billableHours).toBeCloseTo(4.8);
    expect(alice.totalHours).toBe(6);
    // Bob: 4/10 * 8 = 3.2 billable hours
    expect(bob.billableHours).toBeCloseTo(3.2);
    expect(bob.totalHours).toBe(4);
  });

  it('should break down by day of week using timezone-safe calculation', () => {
    const activities = [
      makeActivity({ date: '2024-01-15' }), // Monday
      makeActivity({ date: '2024-01-16' }), // Tuesday
      makeActivity({ date: '2024-01-22' }), // Monday
    ];

    const result = calculateReportSummary(activities);

    expect(result.dayOfWeekBreakdown).toHaveLength(2);
    // Sorted by day order (Monday first)
    expect(result.dayOfWeekBreakdown[0].dayOfWeek).toBe('Monday');
    expect(result.dayOfWeekBreakdown[0].activities).toBe(2);
    expect(result.dayOfWeekBreakdown[1].dayOfWeek).toBe('Tuesday');
    expect(result.dayOfWeekBreakdown[1].activities).toBe(1);
  });

  it('should assign correct day of week for first-of-month (timezone regression)', () => {
    // Feb 1, 2024 is a Thursday. Without the fix, in PST it would
    // be classified as Wednesday (Jan 31 local time).
    const activities = [
      makeActivity({ date: '2024-02-01' }),
    ];

    const result = calculateReportSummary(activities);

    expect(result.dayOfWeekBreakdown).toHaveLength(1);
    expect(result.dayOfWeekBreakdown[0].dayOfWeek).toBe('Thursday');
  });

  it('should handle empty activities', () => {
    const result = calculateReportSummary([]);

    expect(result.totalBillableHours).toBe(0);
    expect(result.totalHours).toBe(0);
    expect(result.totalActivities).toBe(0);
    expect(result.averageHoursPerActivity).toBe(0);
    expect(result.clientBreakdown).toHaveLength(0);
    expect(result.employeeBreakdown).toHaveLength(0);
    expect(result.dayOfWeekBreakdown).toHaveLength(0);
  });

  it('should handle activities with empty employeesList', () => {
    const activities = [
      makeActivity({ employeesList: [] }),
    ];

    const result = calculateReportSummary(activities);

    expect(result.employeeBreakdown).toHaveLength(0);
    expect(result.totalActivities).toBe(1);
  });
});
