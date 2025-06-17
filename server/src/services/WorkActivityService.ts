import { DatabaseService } from './DatabaseService';
import { 
  workActivities, 
  workActivityEmployees, 
  otherCharges,
  type WorkActivity, 
  type NewWorkActivity,
  type OtherCharge,
  type NewOtherCharge
} from '../db';
import { eq } from 'drizzle-orm';

export interface CreateWorkActivityData {
  workActivity: NewWorkActivity;
  employees: Array<{ employeeId: number; hours: number }>;
  charges?: Array<Omit<NewOtherCharge, 'workActivityId'>>;
}

export class WorkActivityService extends DatabaseService {
  
  /**
   * Get all work activities
   */
  async getAllWorkActivities(): Promise<WorkActivity[]> {
    return await this.db.select().from(workActivities);
  }

  /**
   * Get a single work activity by ID
   */
  async getWorkActivityById(id: number): Promise<WorkActivity | undefined> {
    const results = await this.db
      .select()
      .from(workActivities)
      .where(eq(workActivities.id, id));
    
    return results[0];
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
   * Get employees for a work activity
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