import { DatabaseService } from './DatabaseService';
import { WorkActivityService, WorkActivityWithDetails } from './WorkActivityService';
import { debugLog } from '../utils/logger';

export interface TravelTimeAllocationRequest {
  date: string;
  employeeId?: number;
  totalTravelMinutes: number;
}

// New interface for date range requests
export interface TravelTimeAllocationRangeRequest {
  startDate: string;
  endDate: string;
  employeeId?: number;
}

export interface TravelTimeAllocation {
  workActivityId: number;
  clientName: string;
  hoursWorked: number; // billable hours used for proportional allocation
  originalTravelMinutes: number;
  allocatedTravelMinutes: number;
  newBillableHours: number;
  hasZeroTravel: boolean;
}

export interface TravelTimeAllocationResult {
  date: string;
  employeeId?: number;
  totalTravelMinutes: number;
  totalWorkHours: number; // actually represents total billable hours for allocation
  allocations: TravelTimeAllocation[];
  updatedActivities: number;
  warnings: string[];
}

// New interface for date range results
export interface TravelTimeAllocationRangeResult {
  startDate: string;
  endDate: string;
  employeeId?: number;
  dateResults: TravelTimeAllocationResult[];
  totalUpdatedActivities: number;
  overallSummary: {
    totalDays: number;
    totalTravelMinutes: number;
    totalWorkHours: number;
    totalAllocations: number;
    daysWithWarnings: number;
    daysWithNoData: number;
  };
}

export class TravelTimeAllocationService extends DatabaseService {
  private workActivityService: WorkActivityService;

  constructor() {
    super();
    this.workActivityService = new WorkActivityService();
  }

  /**
   * Calculate and allocate travel time proportionally across work activities for a given day
   */
  async allocateTravelTime(date: string): Promise<TravelTimeAllocationResult> {
    debugLog.info(`🚗 Starting travel time allocation for ${date}`);

    // Get all work activities for the specified date
    const filters = {
      startDate: date,
      endDate: date
    };

    const workActivities = await this.workActivityService.getAllWorkActivities(filters);
    
    if (workActivities.length === 0) {
      throw new Error(`No work activities found for ${date}`);
    }

    // Calculate total travel time from existing work activities
    const totalTravelMinutes = workActivities.reduce((sum, activity) => {
      return sum + (activity.travelTimeMinutes || 0);
    }, 0);

    // Calculate total billable hours for proportional allocation
    const totalBillableHours = workActivities.reduce((sum, activity) => {
      return sum + (activity.billableHours || activity.totalHours || 0);
    }, 0);

    debugLog.info(`🚗 Total travel time: ${totalTravelMinutes} minutes`);
    debugLog.info(`🕐 Total billable hours: ${totalBillableHours}`);
    debugLog.info(`📊 Total activities: ${workActivities.length}`);

    // If no travel time, return result with activities but no allocations
    if (totalTravelMinutes === 0) {
      const warnings = [`Found ${workActivities.length} work activities but no travel time to allocate`];
      
      // Create empty allocations for display purposes (showing activities with zero travel)
      const allocations: TravelTimeAllocation[] = workActivities.map(activity => ({
        workActivityId: activity.id,
        clientName: activity.clientName || 'Unknown Client',
        hoursWorked: activity.billableHours || activity.totalHours || 0,
        originalTravelMinutes: 0,
        allocatedTravelMinutes: 0,
        newBillableHours: activity.billableHours || activity.totalHours || 0,
        hasZeroTravel: true
      }));

      return {
        date,
        totalTravelMinutes: 0,
        totalWorkHours: totalBillableHours,
        allocations,
        updatedActivities: 0,
        warnings
      };
    }

    // Calculate base billable hours (removing any previous travel time adjustments)
    // This prevents double-counting when re-running allocations
    const totalBaseBillableHours = workActivities.reduce((sum, activity) => {
      const currentBillableHours = activity.billableHours || activity.totalHours || 0;
      const previousAdjustment = activity.adjustedTravelTimeMinutes || 0;
      const previousAdjustmentHours = previousAdjustment / 60;
      
      // Subtract any previous travel time adjustment to get the base billable hours
      const activityBaseBillableHours = Math.max(0, currentBillableHours - previousAdjustmentHours);
      
      return sum + activityBaseBillableHours;
    }, 0);

    debugLog.info(`🔄 Total base billable hours (excluding previous adjustments): ${totalBaseBillableHours}`);

    if (totalBaseBillableHours === 0) {
      throw new Error('No base billable or total hours found in work activities for proportional allocation');
    }

    // Calculate allocations and collect warnings
    const allocations: TravelTimeAllocation[] = [];
    const warnings: string[] = [];
    let totalAllocatedMinutes = 0;

    for (const activity of workActivities) {
      const currentBillableHours = activity.billableHours || activity.totalHours || 0;
      const previousAdjustment = activity.adjustedTravelTimeMinutes || 0;
      const previousAdjustmentHours = previousAdjustment / 60;
      
      // Calculate base billable hours for this activity (before any travel adjustments)
      const activityBaseBillableHours = Math.max(0, currentBillableHours - previousAdjustmentHours);
      
      const originalTravelMinutes = activity.travelTimeMinutes || 0;
      const hasZeroTravel = originalTravelMinutes === 0;
      
      // Flag zero travel activities as potential issues
      if (hasZeroTravel) {
        warnings.push(`Activity ${activity.id} (${activity.clientName}) has zero travel time`);
      }

      // Flag activities with existing adjustments
      if (previousAdjustment > 0) {
        warnings.push(`Activity ${activity.id} (${activity.clientName}) has existing travel time adjustment of ${previousAdjustment} minutes - will be replaced`);
      }

      const proportion = activityBaseBillableHours / totalBaseBillableHours;
      const allocatedTravelMinutesFloat = totalTravelMinutes * proportion;
      const allocatedTravelMinutes = Math.floor(allocatedTravelMinutesFloat); // Round down as requested
      const allocatedTravelHours = allocatedTravelMinutes / 60;
      
      // Calculate new billable hours (base billable hours + new allocated travel time)
      const newBillableHours = activityBaseBillableHours + allocatedTravelHours;

      allocations.push({
        workActivityId: activity.id,
        clientName: activity.clientName || 'Unknown Client',
        hoursWorked: activityBaseBillableHours, // Show the base hours used for calculation
        originalTravelMinutes,
        allocatedTravelMinutes,
        newBillableHours,
        hasZeroTravel
      });

      totalAllocatedMinutes += allocatedTravelMinutes;
    }

    debugLog.info(`🧮 Calculated allocations:`, allocations);
    debugLog.info(`🎯 Total allocated: ${totalAllocatedMinutes} minutes (original: ${totalTravelMinutes})`);
    
    if (warnings.length > 0) {
      debugLog.warn(`⚠️ Warnings:`, warnings);
    }

    return {
      date,
      totalTravelMinutes,
      totalWorkHours: totalBaseBillableHours, // Use base hours for display
      allocations,
      updatedActivities: 0, // Will be set when actually applying the allocation
      warnings
    };
  }

  /**
   * Apply the calculated travel time allocation to work activities
   */
  async applyTravelTimeAllocation(allocationResult: TravelTimeAllocationResult): Promise<TravelTimeAllocationResult> {
    debugLog.info(`🚀 Applying travel time allocation to ${allocationResult.allocations.length} work activities`);

    let updatedCount = 0;

    for (const allocation of allocationResult.allocations) {
      try {
        // Update the work activity with adjusted travel time
        // Note: billable hours will be recalculated automatically when adjustedTravelTimeMinutes changes
        await this.workActivityService.updateWorkActivity(allocation.workActivityId, {
          adjustedTravelTimeMinutes: allocation.allocatedTravelMinutes,
          lastUpdatedBy: 'web_app' as const
        });

        updatedCount++;
        debugLog.info(`✅ Updated work activity ${allocation.workActivityId}: adjusted travel time = ${allocation.allocatedTravelMinutes} minutes`);
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
   * Calculate and immediately apply travel time allocation
   */
  async calculateAndApplyTravelTime(date: string): Promise<TravelTimeAllocationResult> {
    const allocationResult = await this.allocateTravelTime(date);
    return await this.applyTravelTimeAllocation(allocationResult);
  }

  /**
   * Get work activities for a specific date (for preview purposes)
   */
  async getWorkActivitiesForDate(date: string): Promise<WorkActivityWithDetails[]> {
    const filters = {
      startDate: date,
      endDate: date
    };

    return await this.workActivityService.getAllWorkActivities(filters);
  }

  /**
   * Helper function to generate array of dates between start and end dates (inclusive)
   */
  private generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }
    
    if (start > end) {
      throw new Error('Start date must be before or equal to end date');
    }
    
    // Generate dates (inclusive)
    const current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }

  /**
   * Calculate travel time allocation for a date range (preview without applying)
   */
  async allocateTravelTimeForRange(startDate: string, endDate: string): Promise<TravelTimeAllocationRangeResult> {
    debugLog.info(`🚗 Starting travel time allocation for date range: ${startDate} to ${endDate}`);

    const dates = this.generateDateRange(startDate, endDate);
    const dateResults: TravelTimeAllocationResult[] = [];
    let totalUpdatedActivities = 0;
    let totalTravelMinutes = 0;
    let totalWorkHours = 0;
    let totalAllocations = 0;
    let daysWithWarnings = 0;
    let daysWithNoData = 0;

    for (const date of dates) {
      try {
        const result = await this.allocateTravelTime(date);
        dateResults.push(result);
        totalTravelMinutes += result.totalTravelMinutes;
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
          // For other errors (like no travel time), still include the date
          debugLog.warn(`⚠️ Including ${date} with error: ${errorMessage}`);
          
          dateResults.push({
            date,
            totalTravelMinutes: 0,
            totalWorkHours: 0,
            allocations: [],
            updatedActivities: 0,
            warnings: [errorMessage]
          });
          daysWithWarnings++;
        }
      }
    }

    return {
      startDate,
      endDate,
      dateResults,
      totalUpdatedActivities,
      overallSummary: {
        totalDays: dates.length,
        totalTravelMinutes,
        totalWorkHours,
        totalAllocations,
        daysWithWarnings,
        daysWithNoData
      }
    };
  }

  /**
   * Calculate and apply travel time allocation for a date range
   */
  async calculateAndApplyTravelTimeForRange(startDate: string, endDate: string): Promise<TravelTimeAllocationRangeResult> {
    const rangeResult = await this.allocateTravelTimeForRange(startDate, endDate);
    let totalUpdatedActivities = 0;

    // Apply allocations for each date
    for (const dateResult of rangeResult.dateResults) {
      if (dateResult.allocations.length > 0) {
        try {
          const appliedResult = await this.applyTravelTimeAllocation(dateResult);
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