import { DatabaseService } from './DatabaseService';
import { WorkActivityService, WorkActivityWithDetails } from './WorkActivityService';
import { debugLog } from '../utils/logger';

export interface BreakTimeAllocationRequest {
  date: string;
  employeeId?: number;
  totalBreakMinutes: number;
}

export interface BreakTimeAllocationRangeRequest {
  startDate: string;
  endDate: string;
  employeeId?: number;
}

export interface BreakTimeAllocation {
  workActivityId: number;
  clientName: string;
  hoursWorked: number; // billable hours used for proportional allocation
  originalBreakMinutes: number;
  allocatedBreakMinutes: number;
  newBillableHours: number;
  hasZeroBreak: boolean;
}

export interface BreakTimeAllocationResult {
  date: string;
  employeeId?: number;
  totalBreakMinutes: number;
  totalWorkHours: number; // actually represents total billable hours for allocation
  allocations: BreakTimeAllocation[];
  updatedActivities: number;
  warnings: string[];
}

export interface BreakTimeAllocationRangeResult {
  startDate: string;
  endDate: string;
  employeeId?: number;
  dateResults: BreakTimeAllocationResult[];
  totalBreakMinutes: number;
  totalWorkHours: number;
  totalAllocations: number;
  totalUpdatedActivities: number;
  overallSummary: {
    totalDays: number;
    daysWithData: number;
    daysWithWarnings: number;
    daysWithNoData: number;
  };
}

export class BreakTimeAllocationService extends DatabaseService {
  private workActivityService: WorkActivityService;

  constructor() {
    super();
    this.workActivityService = new WorkActivityService();
  }

  /**
   * Calculate and allocate break time proportionally across work activities for a given day
   */
  async allocateBreakTime(date: string): Promise<BreakTimeAllocationResult> {
    debugLog.info(`☕ Starting break time allocation for ${date}`);

    // Get all work activities for the specified date
    const filters = {
      startDate: date,
      endDate: date
    };

    const workActivities = await this.workActivityService.getAllWorkActivities(filters);
    
    if (workActivities.length === 0) {
      throw new Error(`No work activities found for ${date}`);
    }

    // Calculate total break time from existing work activities
    const totalBreakMinutes = workActivities.reduce((sum, activity) => {
      return sum + (activity.breakTimeMinutes || 0);
    }, 0);

    // Calculate total billable hours for proportional allocation
    const totalBillableHours = workActivities.reduce((sum, activity) => {
      return sum + (activity.billableHours || activity.totalHours || 0);
    }, 0);

    debugLog.info(`☕ Total break time: ${totalBreakMinutes} minutes`);
    debugLog.info(`🕐 Total billable hours: ${totalBillableHours}`);
    debugLog.info(`📊 Total activities: ${workActivities.length}`);

    // If no break time, return result with activities but no allocations
    if (totalBreakMinutes === 0) {
      const warnings = [`Found ${workActivities.length} work activities but no break time to allocate`];
      
      // Create empty allocations for display purposes (showing activities with zero break time)
      const allocations: BreakTimeAllocation[] = workActivities.map(activity => ({
        workActivityId: activity.id,
        clientName: activity.clientName || 'Unknown Client',
        hoursWorked: activity.billableHours || activity.totalHours || 0,
        originalBreakMinutes: 0,
        allocatedBreakMinutes: 0,
        newBillableHours: activity.billableHours || activity.totalHours || 0,
        hasZeroBreak: true
      }));

      return {
        date,
        totalBreakMinutes: 0,
        totalWorkHours: totalBillableHours,
        allocations,
        updatedActivities: 0,
        warnings
      };
    }

    // Calculate base billable hours (removing any previous break time adjustments)
    // This prevents double-counting when re-running allocations
    const totalBaseBillableHours = workActivities.reduce((sum, activity) => {
      const currentBillableHours = activity.billableHours || activity.totalHours || 0;
      const previousAdjustment = activity.adjustedBreakTimeMinutes || 0;
      const previousAdjustmentHours = previousAdjustment / 60;
      
      // Add back any previous break time adjustment to get the base billable hours
      const activityBaseBillableHours = currentBillableHours + previousAdjustmentHours;
      
      return sum + activityBaseBillableHours;
    }, 0);

    debugLog.info(`🔄 Total base billable hours (excluding previous adjustments): ${totalBaseBillableHours}`);

    if (totalBaseBillableHours === 0) {
      throw new Error('No base billable or total hours found in work activities for proportional allocation');
    }

    // Calculate allocations and collect warnings
    const allocations: BreakTimeAllocation[] = [];
    const warnings: string[] = [];
    let totalAllocatedMinutes = 0;

    for (const activity of workActivities) {
      const currentBillableHours = activity.billableHours || activity.totalHours || 0;
      const previousAdjustment = activity.adjustedBreakTimeMinutes || 0;
      const previousAdjustmentHours = previousAdjustment / 60;
      
      // Calculate base billable hours for this activity (before any break adjustments)
      const activityBaseBillableHours = currentBillableHours + previousAdjustmentHours;
      
      const originalBreakMinutes = activity.breakTimeMinutes || 0;
      const hasZeroBreak = originalBreakMinutes === 0;
      
      // Flag zero break activities as potential issues
      if (hasZeroBreak) {
        warnings.push(`Activity ${activity.id} (${activity.clientName}) has zero break time`);
      }

      // Flag activities with existing adjustments
      if (previousAdjustment > 0) {
        warnings.push(`Activity ${activity.id} (${activity.clientName}) has existing break time adjustment of ${previousAdjustment} minutes - will be replaced`);
      }

      const proportion = activityBaseBillableHours / totalBaseBillableHours;
      const allocatedBreakMinutesFloat = totalBreakMinutes * proportion;
      const allocatedBreakMinutes = Math.floor(allocatedBreakMinutesFloat); // Round down as requested
      const allocatedBreakHours = allocatedBreakMinutes / 60;
      
      // Calculate new billable hours (base billable hours - new allocated break time)
      const newBillableHours = Math.max(0, activityBaseBillableHours - allocatedBreakHours);

      allocations.push({
        workActivityId: activity.id,
        clientName: activity.clientName || 'Unknown Client',
        hoursWorked: activityBaseBillableHours, // Show the base hours used for calculation
        originalBreakMinutes,
        allocatedBreakMinutes,
        newBillableHours,
        hasZeroBreak
      });

      totalAllocatedMinutes += allocatedBreakMinutes;
    }

    debugLog.info(`🧮 Calculated allocations:`, allocations);
    debugLog.info(`🎯 Total allocated: ${totalAllocatedMinutes} minutes (original: ${totalBreakMinutes})`);
    
    if (warnings.length > 0) {
      debugLog.warn(`⚠️ Warnings:`, warnings);
    }

    return {
      date,
      totalBreakMinutes,
      totalWorkHours: totalBaseBillableHours, // Use base hours for display
      allocations,
      updatedActivities: 0, // Will be set when actually applying the allocation
      warnings
    };
  }

  /**
   * Apply the calculated break time allocation to work activities
   */
  async applyBreakTimeAllocation(allocationResult: BreakTimeAllocationResult): Promise<BreakTimeAllocationResult> {
    debugLog.info(`🚀 Applying break time allocation to ${allocationResult.allocations.length} work activities`);

    let updatedCount = 0;

    for (const allocation of allocationResult.allocations) {
      try {
        // Update the work activity with adjusted break time
        // Note: billable hours will be recalculated automatically when adjustedBreakTimeMinutes changes
        await this.workActivityService.updateWorkActivity(allocation.workActivityId, {
          adjustedBreakTimeMinutes: allocation.allocatedBreakMinutes,
          lastUpdatedBy: 'web_app' as const
        });

        updatedCount++;
        debugLog.info(`✅ Updated work activity ${allocation.workActivityId}: adjusted break time = ${allocation.allocatedBreakMinutes} minutes`);
      } catch (error) {
        debugLog.error(`❌ Failed to update work activity ${allocation.workActivityId}:`, error);
        throw error;
      }
    }

    return {
      ...allocationResult,
      updatedActivities: updatedCount
    };
  }

  /**
   * Calculate and immediately apply break time allocation
   */
  async calculateAndApplyBreakTime(date: string): Promise<BreakTimeAllocationResult> {
    const allocationResult = await this.allocateBreakTime(date);
    return await this.applyBreakTimeAllocation(allocationResult);
  }

  /**
   * Get work activities for a specific date (used for previewing)
   */
  async getWorkActivitiesForDate(date: string): Promise<WorkActivityWithDetails[]> {
    return await this.workActivityService.getAllWorkActivities({
      startDate: date,
      endDate: date
    });
  }

  /**
   * Generate a range of dates between start and end (inclusive)
   */
  private generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }
    
    return dates;
  }

  /**
   * Calculate break time allocation for a date range (preview without applying)
   */
  async allocateBreakTimeForRange(startDate: string, endDate: string): Promise<BreakTimeAllocationRangeResult> {
    debugLog.info(`☕ Starting break time allocation for date range: ${startDate} to ${endDate}`);

    const dates = this.generateDateRange(startDate, endDate);
    const dateResults: BreakTimeAllocationResult[] = [];
    let totalUpdatedActivities = 0;
    let totalBreakMinutes = 0;
    let totalWorkHours = 0;
    let totalAllocations = 0;
    let daysWithWarnings = 0;
    let daysWithNoData = 0;

    for (const date of dates) {
      try {
        const result = await this.allocateBreakTime(date);
        dateResults.push(result);
        totalBreakMinutes += result.totalBreakMinutes;
        totalWorkHours += result.totalWorkHours;
        totalAllocations += result.allocations.length;
        if (result.warnings.length > 0) {
          daysWithWarnings++;
        }
      } catch (error) {
        // Check if this is a "no work activities" error vs other errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (errorMessage.includes('No work activities found')) {
          // Skip dates with no activities entirely
          daysWithNoData++;
          debugLog.info(`⏭️ Skipping ${date}: No work activities found`);
          continue;
        } else {
          // For other errors (like no break time), still include the date
          debugLog.warn(`⚠️ Including ${date} with error: ${errorMessage}`);
          
          dateResults.push({
            date,
            totalBreakMinutes: 0,
            totalWorkHours: 0,
            allocations: [],
            updatedActivities: 0,
            warnings: [errorMessage]
          });
          daysWithWarnings++;
        }
      }
    }

    const daysWithData = dateResults.length;

    return {
      startDate,
      endDate,
      dateResults,
      totalBreakMinutes,
      totalWorkHours,
      totalAllocations,
      totalUpdatedActivities,
      overallSummary: {
        totalDays: dates.length,
        daysWithData,
        daysWithWarnings,
        daysWithNoData
      }
    };
  }

  /**
   * Calculate and apply break time allocation for a date range
   */
  async calculateAndApplyBreakTimeForRange(startDate: string, endDate: string): Promise<BreakTimeAllocationRangeResult> {
    const rangeResult = await this.allocateBreakTimeForRange(startDate, endDate);
    let totalUpdatedActivities = 0;

    // Apply allocations for each date
    for (const dateResult of rangeResult.dateResults) {
      if (dateResult.allocations.length > 0) {
        try {
          const appliedResult = await this.applyBreakTimeAllocation(dateResult);
          totalUpdatedActivities += appliedResult.updatedActivities;
          // Update the dateResult with the applied status
          dateResult.updatedActivities = appliedResult.updatedActivities;
        } catch (error) {
          debugLog.error(`❌ Failed to apply allocation for ${dateResult.date}:`, error);
          dateResult.warnings.push(`Failed to apply allocation: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    return {
      ...rangeResult,
      totalUpdatedActivities
    };
  }
}