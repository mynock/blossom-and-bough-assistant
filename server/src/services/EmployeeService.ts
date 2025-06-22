import { DatabaseService } from './DatabaseService';
import { employees, type Employee, type NewEmployee } from '../db';
import { eq, like } from 'drizzle-orm';

export class EmployeeService extends DatabaseService {
  
  /**
   * Get all employees
   */
  async getAllEmployees(): Promise<Employee[]> {
    return await this.db.select().from(employees);
  }

  /**
   * Get an employee by ID
   */
  async getEmployeeById(id: number): Promise<Employee | undefined> {
    const results = await this.db
      .select()
      .from(employees)
      .where(eq(employees.id, id));
    
    return results[0];
  }

  /**
   * Get an employee by employee ID (external identifier)
   */
  async getEmployeeByEmployeeId(employeeId: string): Promise<Employee | undefined> {
    const results = await this.db
      .select()
      .from(employees)
      .where(eq(employees.employeeId, employeeId));
    
    return results[0];
  }

  /**
   * Create a new employee
   */
  async createEmployee(data: NewEmployee): Promise<Employee> {
    const results = await this.db
      .insert(employees)
      .values(data)
      .returning();
    
    return results[0];
  }

  /**
   * Update an employee
   */
  async updateEmployee(id: number, data: Partial<NewEmployee>): Promise<Employee | undefined> {
    const results = await this.db
      .update(employees)
      .set({ ...data, updatedAt: this.formatTimestamp(new Date()) })
      .where(eq(employees.id, id))
      .returning();
    
    return results[0];
  }

  /**
   * Delete an employee
   */
  async deleteEmployee(id: number): Promise<boolean> {
    const result = await this.db.delete(employees).where(eq(employees.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Search employees by name
   */
  async searchEmployeesByName(searchTerm: string): Promise<Employee[]> {
    return await this.db
      .select()
      .from(employees)
      .where(like(employees.name, `%${searchTerm}%`));
  }

  /**
   * Get active employees only
   */
  async getActiveEmployees(): Promise<Employee[]> {
    return await this.db
      .select()
      .from(employees)
      .where(eq(employees.activeStatus, 'active'));
  }

  /**
   * Get employees available on specific workdays
   */
  async getEmployeesByWorkdays(workdays: string): Promise<Employee[]> {
    return await this.db
      .select()
      .from(employees)
      .where(like(employees.regularWorkdays, `%${workdays}%`));
  }
} 