import { DatabaseService } from './DatabaseService';
import { 
  workActivities, 
  workActivityEmployees, 
  otherCharges,
  clients,
  projects,
  employees,
  type WorkActivity, 
  type NewWorkActivity,
  type OtherCharge,
  type NewOtherCharge
} from '../db';
import { eq, desc, like, and } from 'drizzle-orm';

export interface CreateWorkActivityData {
  workActivity: NewWorkActivity;
  employees: Array<{ employeeId: number; hours: number }>;
  charges?: Array<Omit<NewOtherCharge, 'workActivityId'>>;
}

export interface WorkActivityWithDetails extends WorkActivity {
  clientName?: string | null;
  projectName?: string | null;
  employeesList: Array<{ employeeId: number; employeeName: string | null; hours: number }>;
  chargesList: OtherCharge[];
  totalCharges: number;
}

export class WorkActivityService extends DatabaseService {
  
  /**
   * Get all work activities with related data
   */
  async getAllWorkActivities(): Promise<WorkActivityWithDetails[]> {
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
        breakTimeMinutes: workActivities.breakTimeMinutes,
        notes: workActivities.notes,
        tasks: workActivities.tasks,
        createdAt: workActivities.createdAt,
        updatedAt: workActivities.updatedAt,
        clientName: clients.name,
        projectName: projects.name
      })
      .from(workActivities)
      .leftJoin(clients, eq(workActivities.clientId, clients.id))
      .leftJoin(projects, eq(workActivities.projectId, projects.id))
      .orderBy(desc(workActivities.date), desc(workActivities.createdAt));

    // Get employees and charges for each activity
    const activitiesWithDetails: WorkActivityWithDetails[] = [];
    
    for (const activity of activities) {
      const employeesList = await this.getWorkActivityEmployeesWithNames(activity.id);
      const chargesList = await this.getWorkActivityCharges(activity.id);
      const totalCharges = chargesList.reduce((sum, charge) => sum + charge.totalCost, 0);

      activitiesWithDetails.push({
        ...activity,
        employeesList,
        chargesList,
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
        breakTimeMinutes: workActivities.breakTimeMinutes,
        notes: workActivities.notes,
        tasks: workActivities.tasks,
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
    const totalCharges = chargesList.reduce((sum, charge) => sum + charge.totalCost, 0);

    return {
      ...activity,
      employeesList,
      chargesList,
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
        breakTimeMinutes: workActivities.breakTimeMinutes,
        notes: workActivities.notes,
        tasks: workActivities.tasks,
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
      const totalCharges = chargesList.reduce((sum, charge) => sum + charge.totalCost, 0);

      activitiesWithDetails.push({
        ...activity,
        employeesList,
        chargesList,
        totalCharges
      });
    }

    return activitiesWithDetails;
  }

  /**
   * Create a new work activity with employees and charges
   */
  async createWorkActivity(data: CreateWorkActivityData): Promise<WorkActivity> {
    // Create the work activity
    const workActivity = await this.db
      .insert(workActivities)
      .values(data.workActivity)
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
      const chargeData = data.charges.map(charge => ({
        ...charge,
        workActivityId,
      }));

      await this.db.insert(otherCharges).values(chargeData);
    }

    return workActivity[0];
  }

  /**
   * Update a work activity
   */
  async updateWorkActivity(id: number, data: Partial<NewWorkActivity>): Promise<WorkActivity | undefined> {
    const updated = await this.db
      .update(workActivities)
      .set({ ...data, updatedAt: this.formatTimestamp(new Date()) })
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
    
    // Delete the work activity
    const result = await this.db.delete(workActivities).where(eq(workActivities.id, id));
    
    return result.changes > 0;
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
} 