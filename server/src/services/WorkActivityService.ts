import { DatabaseService } from './DatabaseService';
import { SettingsService } from './SettingsService';
import { debugLog } from '../utils/logger';
import { 
  workActivities, 
  workActivityEmployees, 
  otherCharges,
  plantList,
  clients,
  projects,
  employees,
  type WorkActivity, 
  type NewWorkActivity,
  type OtherCharge,
  type NewOtherCharge,
  type PlantListItem,
  type NewPlantListItem
} from '../db';
import { eq, desc, like, and, gte, lte, inArray, exists } from 'drizzle-orm';

export interface CreateWorkActivityData {
  workActivity: NewWorkActivity;
  employees: Array<{ employeeId: number; hours: number }>;
  charges?: Array<Omit<NewOtherCharge, 'workActivityId'>>;
  plants?: Array<Omit<NewPlantListItem, 'workActivityId'>>;
}

export interface WorkActivityFilters {
  startDate?: string;
  endDate?: string;
  workType?: string;
  status?: string;
  clientId?: number;
  employeeId?: number;
}

export interface WorkActivityWithDetails extends WorkActivity {
  clientName?: string | null;
  projectName?: string | null;
  employeesList: Array<{ employeeId: number; employeeName: string | null; hours: number }>;
  chargesList: OtherCharge[];
  plantsList: PlantListItem[];
  totalCharges: number;
}

export class WorkActivityService extends DatabaseService {
  private settingsService: SettingsService;

  constructor() {
    super();
    this.settingsService = new SettingsService();
  }
  
  /**
   * Get all work activities with related data, optionally filtered
   */
  async getAllWorkActivities(filters?: WorkActivityFilters): Promise<WorkActivityWithDetails[]> {
    // Build WHERE conditions based on filters
    const whereConditions = [];
    
    if (filters?.startDate) {
      whereConditions.push(gte(workActivities.date, filters.startDate));
    }
    
    if (filters?.endDate) {
      whereConditions.push(lte(workActivities.date, filters.endDate));
    }
    
    if (filters?.workType) {
      whereConditions.push(eq(workActivities.workType, filters.workType));
    }
    
    if (filters?.status) {
      whereConditions.push(eq(workActivities.status, filters.status));
    }
    
    if (filters?.clientId) {
      whereConditions.push(eq(workActivities.clientId, filters.clientId));
    }
    
    // Add employee filter using EXISTS subquery
    if (filters?.employeeId) {
      whereConditions.push(
        exists(
          this.db
            .select({ id: workActivityEmployees.id })
            .from(workActivityEmployees)
            .where(
              and(
                eq(workActivityEmployees.workActivityId, workActivities.id),
                eq(workActivityEmployees.employeeId, filters.employeeId)
              )
            )
        )
      );
    }

    // Build the base query
    const baseQuery = this.db
      .select({
        id: workActivities.id,
        workType: workActivities.workType,
        date: workActivities.date,
        status: workActivities.status,
        startTime: workActivities.startTime,
        endTime: workActivities.endTime,
        billableHours: workActivities.billableHours,
        totalHours: workActivities.totalHours,
        hourlyRate: workActivities.hourlyRate,
        projectId: workActivities.projectId,
        clientId: workActivities.clientId,
        travelTimeMinutes: workActivities.travelTimeMinutes,
        adjustedTravelTimeMinutes: workActivities.adjustedTravelTimeMinutes,
        breakTimeMinutes: workActivities.breakTimeMinutes,
        nonBillableTimeMinutes: workActivities.nonBillableTimeMinutes,
        notes: workActivities.notes,
        tasks: workActivities.tasks,
        notionPageId: workActivities.notionPageId,
        lastNotionSyncAt: workActivities.lastNotionSyncAt,
        lastUpdatedBy: workActivities.lastUpdatedBy,
        createdAt: workActivities.createdAt,
        updatedAt: workActivities.updatedAt,
        clientName: clients.name,
        projectName: projects.name
      })
      .from(workActivities)
      .leftJoin(clients, eq(workActivities.clientId, clients.id))
      .leftJoin(projects, eq(workActivities.projectId, projects.id));

    // Apply WHERE conditions if any exist, otherwise use base query
    const activities = whereConditions.length > 0 
      ? await baseQuery
          .where(whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions))
          .orderBy(desc(workActivities.date), desc(workActivities.createdAt))
      : await baseQuery
          .orderBy(desc(workActivities.date), desc(workActivities.createdAt));

    // Get employees and charges for each activity
    const activitiesWithDetails: WorkActivityWithDetails[] = [];
    
    for (const activity of activities) {
      const employeesList = await this.getWorkActivityEmployeesWithNames(activity.id);
      const chargesList = await this.getWorkActivityCharges(activity.id);
      const plantsList = await this.getWorkActivityPlants(activity.id);
      const totalCharges = chargesList.reduce((sum, charge) => sum + (charge.totalCost || 0), 0);

      activitiesWithDetails.push({
        ...activity,
        employeesList,
        chargesList,
        plantsList,
        totalCharges
      });
    }

    return activitiesWithDetails;
  }

  /**
   * Get a single work activity by ID with related data
   */
  async getWorkActivityById(id: number): Promise<WorkActivityWithDetails | undefined> {
    const results = await this.db
      .select({
        id: workActivities.id,
        workType: workActivities.workType,
        date: workActivities.date,
        status: workActivities.status,
        startTime: workActivities.startTime,
        endTime: workActivities.endTime,
        billableHours: workActivities.billableHours,
        totalHours: workActivities.totalHours,
        hourlyRate: workActivities.hourlyRate,
        projectId: workActivities.projectId,
        clientId: workActivities.clientId,
        travelTimeMinutes: workActivities.travelTimeMinutes,
        adjustedTravelTimeMinutes: workActivities.adjustedTravelTimeMinutes,
        breakTimeMinutes: workActivities.breakTimeMinutes,
        nonBillableTimeMinutes: workActivities.nonBillableTimeMinutes,
        notes: workActivities.notes,
        tasks: workActivities.tasks,
        notionPageId: workActivities.notionPageId,
        lastNotionSyncAt: workActivities.lastNotionSyncAt,
        lastUpdatedBy: workActivities.lastUpdatedBy,
        createdAt: workActivities.createdAt,
        updatedAt: workActivities.updatedAt,
        clientName: clients.name,
        projectName: projects.name
      })
      .from(workActivities)
      .leftJoin(clients, eq(workActivities.clientId, clients.id))
      .leftJoin(projects, eq(workActivities.projectId, projects.id))
      .where(eq(workActivities.id, id));
    
    if (!results[0]) return undefined;

    const activity = results[0];
    const employeesList = await this.getWorkActivityEmployeesWithNames(activity.id);
    const chargesList = await this.getWorkActivityCharges(activity.id);
    const plantsList = await this.getWorkActivityPlants(activity.id);
    const totalCharges = chargesList.reduce((sum, charge) => sum + (charge.totalCost || 0), 0);

    return {
      ...activity,
      employeesList,
      chargesList,
      plantsList,
      totalCharges
    };
  }

  /**
   * Get work activities by date range
   */
  async getWorkActivitiesByDateRange(startDate: string, endDate: string): Promise<WorkActivityWithDetails[]> {
    const activities = await this.db
      .select({
        id: workActivities.id,
        workType: workActivities.workType,
        date: workActivities.date,
        status: workActivities.status,
        startTime: workActivities.startTime,
        endTime: workActivities.endTime,
        billableHours: workActivities.billableHours,
        totalHours: workActivities.totalHours,
        hourlyRate: workActivities.hourlyRate,
        projectId: workActivities.projectId,
        clientId: workActivities.clientId,
        travelTimeMinutes: workActivities.travelTimeMinutes,
        adjustedTravelTimeMinutes: workActivities.adjustedTravelTimeMinutes,
        breakTimeMinutes: workActivities.breakTimeMinutes,
        nonBillableTimeMinutes: workActivities.nonBillableTimeMinutes,
        notes: workActivities.notes,
        tasks: workActivities.tasks,
        notionPageId: workActivities.notionPageId,
        lastNotionSyncAt: workActivities.lastNotionSyncAt,
        lastUpdatedBy: workActivities.lastUpdatedBy,
        createdAt: workActivities.createdAt,
        updatedAt: workActivities.updatedAt,
        clientName: clients.name,
        projectName: projects.name
      })
      .from(workActivities)
      .leftJoin(clients, eq(workActivities.clientId, clients.id))
      .leftJoin(projects, eq(workActivities.projectId, projects.id))
      .where(and(
        eq(workActivities.date, startDate), // For now, just match exact date
        // TODO: Add proper date range filtering
      ))
      .orderBy(desc(workActivities.date), desc(workActivities.createdAt));

    // Get employees and charges for each activity
    const activitiesWithDetails: WorkActivityWithDetails[] = [];
    
    for (const activity of activities) {
      const employeesList = await this.getWorkActivityEmployeesWithNames(activity.id);
      const chargesList = await this.getWorkActivityCharges(activity.id);
      const plantsList = await this.getWorkActivityPlants(activity.id);
      const totalCharges = chargesList.reduce((sum, charge) => sum + (charge.totalCost || 0), 0);

      activitiesWithDetails.push({
        ...activity,
        employeesList,
        chargesList,
        plantsList,
        totalCharges
      });
    }

    return activitiesWithDetails;
  }

  /**
   * Create a new work activity with employees and charges
   */
  async createWorkActivity(data: CreateWorkActivityData): Promise<WorkActivity> {
    let workActivityData = { ...data.workActivity };
    
    // If billable hours is provided directly, apply rounding
    if (workActivityData.billableHours !== undefined && workActivityData.billableHours !== null) {
      try {
        const roundedHours = await this.settingsService.roundHours(workActivityData.billableHours);
        workActivityData = {
          ...workActivityData,
          billableHours: roundedHours
        };
        debugLog.info(`🧮 Applied rounding to billable hours for new work activity: ${data.workActivity.billableHours} -> ${roundedHours}`);
      } catch (error) {
        debugLog.warn(`⚠️ Failed to apply rounding to billable hours for new work activity: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Continue with unrounded hours if rounding fails
      }
    } else if (workActivityData.totalHours) {
      // If billable hours is not provided but we have total hours, calculate it
      let calculatedBillableHours = this.calculateBillableHours(
        workActivityData.totalHours,
        workActivityData.breakTimeMinutes || 0,
        workActivityData.nonBillableTimeMinutes || 0,
        workActivityData.adjustedTravelTimeMinutes || 0
      );
      
      // Apply rounding to calculated billable hours
      try {
        const roundedHours = await this.settingsService.roundHours(calculatedBillableHours);
        workActivityData = {
          ...workActivityData,
          billableHours: roundedHours
        };
        debugLog.info(`🧮 Calculated and rounded billable hours for new work activity: totalHours=${workActivityData.totalHours}, calculated=${calculatedBillableHours} -> ${roundedHours}`);
      } catch (error) {
        debugLog.warn(`⚠️ Failed to apply rounding to calculated billable hours for new work activity: ${error instanceof Error ? error.message : 'Unknown error'}`);
        workActivityData = {
          ...workActivityData,
          billableHours: calculatedBillableHours
        };
      }
    }
    
    // Create the work activity
    const workActivity = await this.db
      .insert(workActivities)
      .values(workActivityData)
      .returning();

    const workActivityId = workActivity[0].id;

    // Add employees
    if (data.employees.length > 0) {
      const employeeData = data.employees.map(emp => ({
        workActivityId,
        employeeId: emp.employeeId,
        hours: emp.hours,
      }));

      await this.db.insert(workActivityEmployees).values(employeeData);
    }

    // Add charges if provided
    if (data.charges && data.charges.length > 0) {
      debugLog.debug(`Processing ${data.charges.length} charges for work activity ${workActivityId}`);
      
      const chargeData = data.charges.map((charge, index) => {
        const processedCharge = {
          workActivityId,
          chargeType: charge.chargeType || 'material',
          description: charge.description || 'Unknown charge',
          quantity: charge.quantity || null,
          unitRate: charge.unitRate || null,
          totalCost: charge.totalCost || null, // Allow null cost for non-billable or informational charges
          billable: charge.billable !== undefined ? charge.billable : true
        };
        
        debugLog.debug(`Charge ${index + 1}:`, processedCharge);
        return processedCharge;
      }).filter(charge => charge.description && charge.description !== 'Unknown charge');

      if (chargeData.length > 0) {
        debugLog.debug(`Inserting ${chargeData.length} valid charges into database`);
        await this.db.insert(otherCharges).values(chargeData);
      } else {
        debugLog.warn('No valid charges to insert after filtering');
      }
    }

    // Add plants if provided
    if (data.plants && data.plants.length > 0) {
      const plantData = data.plants.map(plant => ({
        ...plant,
        workActivityId,
      }));

      await this.db.insert(plantList).values(plantData);
    }

    return workActivity[0];
  }

  /**
   * Calculate billable hours from the component values
   * Break time is billable, only non-billable time is subtracted
   * Formula: totalHours - (nonBillableTimeMinutes/60) + (adjustedTravelTimeMinutes/60)
   */
  private calculateBillableHours(
    totalHours: number,
    breakTimeMinutes: number = 0,
    nonBillableTimeMinutes: number = 0,
    adjustedTravelTimeMinutes: number = 0
  ): number {
    const nonBillableHours = nonBillableTimeMinutes / 60;
    const adjustedTravelHours = adjustedTravelTimeMinutes / 60;
    
    // Break time is billable, only subtract non-billable time
    const billableHours = totalHours - nonBillableHours + adjustedTravelHours;
    
    // Ensure billable hours is not negative
    return Math.max(0, Math.round(billableHours * 100) / 100); // Round to 2 decimal places
  }

  /**
   * Update a work activity
   */
  async updateWorkActivity(id: number, data: Partial<NewWorkActivity>): Promise<WorkActivity | undefined> {
    let finalUpdateData = { ...data };
    
    // Get current work activity to access current values for recalculation
    const currentActivity = await this.getWorkActivityById(id);
    if (!currentActivity) {
      throw new Error(`Work activity with ID ${id} not found`);
    }
    
    // Check if any field that affects billable hours calculation is being updated
    const billableHoursInputsChanged = (
      data.totalHours !== undefined ||
      data.breakTimeMinutes !== undefined ||
      data.nonBillableTimeMinutes !== undefined ||
      data.adjustedTravelTimeMinutes !== undefined
    );
    
    // If billable hours is being updated directly (not from calculation), apply rounding
    if (data.billableHours !== undefined && data.billableHours !== null && !billableHoursInputsChanged) {
      try {
        const roundedHours = await this.settingsService.roundHours(data.billableHours);
        finalUpdateData = {
          ...finalUpdateData,
          billableHours: roundedHours
        };
        debugLog.info(`🧮 Applied rounding to billable hours for work activity ${id}: ${data.billableHours} -> ${roundedHours}`);
      } catch (error) {
        debugLog.warn(`⚠️ Failed to apply rounding to billable hours for work activity ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Continue with unrounded hours if rounding fails
      }
    }
    
    // If any input to billable hours calculation changed, recalculate billable hours
    if (billableHoursInputsChanged) {
             // Use updated values where provided, otherwise use current values
       const newTotalHours = data.totalHours !== undefined ? data.totalHours : currentActivity.totalHours;
       const newBreakTimeMinutes = data.breakTimeMinutes !== undefined ? data.breakTimeMinutes : (currentActivity.breakTimeMinutes || 0);
       const newNonBillableTimeMinutes = data.nonBillableTimeMinutes !== undefined ? data.nonBillableTimeMinutes : (currentActivity.nonBillableTimeMinutes || 0);
       const newAdjustedTravelTimeMinutes = data.adjustedTravelTimeMinutes !== undefined ? (data.adjustedTravelTimeMinutes || 0) : (currentActivity.adjustedTravelTimeMinutes || 0);
      
             // Calculate new billable hours using the standard formula
       let newBillableHours = this.calculateBillableHours(
         newTotalHours,
         newBreakTimeMinutes || undefined,
         newNonBillableTimeMinutes || undefined,
         newAdjustedTravelTimeMinutes
       );
      
      // Apply rounding if enabled in settings
      try {
        const roundedHours = await this.settingsService.roundHours(newBillableHours);
        debugLog.info(`🧮 Recalculated billable hours for work activity ${id}: totalHours=${newTotalHours}, breakTime=${newBreakTimeMinutes}min, nonBillableTime=${newNonBillableTimeMinutes}min, adjustedTravel=${newAdjustedTravelTimeMinutes}min -> ${newBillableHours} billable hours -> ${roundedHours} rounded billable hours`);
        newBillableHours = roundedHours;
      } catch (error) {
        debugLog.warn(`⚠️ Failed to apply rounding to recalculated billable hours for work activity ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Continue with unrounded hours if rounding fails
      }
      
      // Add the recalculated billable hours to the update data
      finalUpdateData = {
        ...finalUpdateData,
        billableHours: newBillableHours
      };
    }
    
    // Set lastUpdatedBy to 'web_app' by default unless explicitly provided (for Notion sync)
    // Filter out timestamp fields that should not be updated by frontend to avoid type errors
    const { createdAt, updatedAt, lastNotionSyncAt, ...safeUpdateData } = finalUpdateData;
    
    const updateData = {
      ...safeUpdateData,
      updatedAt: this.formatTimestamp(new Date()),
      lastUpdatedBy: finalUpdateData.lastUpdatedBy || 'web_app' as const,
      // Only include lastNotionSyncAt if it's a Date object (from Notion sync)
      ...(lastNotionSyncAt instanceof Date && { lastNotionSyncAt })
    };
    
    const updated = await this.db
      .update(workActivities)
      .set(updateData)
      .where(eq(workActivities.id, id))
      .returning();

    return updated[0];
  }

  /**
   * Delete a work activity and all related data
   */
  async deleteWorkActivity(id: number): Promise<boolean> {
    // Delete related records first (foreign key constraints)
    await this.db.delete(workActivityEmployees).where(eq(workActivityEmployees.workActivityId, id));
    await this.db.delete(otherCharges).where(eq(otherCharges.workActivityId, id));
    await this.db.delete(plantList).where(eq(plantList.workActivityId, id));
    
    // Delete the work activity
    const result = await this.db.delete(workActivities).where(eq(workActivities.id, id));
    
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get employees for a work activity with names
   */
  async getWorkActivityEmployeesWithNames(workActivityId: number): Promise<Array<{ employeeId: number; employeeName: string | null; hours: number }>> {
    const results = await this.db
      .select({
        employeeId: workActivityEmployees.employeeId,
        employeeName: employees.name,
        hours: workActivityEmployees.hours
      })
      .from(workActivityEmployees)
      .leftJoin(employees, eq(workActivityEmployees.employeeId, employees.id))
      .where(eq(workActivityEmployees.workActivityId, workActivityId));

    return results;
  }

  /**
   * Get employees for a work activity (basic)
   */
  async getWorkActivityEmployees(workActivityId: number): Promise<any[]> {
    return await this.db
      .select()
      .from(workActivityEmployees)
      .where(eq(workActivityEmployees.workActivityId, workActivityId));
  }

  /**
   * Get charges for a work activity
   */
  async getWorkActivityCharges(workActivityId: number): Promise<OtherCharge[]> {
    return await this.db
      .select()
      .from(otherCharges)
      .where(eq(otherCharges.workActivityId, workActivityId));
  }

  /**
   * Get plant list for a work activity
   */
  async getWorkActivityPlants(workActivityId: number): Promise<PlantListItem[]> {
    return await this.db
      .select()
      .from(plantList)
      .where(eq(plantList.workActivityId, workActivityId));
  }

  /**
   * Find existing work activities by client and date for duplicate checking
   */
  async findExistingWorkActivities(clientId: number, date: string): Promise<WorkActivityWithDetails[]> {
    const activities = await this.db
      .select({
        id: workActivities.id,
        workType: workActivities.workType,
        date: workActivities.date,
        status: workActivities.status,
        startTime: workActivities.startTime,
        endTime: workActivities.endTime,
        billableHours: workActivities.billableHours,
        totalHours: workActivities.totalHours,
        hourlyRate: workActivities.hourlyRate,
        projectId: workActivities.projectId,
        clientId: workActivities.clientId,
        travelTimeMinutes: workActivities.travelTimeMinutes,
        adjustedTravelTimeMinutes: workActivities.adjustedTravelTimeMinutes,
        breakTimeMinutes: workActivities.breakTimeMinutes,
        nonBillableTimeMinutes: workActivities.nonBillableTimeMinutes,
        notes: workActivities.notes,
        tasks: workActivities.tasks,
        notionPageId: workActivities.notionPageId,
        lastNotionSyncAt: workActivities.lastNotionSyncAt,
        lastUpdatedBy: workActivities.lastUpdatedBy,
        createdAt: workActivities.createdAt,
        updatedAt: workActivities.updatedAt,
        clientName: clients.name,
        projectName: projects.name
      })
      .from(workActivities)
      .leftJoin(clients, eq(workActivities.clientId, clients.id))
      .leftJoin(projects, eq(workActivities.projectId, projects.id))
      .where(and(
        eq(workActivities.clientId, clientId),
        eq(workActivities.date, date)
      ))
      .orderBy(desc(workActivities.createdAt));

    // Get employees and charges for each activity
    const activitiesWithDetails: WorkActivityWithDetails[] = [];
    
    for (const activity of activities) {
      const employeesList = await this.getWorkActivityEmployeesWithNames(activity.id);
      const chargesList = await this.getWorkActivityCharges(activity.id);
      const plantsList = await this.getWorkActivityPlants(activity.id);
      const totalCharges = chargesList.reduce((sum, charge) => sum + (charge.totalCost || 0), 0);

      activitiesWithDetails.push({
        ...activity,
        employeesList,
        chargesList,
        plantsList,
        totalCharges
      });
    }

    return activitiesWithDetails;
  }

  /**
   * Get all work activities for a specific client
   */
  async getWorkActivitiesByClientId(clientId: number): Promise<WorkActivityWithDetails[]> {
    const activities = await this.db
      .select({
        id: workActivities.id,
        workType: workActivities.workType,
        date: workActivities.date,
        status: workActivities.status,
        startTime: workActivities.startTime,
        endTime: workActivities.endTime,
        billableHours: workActivities.billableHours,
        totalHours: workActivities.totalHours,
        hourlyRate: workActivities.hourlyRate,
        projectId: workActivities.projectId,
        clientId: workActivities.clientId,
        travelTimeMinutes: workActivities.travelTimeMinutes,
        adjustedTravelTimeMinutes: workActivities.adjustedTravelTimeMinutes,
        breakTimeMinutes: workActivities.breakTimeMinutes,
        nonBillableTimeMinutes: workActivities.nonBillableTimeMinutes,
        notes: workActivities.notes,
        tasks: workActivities.tasks,
        notionPageId: workActivities.notionPageId,
        lastNotionSyncAt: workActivities.lastNotionSyncAt,
        lastUpdatedBy: workActivities.lastUpdatedBy,
        createdAt: workActivities.createdAt,
        updatedAt: workActivities.updatedAt,
        clientName: clients.name,
        projectName: projects.name
      })
      .from(workActivities)
      .leftJoin(clients, eq(workActivities.clientId, clients.id))
      .leftJoin(projects, eq(workActivities.projectId, projects.id))
      .where(eq(workActivities.clientId, clientId))
      .orderBy(desc(workActivities.date), desc(workActivities.createdAt));

    // Get employees and charges for each activity
    const activitiesWithDetails: WorkActivityWithDetails[] = [];
    
    for (const activity of activities) {
      const employeesList = await this.getWorkActivityEmployeesWithNames(activity.id);
      const chargesList = await this.getWorkActivityCharges(activity.id);
      const plantsList = await this.getWorkActivityPlants(activity.id);
      const totalCharges = chargesList.reduce((sum, charge) => sum + (charge.totalCost || 0), 0);

      activitiesWithDetails.push({
        ...activity,
        employeesList,
        chargesList,
        plantsList,
        totalCharges
      });
    }

    return activitiesWithDetails;
  }

  /**
   * Get all work activities for a specific employee
   */
  async getWorkActivitiesByEmployeeId(employeeId: number): Promise<WorkActivityWithDetails[]> {
    // Use a join query to get activities where the employee participated
    const activities = await this.db
      .select({
        id: workActivities.id,
        workType: workActivities.workType,
        date: workActivities.date,
        status: workActivities.status,
        startTime: workActivities.startTime,
        endTime: workActivities.endTime,
        billableHours: workActivities.billableHours,
        totalHours: workActivities.totalHours,
        hourlyRate: workActivities.hourlyRate,
        projectId: workActivities.projectId,
        clientId: workActivities.clientId,
        travelTimeMinutes: workActivities.travelTimeMinutes,
        adjustedTravelTimeMinutes: workActivities.adjustedTravelTimeMinutes,
        breakTimeMinutes: workActivities.breakTimeMinutes,
        nonBillableTimeMinutes: workActivities.nonBillableTimeMinutes,
        notes: workActivities.notes,
        tasks: workActivities.tasks,
        notionPageId: workActivities.notionPageId,
        lastNotionSyncAt: workActivities.lastNotionSyncAt,
        lastUpdatedBy: workActivities.lastUpdatedBy,
        createdAt: workActivities.createdAt,
        updatedAt: workActivities.updatedAt,
        clientName: clients.name,
        projectName: projects.name
      })
      .from(workActivities)
      .innerJoin(workActivityEmployees, eq(workActivities.id, workActivityEmployees.workActivityId))
      .leftJoin(clients, eq(workActivities.clientId, clients.id))
      .leftJoin(projects, eq(workActivities.projectId, projects.id))
      .where(eq(workActivityEmployees.employeeId, employeeId))
      .orderBy(desc(workActivities.date), desc(workActivities.createdAt));

    // Get employees and charges for each activity
    const activitiesWithDetails: WorkActivityWithDetails[] = [];
    
    for (const activity of activities) {
      const employeesList = await this.getWorkActivityEmployeesWithNames(activity.id);
      const chargesList = await this.getWorkActivityCharges(activity.id);
      const plantsList = await this.getWorkActivityPlants(activity.id);
      const totalCharges = chargesList.reduce((sum, charge) => sum + (charge.totalCost || 0), 0);

      activitiesWithDetails.push({
        ...activity,
        employeesList,
        chargesList,
        plantsList,
        totalCharges
      });
    }

    return activitiesWithDetails;
  }

  /**
   * Get a work activity by Notion page ID
   */
  async getWorkActivityByNotionPageId(notionPageId: string): Promise<WorkActivityWithDetails | undefined> {
    const results = await this.db
      .select({
        id: workActivities.id,
        workType: workActivities.workType,
        date: workActivities.date,
        status: workActivities.status,
        startTime: workActivities.startTime,
        endTime: workActivities.endTime,
        billableHours: workActivities.billableHours,
        totalHours: workActivities.totalHours,
        hourlyRate: workActivities.hourlyRate,
        projectId: workActivities.projectId,
        clientId: workActivities.clientId,
        travelTimeMinutes: workActivities.travelTimeMinutes,
        adjustedTravelTimeMinutes: workActivities.adjustedTravelTimeMinutes,
        breakTimeMinutes: workActivities.breakTimeMinutes,
        nonBillableTimeMinutes: workActivities.nonBillableTimeMinutes,
        notes: workActivities.notes,
        tasks: workActivities.tasks,
        notionPageId: workActivities.notionPageId,
        lastNotionSyncAt: workActivities.lastNotionSyncAt,
        lastUpdatedBy: workActivities.lastUpdatedBy,
        createdAt: workActivities.createdAt,
        updatedAt: workActivities.updatedAt,
        clientName: clients.name,
        projectName: projects.name
      })
      .from(workActivities)
      .leftJoin(clients, eq(workActivities.clientId, clients.id))
      .leftJoin(projects, eq(workActivities.projectId, projects.id))
      .where(eq(workActivities.notionPageId, notionPageId));
    
    if (!results[0]) return undefined;

    const activity = results[0];
    const employeesList = await this.getWorkActivityEmployeesWithNames(activity.id);
    const chargesList = await this.getWorkActivityCharges(activity.id);
    const plantsList = await this.getWorkActivityPlants(activity.id);
    const totalCharges = chargesList.reduce((sum, charge) => sum + (charge.totalCost || 0), 0);

    return {
      ...activity,
      employeesList,
      chargesList,
      plantsList,
      totalCharges
    };
  }
} 