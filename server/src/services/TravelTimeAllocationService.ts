import { BaseTimeAllocationService, TimeAllocationConfig, BaseTimeAllocationResult, BaseTimeAllocationRangeResult } from './BaseTimeAllocationService';
import { WorkActivityWithDetails } from './WorkActivityService';

// Legacy interfaces for backward compatibility
export interface TravelTimeAllocationRequest {
  date: string;
  employeeId?: number;
  totalTravelMinutes: number;
}

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
  // Enhanced preview fields
  originalBillableHours?: number;
  billableHourChange?: number;
  minuteChange?: number;
}

export interface TravelTimeAllocationResult {
  date: string;
  employeeId?: number;
  totalTravelMinutes: number;
  totalWorkHours: number; // actually represents total billable hours for allocation
  allocations: TravelTimeAllocation[];
  updatedActivities: number;
  warnings: string[];
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

export interface TravelTimeAllocationRangeResult {
  startDate: string;
  endDate: string;
  employeeId?: number;
  dateResults: TravelTimeAllocationResult[];
  totalTravelMinutes: number;
  totalWorkHours: number;
  totalAllocations: number;
  totalUpdatedActivities: number;
  overallSummary: {
    totalDays: number;
    daysWithData: number;
    daysWithWarnings: number;
    daysWithNoData: number;
  };
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

export class TravelTimeAllocationService extends BaseTimeAllocationService {
  private readonly config: TimeAllocationConfig = {
    name: 'travel',
    icon: '🚗',
    timeField: 'travelTimeMinutes',
    adjustedField: 'adjustedTravelTimeMinutes',
    billableDirection: 'add', // Travel time adds to billable hours
    description: 'Distribute travel time proportionally across work activities based on billable hours'
  };

  /**
   * Transform base result to travel-specific interface for backward compatibility
   */
  private transformToTravelResult(baseResult: BaseTimeAllocationResult): TravelTimeAllocationResult {
    return {
      date: baseResult.date,
      employeeId: baseResult.employeeId,
      totalTravelMinutes: baseResult.totalMinutes,
      totalWorkHours: baseResult.totalWorkHours,
      allocations: baseResult.allocations.map(allocation => ({
        workActivityId: allocation.workActivityId,
        clientName: allocation.clientName,
        hoursWorked: allocation.hoursWorked,
        originalTravelMinutes: allocation.originalMinutes,
        allocatedTravelMinutes: allocation.allocatedMinutes,
        newBillableHours: allocation.newBillableHours,
        hasZeroTravel: allocation.hasZeroTime,
        originalBillableHours: allocation.originalBillableHours,
        billableHourChange: allocation.billableHourChange,
        minuteChange: allocation.minuteChange
      })),
      updatedActivities: baseResult.updatedActivities,
      warnings: baseResult.warnings,
      clientSummary: baseResult.clientSummary,
      totalBillableHourChange: baseResult.totalBillableHourChange
    };
  }

  /**
   * Transform base range result to travel-specific interface for backward compatibility
   */
  private transformToTravelRangeResult(baseResult: BaseTimeAllocationRangeResult): TravelTimeAllocationRangeResult {
    return {
      startDate: baseResult.startDate,
      endDate: baseResult.endDate,
      employeeId: baseResult.employeeId,
      dateResults: baseResult.dateResults.map(dateResult => this.transformToTravelResult(dateResult)),
      totalTravelMinutes: baseResult.totalMinutes,
      totalWorkHours: baseResult.totalWorkHours,
      totalAllocations: baseResult.totalAllocations,
      totalUpdatedActivities: baseResult.totalUpdatedActivities,
      overallSummary: baseResult.overallSummary,
      clientSummary: baseResult.clientSummary,
      totalBillableHourChange: baseResult.totalBillableHourChange
    };
  }

  /**
   * Calculate and allocate travel time proportionally across work activities for a given day
   */
  async allocateTravelTime(date: string): Promise<TravelTimeAllocationResult> {
    const baseResult = await this.allocateTime(date, this.config);
    return this.transformToTravelResult(baseResult);
  }

  /**
   * Apply the calculated travel time allocation to work activities
   */
  async applyTravelTimeAllocation(allocationResult: TravelTimeAllocationResult): Promise<TravelTimeAllocationResult> {
    // Transform back to base format for application
    const baseResult: BaseTimeAllocationResult = {
      date: allocationResult.date,
      employeeId: allocationResult.employeeId,
      totalMinutes: allocationResult.totalTravelMinutes,
      totalWorkHours: allocationResult.totalWorkHours,
      allocations: allocationResult.allocations.map(allocation => ({
        workActivityId: allocation.workActivityId,
        clientName: allocation.clientName,
        hoursWorked: allocation.hoursWorked,
        originalMinutes: allocation.originalTravelMinutes,
        allocatedMinutes: allocation.allocatedTravelMinutes,
        newBillableHours: allocation.newBillableHours,
        hasZeroTime: allocation.hasZeroTravel
      })),
      updatedActivities: allocationResult.updatedActivities,
      warnings: allocationResult.warnings,
      config: this.config
    };

    const appliedResult = await this.applyTimeAllocation(baseResult);
    return this.transformToTravelResult(appliedResult);
  }

  /**
   * Calculate and immediately apply travel time allocation
   */
  async calculateAndApplyTravelTime(date: string): Promise<TravelTimeAllocationResult> {
    const baseResult = await this.calculateAndApplyTime(date, this.config);
    return this.transformToTravelResult(baseResult);
  }

  /**
   * Calculate travel time allocation for a date range (preview without applying)
   */
  async allocateTravelTimeForRange(startDate: string, endDate: string): Promise<TravelTimeAllocationRangeResult> {
    const baseResult = await this.allocateTimeForRange(startDate, endDate, this.config);
    return this.transformToTravelRangeResult(baseResult);
  }

  /**
   * Calculate and apply travel time allocation for a date range
   */
  async calculateAndApplyTravelTimeForRange(startDate: string, endDate: string): Promise<TravelTimeAllocationRangeResult> {
    const baseResult = await this.calculateAndApplyTimeForRange(startDate, endDate, this.config);
    return this.transformToTravelRangeResult(baseResult);
  }

  /**
   * Get work activities for a specific date (used for previewing)
   */
  async getWorkActivitiesForDate(date: string): Promise<WorkActivityWithDetails[]> {
    return await super.getWorkActivitiesForDate(date);
  }
}