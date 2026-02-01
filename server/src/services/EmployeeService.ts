import { BaseCrudService } from './BaseCrudService';
import { employees, type Employee, type NewEmployee } from '../db';
import { eq } from 'drizzle-orm';

export class EmployeeService extends BaseCrudService<typeof employees, Employee, NewEmployee> {
  protected table = employees;
  protected idColumn = employees.id;

  /**
   * Get all employees
   */
  async getAllEmployees(): Promise<Employee[]> {
    return this.getAll();
  }

  /**
   * Get an employee by ID
   */
  async getEmployeeById(id: number): Promise<Employee | undefined> {
    return this.getById(id);
  }

  /**
   * Get an employee by employee ID (external identifier)
   */
  async getEmployeeByEmployeeId(employeeId: string): Promise<Employee | undefined> {
    return this.getOneWhere(eq(employees.employeeId, employeeId));
  }

  /**
   * Create a new employee
   */
  async createEmployee(data: NewEmployee): Promise<Employee> {
    return this.create(data);
  }

  /**
   * Update an employee
   */
  async updateEmployee(id: number, data: Partial<NewEmployee>): Promise<Employee | undefined> {
    return this.update(id, data);
  }

  /**
   * Delete an employee
   */
  async deleteEmployee(id: number): Promise<boolean> {
    return this.delete(id);
  }

  /**
   * Search employees by name
   */
  async searchEmployeesByName(searchTerm: string): Promise<Employee[]> {
    return this.searchByColumn(employees.name, searchTerm);
  }

  /**
   * Get active employees only
   */
  async getActiveEmployees(): Promise<Employee[]> {
    return this.getWhere(eq(employees.activeStatus, 'active'));
  }

  /**
   * Get employees available on specific workdays
   */
  async getEmployeesByWorkdays(workdays: string): Promise<Employee[]> {
    return this.searchByColumn(employees.regularWorkdays, workdays);
  }

  /**
   * Get an employee by name (exact match)
   */
  async getEmployeeByName(name: string): Promise<Employee | undefined> {
    return this.getOneWhere(eq(employees.name, name));
  }
}
