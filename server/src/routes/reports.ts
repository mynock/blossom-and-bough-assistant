import { Router } from 'express';
import { services } from '../services/container';
import { debugLog } from '../utils/logger';

const router = Router();
const workActivityService = services.workActivityService;

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  clientId?: number;
  employeeId?: number;
  dayOfWeek?: string; // e.g., 'Monday', 'Tuesday', etc.
}

export interface TimeSeriesDataPoint {
  date: string;
  billableHours: number;
  totalHours: number;
  travelTimeHours: number;
  breakTimeHours: number;
  clientName?: string;
  employeeName?: string;
}

export interface ReportSummary {
  totalBillableHours: number;
  totalHours: number;
  totalTravelTimeHours: number;
  totalBreakTimeHours: number;
  totalActivities: number;
  averageHoursPerActivity: number;
  clientBreakdown: Array<{
    clientId: number;
    clientName: string;
    billableHours: number;
    totalHours: number;
    activities: number;
  }>;
  employeeBreakdown: Array<{
    employeeId: number;
    employeeName: string;
    billableHours: number;
    totalHours: number;
    activities: number;
  }>;
  dayOfWeekBreakdown: Array<{
    dayOfWeek: string;
    billableHours: number;
    totalHours: number;
    activities: number;
  }>;
}

/**
 * GET /api/reports/time-series
 * Get time series data for reporting charts
 */
router.get('/time-series', async (req, res) => {
  try {
    const filters: ReportFilters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      clientId: req.query.clientId ? parseInt(req.query.clientId as string) : undefined,
      employeeId: req.query.employeeId ? parseInt(req.query.employeeId as string) : undefined,
      dayOfWeek: req.query.dayOfWeek as string,
    };

    const groupBy = req.query.groupBy as string || 'day'; // day, week, month, year

    debugLog.info('Fetching time series data with filters:', filters);

    // Get all work activities with the filters
    const activities = await workActivityService.getAllWorkActivities({
      startDate: filters.startDate,
      endDate: filters.endDate,
      clientId: filters.clientId,
      employeeId: filters.employeeId,
    });

    // Filter by day of week if specified
    let filteredActivities = activities;
    if (filters.dayOfWeek) {
      filteredActivities = activities.filter(activity => {
        return getDayName(activity.date) === filters.dayOfWeek;
      });
    }

    // Group activities by the specified time period
    const groupedData = groupActivitiesByTimePeriod(filteredActivities, groupBy);

    res.json(groupedData);
  } catch (error) {
    debugLog.error('Error fetching time series data:', error);
    res.status(500).json({ error: 'Failed to fetch time series data' });
  }
});

/**
 * GET /api/reports/summary
 * Get summary statistics for reporting
 */
router.get('/summary', async (req, res) => {
  try {
    const filters: ReportFilters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      clientId: req.query.clientId ? parseInt(req.query.clientId as string) : undefined,
      employeeId: req.query.employeeId ? parseInt(req.query.employeeId as string) : undefined,
      dayOfWeek: req.query.dayOfWeek as string,
    };

    debugLog.info('Fetching summary data with filters:', filters);

    // Get all work activities with the filters
    const activities = await workActivityService.getAllWorkActivities({
      startDate: filters.startDate,
      endDate: filters.endDate,
      clientId: filters.clientId,
      employeeId: filters.employeeId,
    });

    // Filter by day of week if specified
    let filteredActivities = activities;
    if (filters.dayOfWeek) {
      filteredActivities = activities.filter(activity => {
        return getDayName(activity.date) === filters.dayOfWeek;
      });
    }

    // Calculate summary statistics
    const summary = calculateReportSummary(filteredActivities);

    res.json(summary);
  } catch (error) {
    debugLog.error('Error fetching summary data:', error);
    res.status(500).json({ error: 'Failed to fetch summary data' });
  }
});

/**
 * Parse a 'YYYY-MM-DD' date string into { year, month, day } without timezone issues.
 * Using new Date('YYYY-MM-DD') creates a UTC date, but getDay()/getMonth()/etc.
 * use local time, which shifts dates back by one day in western timezones.
 */
export function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

/**
 * Get the day of the week for a YYYY-MM-DD date string (0=Sunday, 6=Saturday).
 * Uses UTC methods to avoid timezone issues.
 */
export function getDayOfWeek(dateStr: string): number {
  const { year, month, day } = parseDateParts(dateStr);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Get the weekday name for a YYYY-MM-DD date string.
 */
export function getDayName(dateStr: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[getDayOfWeek(dateStr)];
}

/**
 * Helper function to group activities by time period
 */
export function groupActivitiesByTimePeriod(activities: any[], groupBy: string): TimeSeriesDataPoint[] {
  const groupedMap = new Map<string, TimeSeriesDataPoint>();

  activities.forEach(activity => {
    const { year, month, day } = parseDateParts(activity.date);
    let groupKey: string;

    switch (groupBy) {
      case 'week': {
        // Get Monday of the week using UTC to avoid timezone shifts
        const utcDate = new Date(Date.UTC(year, month - 1, day));
        const dayOfWeek = utcDate.getUTCDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        utcDate.setUTCDate(utcDate.getUTCDate() + mondayOffset);
        groupKey = utcDate.toISOString().split('T')[0];
        break;
      }
      case 'month':
        groupKey = `${year}-${String(month).padStart(2, '0')}-01`;
        break;
      case 'year':
        groupKey = `${year}-01-01`;
        break;
      default: // day
        groupKey = activity.date;
        break;
    }

    if (!groupedMap.has(groupKey)) {
      groupedMap.set(groupKey, {
        date: groupKey,
        billableHours: 0,
        totalHours: 0,
        travelTimeHours: 0,
        breakTimeHours: 0,
      });
    }

    const groupData = groupedMap.get(groupKey)!;
    groupData.billableHours += activity.billableHours ?? 0;
    groupData.totalHours += activity.totalHours ?? 0;
    groupData.travelTimeHours += ((activity.adjustedTravelTimeMinutes ?? activity.travelTimeMinutes ?? 0) / 60);
    groupData.breakTimeHours += ((activity.adjustedBreakTimeMinutes ?? activity.breakTimeMinutes ?? 0) / 60);
  });

  // Convert map to array and sort by date
  return Array.from(groupedMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

/**
 * Helper function to calculate summary statistics
 */
export function calculateReportSummary(activities: any[]): ReportSummary {
  const totalBillableHours = activities.reduce((sum, a) => sum + (a.billableHours ?? 0), 0);
  const totalHours = activities.reduce((sum, a) => sum + (a.totalHours ?? 0), 0);
  const totalTravelTimeHours = activities.reduce((sum, a) =>
    sum + ((a.adjustedTravelTimeMinutes ?? a.travelTimeMinutes ?? 0) / 60), 0);
  const totalBreakTimeHours = activities.reduce((sum, a) =>
    sum + ((a.adjustedBreakTimeMinutes ?? a.breakTimeMinutes ?? 0) / 60), 0);

  // Client breakdown
  const clientMap = new Map<number, any>();
  activities.forEach(activity => {
    if (activity.clientId) {
      if (!clientMap.has(activity.clientId)) {
        clientMap.set(activity.clientId, {
          clientId: activity.clientId,
          clientName: activity.clientName || 'Unknown Client',
          billableHours: 0,
          totalHours: 0,
          activities: 0,
        });
      }
      const client = clientMap.get(activity.clientId)!;
      client.billableHours += activity.billableHours ?? 0;
      client.totalHours += activity.totalHours ?? 0;
      client.activities += 1;
    }
  });

  // Employee breakdown
  const employeeMap = new Map<number, any>();
  activities.forEach(activity => {
    activity.employeesList.forEach((emp: any) => {
      if (!employeeMap.has(emp.employeeId)) {
        employeeMap.set(emp.employeeId, {
          employeeId: emp.employeeId,
          employeeName: emp.employeeName || 'Unknown Employee',
          billableHours: 0,
          totalHours: 0,
          activities: 0,
        });
      }
      const employee = employeeMap.get(emp.employeeId)!;
      // Proportional allocation based on employee hours vs total activity hours
      const proportion = emp.hours / (activity.totalHours || 1);
      employee.billableHours += (activity.billableHours ?? 0) * proportion;
      employee.totalHours += emp.hours;
      employee.activities += 1;
    });
  });

  // Day of week breakdown
  const dayOfWeekMap = new Map<string, any>();
  activities.forEach(activity => {
    const dayName = getDayName(activity.date);

    if (!dayOfWeekMap.has(dayName)) {
      dayOfWeekMap.set(dayName, {
        dayOfWeek: dayName,
        billableHours: 0,
        totalHours: 0,
        activities: 0,
      });
    }
    const day = dayOfWeekMap.get(dayName)!;
    day.billableHours += activity.billableHours ?? 0;
    day.totalHours += activity.totalHours ?? 0;
    day.activities += 1;
  });

  return {
    totalBillableHours: Math.round(totalBillableHours * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
    totalTravelTimeHours: Math.round(totalTravelTimeHours * 100) / 100,
    totalBreakTimeHours: Math.round(totalBreakTimeHours * 100) / 100,
    totalActivities: activities.length,
    averageHoursPerActivity: activities.length > 0 ? 
      Math.round((totalHours / activities.length) * 100) / 100 : 0,
    clientBreakdown: Array.from(clientMap.values()).sort((a, b) => b.billableHours - a.billableHours),
    employeeBreakdown: Array.from(employeeMap.values()).sort((a, b) => b.billableHours - a.billableHours),
    dayOfWeekBreakdown: Array.from(dayOfWeekMap.values()).sort((a, b) => {
      const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      return dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek);
    }),
  };
}

export default router;
