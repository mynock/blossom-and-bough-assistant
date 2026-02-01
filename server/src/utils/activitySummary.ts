/**
 * Activity Summary Utilities
 *
 * Provides reusable functions for calculating work activity statistics.
 * Used by both client and employee work-activities endpoints.
 */

export interface ActivityWithFields {
  status: string;
  workType: string;
  date: string;
  totalHours: number;
  billableHours?: number | null;
  totalCharges: number;
  clientName?: string | null;
}

/**
 * Calculate a breakdown of activities by a string field (e.g., status or workType)
 */
export function calculateBreakdown<T>(
  activities: T[],
  fieldAccessor: (activity: T) => string
): Record<string, number> {
  return activities.reduce((acc, activity) => {
    const field = fieldAccessor(activity);
    acc[field] = (acc[field] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Calculate year-to-date hours from activities
 */
export function calculateYearToDateHours<T>(
  activities: T[],
  dateAccessor: (activity: T) => string,
  hoursAccessor: (activity: T) => number
): number {
  const currentYear = new Date().getFullYear();
  return activities
    .filter(activity => new Date(dateAccessor(activity)).getFullYear() === currentYear)
    .reduce((sum, activity) => sum + hoursAccessor(activity), 0);
}

/**
 * Calculate completion rate (percentage of completed/invoiced activities)
 */
export function calculateCompletionRate<T>(
  activities: T[],
  statusAccessor: (activity: T) => string
): number {
  if (activities.length === 0) return 0;

  const completedStatuses = ['completed', 'invoiced'];
  const completedCount = activities.filter(activity =>
    completedStatuses.includes(statusAccessor(activity))
  ).length;

  return (completedCount / activities.length) * 100;
}

/**
 * Calculate average hours per day for recent activities (last 30 days)
 */
export function calculateAverageHoursPerDay<T>(
  activities: T[],
  dateAccessor: (activity: T) => string,
  hoursAccessor: (activity: T) => number
): number {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentActivities = activities.filter(activity =>
    new Date(dateAccessor(activity)) >= thirtyDaysAgo
  );

  if (recentActivities.length === 0) return 0;

  const totalHours = recentActivities.reduce(
    (sum, activity) => sum + hoursAccessor(activity),
    0
  );
  const uniqueDays = new Set(recentActivities.map(activity => dateAccessor(activity))).size;

  return uniqueDays > 0 ? totalHours / uniqueDays : 0;
}

/**
 * Get unique values from activities for a given field
 */
export function getUniqueValues<T, V>(
  activities: T[],
  valueAccessor: (activity: T) => V | null | undefined
): V[] {
  return [...new Set(
    activities
      .map(valueAccessor)
      .filter((value): value is V => value != null)
  )];
}

/**
 * Calculate client activity summary
 * Used by the client work-activities endpoint
 */
export function calculateClientActivitySummary(
  activities: ActivityWithFields[]
): {
  totalActivities: number;
  totalHours: number;
  totalBillableHours: number;
  totalCharges: number;
  statusBreakdown: Record<string, number>;
  workTypeBreakdown: Record<string, number>;
  lastActivityDate: string | null;
  yearToDateHours: number;
} {
  return {
    totalActivities: activities.length,
    totalHours: activities.reduce((sum, a) => sum + a.totalHours, 0),
    totalBillableHours: activities.reduce((sum, a) => sum + (a.billableHours || 0), 0),
    totalCharges: activities.reduce((sum, a) => sum + a.totalCharges, 0),
    statusBreakdown: calculateBreakdown(activities, a => a.status),
    workTypeBreakdown: calculateBreakdown(activities, a => a.workType),
    lastActivityDate: activities.length > 0 ? activities[0].date : null,
    yearToDateHours: calculateYearToDateHours(
      activities,
      a => a.date,
      a => a.totalHours
    )
  };
}

export interface EmployeeActivityWithHours extends ActivityWithFields {
  employeesList: Array<{ employeeId: number; hours: number }>;
}

/**
 * Calculate employee activity summary
 * Used by the employee work-activities endpoint
 */
export function calculateEmployeeActivitySummary(
  activities: EmployeeActivityWithHours[],
  employeeId: number,
  employeeHourlyRate: number | null
): {
  totalActivities: number;
  totalHours: number;
  totalBillableHours: number;
  totalEarnings: number;
  statusBreakdown: Record<string, number>;
  workTypeBreakdown: Record<string, number>;
  lastActivityDate: string | null;
  yearToDateHours: number;
  averageHoursPerDay: number;
  completionRate: number;
  clientsWorkedWith: string[];
} {
  const getEmployeeHours = (activity: EmployeeActivityWithHours): number =>
    activity.employeesList.find(emp => emp.employeeId === employeeId)?.hours || 0;

  const totalActivities = activities.length;

  const totalHours = activities.reduce((sum, activity) =>
    sum + getEmployeeHours(activity), 0
  );

  const totalBillableHours = activities.reduce((sum, activity) => {
    if (activity.billableHours && activity.totalHours > 0 &&
        activity.employeesList.some(emp => emp.employeeId === employeeId)) {
      const employeeHours = getEmployeeHours(activity);
      const billableRatio = activity.billableHours / activity.totalHours;
      return sum + (employeeHours * billableRatio);
    }
    return sum;
  }, 0);

  const totalEarnings = activities.reduce((sum, activity) => {
    const employeeHours = getEmployeeHours(activity);
    const hourlyRate = employeeHourlyRate || 0;
    return sum + (employeeHours * hourlyRate);
  }, 0);

  return {
    totalActivities,
    totalHours,
    totalBillableHours,
    totalEarnings,
    statusBreakdown: calculateBreakdown(activities, a => a.status),
    workTypeBreakdown: calculateBreakdown(activities, a => a.workType),
    lastActivityDate: activities.length > 0 ? activities[0].date : null,
    yearToDateHours: calculateYearToDateHours(
      activities,
      a => a.date,
      getEmployeeHours
    ),
    averageHoursPerDay: calculateAverageHoursPerDay(
      activities,
      a => a.date,
      getEmployeeHours
    ),
    completionRate: calculateCompletionRate(activities, a => a.status),
    clientsWorkedWith: getUniqueValues(activities, a => a.clientName)
  };
}
