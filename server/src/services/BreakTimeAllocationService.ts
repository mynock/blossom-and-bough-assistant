import { BaseTimeAllocationService, TimeAllocationConfig, BaseTimeAllocationResult, BaseTimeAllocationRangeResult } from './BaseTimeAllocationService';
import { WorkActivityWithDetails } from './WorkActivityService';

// Legacy interfaces for backward compatibility
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
  // Enhanced preview fields
  originalBillableHours?: number;
  billableHourChange?: number;
  minuteChange?: number;
}

export interface BreakTimeAllocationResult {
  date: string;
  employeeId?: number;
  totalBreakMinutes: number;
  totalWorkHours: number; // actually represents total billable hours for allocation
  allocations: BreakTimeAllocation[];
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

export class BreakTimeAllocationService extends BaseTimeAllocationService {
  private readonly config: TimeAllocationConfig = {
    name: 'break',
    icon: '☕',
    timeField: 'breakTimeMinutes',
    adjustedField: 'adjustedBreakTimeMinutes',
    billableDirection: 'add', // Break time adds to billable hours
    description: 'Distribute break time proportionally across work activities based on billable hours'
  };

  /**
   * Transform base result to break-specific interface for backward compatibility
   */
  private transformToBreakResult(baseResult: BaseTimeAllocationResult): BreakTimeAllocationResult {
    return {
      date: baseResult.date,
      employeeId: baseResult.employeeId,
      totalBreakMinutes: baseResult.totalMinutes,
      totalWorkHours: baseResult.totalWorkHours,
      allocations: baseResult.allocations.map(allocation => ({
        workActivityId: allocation.workActivityId,
        clientName: allocation.clientName,
        hoursWorked: allocation.hoursWorked,
        originalBreakMinutes: allocation.originalMinutes,
        allocatedBreakMinutes: allocation.allocatedMinutes,
        newBillableHours: allocation.newBillableHours,
        hasZeroBreak: allocation.hasZeroTime,
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
   * Transform base range result to break-specific interface for backward compatibility
   */
  private transformToBreakRangeResult(baseResult: BaseTimeAllocationRangeResult): BreakTimeAllocationRangeResult {
    return {
      startDate: baseResult.startDate,
      endDate: baseResult.endDate,
      employeeId: baseResult.employeeId,
      dateResults: baseResult.dateResults.map(dateResult => this.transformToBreakResult(dateResult)),
      totalBreakMinutes: baseResult.totalMinutes,
      totalWorkHours: baseResult.totalWorkHours,
      totalAllocations: baseResult.totalAllocations,
      totalUpdatedActivities: baseResult.totalUpdatedActivities,
      overallSummary: baseResult.overallSummary,
      clientSummary: baseResult.clientSummary,
      totalBillableHourChange: baseResult.totalBillableHourChange
    };
  }

  /**
   * Calculate and allocate break time proportionally across work activities for a given day
   */
  async allocateBreakTime(date: string): Promise<BreakTimeAllocationResult> {
    const baseResult = await this.allocateTime(date, this.config);
    return this.transformToBreakResult(baseResult);
  }

  /**
   * Apply the calculated break time allocation to work activities
   */
  async applyBreakTimeAllocation(allocationResult: BreakTimeAllocationResult): Promise<BreakTimeAllocationResult> {
    // Transform back to base format for application
    const baseResult: BaseTimeAllocationResult = {
      date: allocationResult.date,
      employeeId: allocationResult.employeeId,
      totalMinutes: allocationResult.totalBreakMinutes,
      totalWorkHours: allocationResult.totalWorkHours,
      allocations: allocationResult.allocations.map(allocation => ({
        workActivityId: allocation.workActivityId,
        clientName: allocation.clientName,
        hoursWorked: allocation.hoursWorked,
        originalMinutes: allocation.originalBreakMinutes,
        allocatedMinutes: allocation.allocatedBreakMinutes,
        newBillableHours: allocation.newBillableHours,
        hasZeroTime: allocation.hasZeroBreak
      })),
      updatedActivities: allocationResult.updatedActivities,
      warnings: allocationResult.warnings,
      config: this.config
    };

    const appliedResult = await this.applyTimeAllocation(baseResult);
    return this.transformToBreakResult(appliedResult);
  }

  /**
   * Calculate and immediately apply break time allocation
   */
  async calculateAndApplyBreakTime(date: string): Promise<BreakTimeAllocationResult> {
    const baseResult = await this.calculateAndApplyTime(date, this.config);
    return this.transformToBreakResult(baseResult);
  }

  /**
   * Calculate break time allocation for a date range (preview without applying)
   */
  async allocateBreakTimeForRange(startDate: string, endDate: string): Promise<BreakTimeAllocationRangeResult> {
    const baseResult = await this.allocateTimeForRange(startDate, endDate, this.config);
    return this.transformToBreakRangeResult(baseResult);
  }

  /**
   * Calculate and apply break time allocation for a date range
   */
  async calculateAndApplyBreakTimeForRange(startDate: string, endDate: string): Promise<BreakTimeAllocationRangeResult> {
    const baseResult = await this.calculateAndApplyTimeForRange(startDate, endDate, this.config);
    return this.transformToBreakRangeResult(baseResult);
  }

  /**
   * Get work activities for a specific date (used for previewing)
   */
  async getWorkActivitiesForDate(date: string): Promise<WorkActivityWithDetails[]> {
    return await super.getWorkActivitiesForDate(date);
  }
}