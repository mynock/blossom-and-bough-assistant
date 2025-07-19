import { DatabaseService } from './DatabaseService';
import { WorkActivityService, WorkActivityWithDetails } from './WorkActivityService';
import { debugLog } from '../utils/logger';

export interface TimeAllocationConfig {
  name: string; // 'travel', 'break', etc.
  icon: string; // '🚗', '☕', etc.
  timeField: keyof WorkActivityWithDetails; // 'travelTimeMinutes', 'breakTimeMinutes'
  adjustedField: keyof WorkActivityWithDetails; // 'adjustedTravelTimeMinutes', 'adjustedBreakTimeMinutes'
  billableDirection: 'add' | 'subtract'; // whether this time type adds to or subtracts from billable hours
  description: string; // for logging
}

export interface BaseTimeAllocation {
  workActivityId: number;
  clientName: string;
  hoursWorked: number; // billable hours used for proportional allocation
  originalMinutes: number;
  allocatedMinutes: number;
  newBillableHours: number;
  hasZeroTime: boolean;
  // Enhanced preview fields
  originalBillableHours?: number;
  billableHourChange?: number;
  minuteChange?: number;
}

export interface BaseTimeAllocationResult {
  date: string;
  employeeId?: number;
  totalMinutes: number;
  totalWorkHours: number; // actually represents total billable hours for allocation
  allocations: BaseTimeAllocation[];
  updatedActivities: number;
  warnings: string[];
  config: TimeAllocationConfig;
  // Enhanced preview fields
  clientSummary?: {
    [clientName: string]: {
      activitiesCount: number;
      totalBillableHourChange: number;
      totalMinuteChange: number;
      originalBillableHours: number;
      newBillableHours: number;
    };
  };
  totalBillableHourChange?: number;
}

export interface BaseTimeAllocationRangeResult {
  startDate: string;
  endDate: string;
  employeeId?: number;
  dateResults: BaseTimeAllocationResult[];
  totalMinutes: number;
  totalWorkHours: number;
  totalAllocations: number;
  totalUpdatedActivities: number;
  overallSummary: {
    totalDays: number;
    daysWithData: number;
    daysWithWarnings: number;
    daysWithNoData: number;
  };
  config: TimeAllocationConfig;
  // Enhanced preview fields
  clientSummary?: {
    [clientName: string]: {
      activitiesCount: number;
      totalBillableHourChange: number;
      totalMinuteChange: number;
      originalBillableHours: number;
      newBillableHours: number;
      datesAffected: string[];
    };
  };
  totalBillableHourChange?: number;
}

export class BaseTimeAllocationService extends DatabaseService {
  protected workActivityService: WorkActivityService;

  constructor() {
    super();
    this.workActivityService = new WorkActivityService();
  }

  /**
   * Calculate and allocate time proportionally across work activities for a given day
   */
  async allocateTime(date: string, config: TimeAllocationConfig): Promise<BaseTimeAllocationResult> {
    debugLog.info(`${config.icon} Starting ${config.name} time allocation for ${date}`);

    // Get all work activities for the specified date
    const filters = {
      startDate: date,
      endDate: date
    };

    const workActivities = await this.workActivityService.getAllWorkActivities(filters);
    
    if (workActivities.length === 0) {
      throw new Error(`No work activities found for ${date}`);
    }

    // Calculate total time from existing work activities
    const totalMinutes = workActivities.reduce((sum, activity) => {
      const timeValue = activity[config.timeField] as number | null;
      return sum + (timeValue || 0);
    }, 0);

    // Calculate total billable hours for proportional allocation
    const totalBillableHours = workActivities.reduce((sum, activity) => {
      return sum + (activity.billableHours || activity.totalHours || 0);
    }, 0);

    debugLog.info(`${config.icon} Total ${config.name} time: ${totalMinutes} minutes`);
    debugLog.info(`🕐 Total billable hours: ${totalBillableHours}`);
    debugLog.info(`📊 Total activities: ${workActivities.length}`);

    // If no time, return result with activities but no allocations
    if (totalMinutes === 0) {
      const warnings = [`Found ${workActivities.length} work activities but no ${config.name} time to allocate`];
      
      // Create empty allocations for display purposes (showing activities with zero time)
      const allocations: BaseTimeAllocation[] = workActivities.map(activity => {
        const billableHours = activity.billableHours || activity.totalHours || 0;
        return {
          workActivityId: activity.id,
          clientName: activity.clientName || 'Unknown Client',
          hoursWorked: billableHours,
          originalMinutes: 0,
          allocatedMinutes: 0,
          newBillableHours: billableHours,
          hasZeroTime: true,
          originalBillableHours: billableHours,
          billableHourChange: 0,
          minuteChange: 0
        };
      });

      // Calculate client summary for zero allocation case
      const clientSummary: { [clientName: string]: any } = {};
      for (const allocation of allocations) {
        const clientName = allocation.clientName;
        if (!clientSummary[clientName]) {
          clientSummary[clientName] = {
            activitiesCount: 0,
            totalBillableHourChange: 0,
            totalMinuteChange: 0,
            originalBillableHours: 0,
            newBillableHours: 0
          };
        }
        clientSummary[clientName].activitiesCount += 1;
        clientSummary[clientName].originalBillableHours += allocation.originalBillableHours || 0;
        clientSummary[clientName].newBillableHours += allocation.newBillableHours || 0;
      }

      return {
        date,
        totalMinutes: 0,
        totalWorkHours: totalBillableHours,
        allocations,
        updatedActivities: 0,
        warnings,
        config,
        clientSummary,
        totalBillableHourChange: 0
      };
    }

    // Calculate base billable hours (removing any previous adjustments)
    // This prevents double-counting when re-running allocations
    const totalBaseBillableHours = workActivities.reduce((sum, activity) => {
      const currentBillableHours = activity.billableHours || activity.totalHours || 0;
      const previousAdjustment = (activity[config.adjustedField] as number) || 0;
      const previousAdjustmentHours = previousAdjustment / 60;
      
      // Calculate base billable hours (undo previous adjustment)
      const activityBaseBillableHours = config.billableDirection === 'add' 
        ? Math.max(0, currentBillableHours - previousAdjustmentHours) // For travel: subtract previous addition
        : currentBillableHours + previousAdjustmentHours; // For break: add back previous subtraction
      
      return sum + activityBaseBillableHours;
    }, 0);

    debugLog.info(`🔄 Total base billable hours (excluding previous adjustments): ${totalBaseBillableHours}`);

    if (totalBaseBillableHours === 0) {
      throw new Error(`No base billable or total hours found in work activities for proportional allocation`);
    }

    // Calculate allocations and collect warnings
    const allocations: BaseTimeAllocation[] = [];
    const warnings: string[] = [];
    let totalAllocatedMinutes = 0;

    for (const activity of workActivities) {
      const currentBillableHours = activity.billableHours || activity.totalHours || 0;
      const previousAdjustment = (activity[config.adjustedField] as number) || 0;
      const previousAdjustmentHours = previousAdjustment / 60;
      
      // Calculate base billable hours for this activity (before any adjustments)
      const activityBaseBillableHours = config.billableDirection === 'add'
        ? Math.max(0, currentBillableHours - previousAdjustmentHours)
        : currentBillableHours + previousAdjustmentHours;
      
      const originalMinutes = (activity[config.timeField] as number) || 0;
      const hasZeroTime = originalMinutes === 0;
      
      // Flag zero time activities as potential issues
      if (hasZeroTime) {
        warnings.push(`Activity ${activity.id} (${activity.clientName}) has zero ${config.name} time`);
      }

      // Flag activities with existing adjustments
      if (previousAdjustment > 0) {
        warnings.push(`Activity ${activity.id} (${activity.clientName}) has existing ${config.name} time adjustment of ${previousAdjustment} minutes - will be replaced`);
      }

      const proportion = activityBaseBillableHours / totalBaseBillableHours;
      const allocatedMinutesFloat = totalMinutes * proportion;
      const allocatedMinutes = Math.floor(allocatedMinutesFloat); // Round down as requested
      const allocatedHours = allocatedMinutes / 60;
      
      // Calculate new billable hours (apply adjustment in correct direction)
      const newBillableHours = config.billableDirection === 'add'
        ? activityBaseBillableHours + allocatedHours // Travel time adds to billable
        : Math.max(0, activityBaseBillableHours - allocatedHours); // Break time subtracts from billable

      // Calculate hour and minute changes
      const billableHourChange = newBillableHours - activityBaseBillableHours;
      const minuteChange = allocatedMinutes - originalMinutes;

      allocations.push({
        workActivityId: activity.id,
        clientName: activity.clientName || 'Unknown Client',
        hoursWorked: activityBaseBillableHours, // Show the base hours used for calculation
        originalMinutes,
        allocatedMinutes,
        newBillableHours,
        hasZeroTime,
        originalBillableHours: activityBaseBillableHours,
        billableHourChange,
        minuteChange
      });

      totalAllocatedMinutes += allocatedMinutes;
    }

    // Calculate client summary and totals
    const clientSummary: { [clientName: string]: any } = {};
    let totalBillableHourChange = 0;

    for (const allocation of allocations) {
      const clientName = allocation.clientName;
      
      if (!clientSummary[clientName]) {
        clientSummary[clientName] = {
          activitiesCount: 0,
          totalBillableHourChange: 0,
          totalMinuteChange: 0,
          originalBillableHours: 0,
          newBillableHours: 0
        };
      }
      
      clientSummary[clientName].activitiesCount += 1;
      clientSummary[clientName].totalBillableHourChange += allocation.billableHourChange || 0;
      clientSummary[clientName].totalMinuteChange += allocation.minuteChange || 0;
      clientSummary[clientName].originalBillableHours += allocation.originalBillableHours || 0;
      clientSummary[clientName].newBillableHours += allocation.newBillableHours || 0;
      
      totalBillableHourChange += allocation.billableHourChange || 0;
    }

    debugLog.info(`🧮 Calculated allocations:`, allocations);
    debugLog.info(`🎯 Total allocated: ${totalAllocatedMinutes} minutes (original: ${totalMinutes})`);
    debugLog.info(`📊 Total billable hour change: ${totalBillableHourChange.toFixed(2)}h`);
    
    if (warnings.length > 0) {
      debugLog.warn(`⚠️ Warnings:`, warnings);
    }

    return {
      date,
      totalMinutes,
      totalWorkHours: totalBaseBillableHours, // Use base hours for display
      allocations,
      updatedActivities: 0, // Will be set when actually applying the allocation
      warnings,
      config,
      clientSummary,
      totalBillableHourChange
    };
  }

  /**
   * Apply the calculated time allocation to work activities
   */
  async applyTimeAllocation(allocationResult: BaseTimeAllocationResult): Promise<BaseTimeAllocationResult> {
    const { config } = allocationResult;
    debugLog.info(`🚀 Applying ${config.name} time allocation to ${allocationResult.allocations.length} work activities`);

    let updatedCount = 0;

    for (const allocation of allocationResult.allocations) {
      try {
        // Create update object with the adjusted field
        const updateData = {
          [config.adjustedField]: allocation.allocatedMinutes,
          lastUpdatedBy: 'web_app' as const
        };

        // Update the work activity with adjusted time
        // Note: billable hours will be recalculated automatically when adjusted field changes
        await this.workActivityService.updateWorkActivity(allocation.workActivityId, updateData);

        updatedCount++;
        debugLog.info(`✅ Updated work activity ${allocation.workActivityId}: adjusted ${config.name} time = ${allocation.allocatedMinutes} minutes`);
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
   * Calculate and immediately apply time allocation
   */
  async calculateAndApplyTime(date: string, config: TimeAllocationConfig): Promise<BaseTimeAllocationResult> {
    const allocationResult = await this.allocateTime(date, config);
    return await this.applyTimeAllocation(allocationResult);
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
   * Calculate time allocation for a date range (preview without applying)
   */
  async allocateTimeForRange(startDate: string, endDate: string, config: TimeAllocationConfig): Promise<BaseTimeAllocationRangeResult> {
    debugLog.info(`${config.icon} Starting ${config.name} time allocation for date range: ${startDate} to ${endDate}`);

    const dates = this.generateDateRange(startDate, endDate);
    const dateResults: BaseTimeAllocationResult[] = [];
    let totalUpdatedActivities = 0;
    let totalMinutes = 0;
    let totalWorkHours = 0;
    let totalAllocations = 0;
    let daysWithWarnings = 0;
    let daysWithNoData = 0;

    for (const date of dates) {
      try {
        const result = await this.allocateTime(date, config);
        dateResults.push(result);
        totalMinutes += result.totalMinutes;
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
          // For other errors (like no time), still include the date
          debugLog.warn(`⚠️ Including ${date} with error: ${errorMessage}`);
          
          dateResults.push({
            date,
            totalMinutes: 0,
            totalWorkHours: 0,
            allocations: [],
            updatedActivities: 0,
            warnings: [errorMessage],
            config,
            clientSummary: {},
            totalBillableHourChange: 0
          });
          daysWithWarnings++;
        }
      }
    }

    const daysWithData = dateResults.length;

    // Aggregate client summary across all dates
    const clientSummary: { [clientName: string]: any } = {};
    let totalBillableHourChange = 0;

    for (const dateResult of dateResults) {
      totalBillableHourChange += dateResult.totalBillableHourChange || 0;
      
      Object.entries(dateResult.clientSummary || {}).forEach(([clientName, clientData]) => {
        if (!clientSummary[clientName]) {
          clientSummary[clientName] = {
            activitiesCount: 0,
            totalBillableHourChange: 0,
            totalMinuteChange: 0,
            originalBillableHours: 0,
            newBillableHours: 0,
            datesAffected: []
          };
        }
        
        clientSummary[clientName].activitiesCount += clientData.activitiesCount || 0;
        clientSummary[clientName].totalBillableHourChange += clientData.totalBillableHourChange || 0;
        clientSummary[clientName].totalMinuteChange += clientData.totalMinuteChange || 0;
        clientSummary[clientName].originalBillableHours += clientData.originalBillableHours || 0;
        clientSummary[clientName].newBillableHours += clientData.newBillableHours || 0;
        
        if (clientData.activitiesCount > 0 && !clientSummary[clientName].datesAffected.includes(dateResult.date)) {
          clientSummary[clientName].datesAffected.push(dateResult.date);
        }
      });
    }

    return {
      startDate,
      endDate,
      dateResults,
      totalMinutes,
      totalWorkHours,
      totalAllocations,
      totalUpdatedActivities,
      overallSummary: {
        totalDays: dates.length,
        daysWithData,
        daysWithWarnings,
        daysWithNoData
      },
      config,
      clientSummary,
      totalBillableHourChange
    };
  }

  /**
   * Calculate and apply time allocation for a date range
   */
  async calculateAndApplyTimeForRange(startDate: string, endDate: string, config: TimeAllocationConfig): Promise<BaseTimeAllocationRangeResult> {
    const rangeResult = await this.allocateTimeForRange(startDate, endDate, config);
    let totalUpdatedActivities = 0;

    // Apply allocations for each date
    for (const dateResult of rangeResult.dateResults) {
      if (dateResult.allocations.length > 0) {
        try {
          const appliedResult = await this.applyTimeAllocation(dateResult);
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