import { DatabaseService } from './DatabaseService';
import { WorkActivityService, WorkActivityWithDetails } from './WorkActivityService';
import { debugLog } from '../utils/logger';

export interface TravelTimeAllocationRequest {
  date: string;
  employeeId?: number;
  totalTravelMinutes: number;
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

    if (totalTravelMinutes === 0) {
      throw new Error('No travel time found in work activities for this date');
    }

    // Calculate total billable hours for proportional allocation
    const totalBillableHours = workActivities.reduce((sum, activity) => {
      return sum + (activity.billableHours || activity.totalHours || 0);
    }, 0);

    if (totalBillableHours === 0) {
      throw new Error('No billable or total hours found in work activities for proportional allocation');
    }

    debugLog.info(`🚗 Total travel time: ${totalTravelMinutes} minutes`);
    debugLog.info(`🕐 Total billable hours: ${totalBillableHours}`);

    // Calculate allocations and collect warnings
    const allocations: TravelTimeAllocation[] = [];
    const warnings: string[] = [];
    let totalAllocatedMinutes = 0;

    for (const activity of workActivities) {
      const billableHours = activity.billableHours || activity.totalHours || 0;
      const originalTravelMinutes = activity.travelTimeMinutes || 0;
      const hasZeroTravel = originalTravelMinutes === 0;
      
      // Flag zero travel activities as potential issues
      if (hasZeroTravel) {
        warnings.push(`Activity ${activity.id} (${activity.clientName}) has zero travel time`);
      }

      const proportion = billableHours / totalBillableHours;
      const allocatedTravelMinutesFloat = totalTravelMinutes * proportion;
      const allocatedTravelMinutes = Math.floor(allocatedTravelMinutesFloat); // Round down as requested
      const allocatedTravelHours = allocatedTravelMinutes / 60;
      
      // Calculate new billable hours (original billable hours + allocated travel time)
      const originalBillableHours = activity.billableHours || activity.totalHours || 0;
      const newBillableHours = originalBillableHours + allocatedTravelHours;

      allocations.push({
        workActivityId: activity.id,
        clientName: activity.clientName || 'Unknown Client',
        hoursWorked: billableHours,
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
      totalWorkHours: totalBillableHours,
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
}