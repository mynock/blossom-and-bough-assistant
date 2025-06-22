import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { debugLog } from '../utils/logger';
import { DataMigrationService } from './DataMigrationService';
import { DatabaseService } from './DatabaseService';
import { workActivities, workActivityEmployees, otherCharges, projects, clientNotes } from '../db/index';

const execAsync = promisify(exec);

export interface ScriptResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
}

export interface DatabaseStatus {
  employeesCount: number;
  clientsCount: number;
  projectsCount: number;
  workActivitiesCount: number;
  employeeAssignmentsCount: number;
  chargesCount: number;
}

export class AdminService {
  private migrationService: DataMigrationService;
  private dbService: DatabaseService;

  constructor() {
    this.migrationService = new DataMigrationService();
    this.dbService = new DatabaseService();
  }

  /**
   * Get current database status
   */
  async getDatabaseStatus(): Promise<DatabaseStatus> {
    try {
      const status = await this.migrationService.getMigrationStatus();
      const employeeAssignments = await this.dbService.db.select().from(workActivityEmployees);
      const charges = await this.dbService.db.select().from(otherCharges);
      const projectsList = await this.dbService.db.select().from(projects);

      return {
        employeesCount: status.employeesCount,
        clientsCount: status.clientsCount,
        projectsCount: projectsList.length,
        workActivitiesCount: status.workActivitiesCount,
        employeeAssignmentsCount: employeeAssignments.length,
        chargesCount: charges.length
      };
    } catch (error) {
      debugLog.error('Error getting database status', { error });
      throw error;
    }
  }

  /**
   * Clear work activities only (keeps clients, employees, projects)
   */
  async clearWorkActivities(): Promise<ScriptResult> {
    const startTime = Date.now();
    
    try {
      debugLog.info('Admin: Starting work activities clear');
      
      // Delete in correct order to respect foreign key constraints
      await this.dbService.db.delete(otherCharges);
      await this.dbService.db.delete(workActivityEmployees);
      await this.dbService.db.delete(workActivities);

      const duration = Date.now() - startTime;
      debugLog.info('Admin: Work activities cleared successfully', { duration });

      return {
        success: true,
        output: 'Work activities, employee assignments, and charges cleared successfully',
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      debugLog.error('Admin: Error clearing work activities', { error, duration });
      
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      };
    }
  }

  /**
   * Clear projects and all work data (keeps clients and employees)
   */
  async clearProjectsAndWorkData(): Promise<ScriptResult> {
    const startTime = Date.now();
    
    try {
      debugLog.info('Admin: Starting projects and work data clear');
      
      // Delete in correct order to respect foreign key constraints
      await this.dbService.db.delete(otherCharges);
      await this.dbService.db.delete(workActivityEmployees);
      await this.dbService.db.delete(workActivities);
      await this.dbService.db.delete(clientNotes);
      await this.dbService.db.delete(projects);

      const duration = Date.now() - startTime;
      debugLog.info('Admin: Projects and work data cleared successfully', { duration });

      return {
        success: true,
        output: 'Projects, work activities, employee assignments, charges, and client notes cleared successfully',
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      debugLog.error('Admin: Error clearing projects and work data', { error, duration });
      
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      };
    }
  }

  /**
   * Clear all data from database
   */
  async clearAllData(): Promise<ScriptResult> {
    const startTime = Date.now();
    
    try {
      debugLog.info('Admin: Starting full database clear');
      
      await this.migrationService.clearAllData();

      const duration = Date.now() - startTime;
      debugLog.info('Admin: All data cleared successfully', { duration });

      return {
        success: true,
        output: 'All data cleared from database successfully',
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      debugLog.error('Admin: Error clearing all data', { error, duration });
      
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      };
    }
  }

  /**
   * Import employees data
   */
  async importEmployees(): Promise<ScriptResult> {
    const startTime = Date.now();
    
    try {
      debugLog.info('Admin: Starting employees import');
      
      const result = await this.migrationService.migrateEmployees();
      const duration = Date.now() - startTime;

      debugLog.info('Admin: Employees import completed', { 
        imported: result.imported, 
        errors: result.errors.length,
        duration 
      });

      let output = `Imported ${result.imported} employees`;
      if (result.errors.length > 0) {
        output += `\nWarnings/Errors: ${result.errors.length}`;
        result.errors.forEach(error => {
          output += `\n  - ${error}`;
        });
      }

      return {
        success: true,
        output,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      debugLog.error('Admin: Error importing employees', { error, duration });
      
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      };
    }
  }

  /**
   * Import clients data
   */
  async importClients(): Promise<ScriptResult> {
    const startTime = Date.now();
    
    try {
      debugLog.info('Admin: Starting clients import');
      
      const result = await this.migrationService.migrateClients();
      const duration = Date.now() - startTime;

      debugLog.info('Admin: Clients import completed', { 
        imported: result.imported, 
        errors: result.errors.length,
        duration 
      });

      let output = `Imported ${result.imported} clients`;
      if (result.errors.length > 0) {
        output += `\nWarnings/Errors: ${result.errors.length}`;
        result.errors.forEach(error => {
          output += `\n  - ${error}`;
        });
      }

      return {
        success: true,
        output,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      debugLog.error('Admin: Error importing clients', { error, duration });
      
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      };
    }
  }

  /**
   * Import all basic data (employees and clients)
   */
  async importAllBasicData(): Promise<ScriptResult> {
    const startTime = Date.now();
    
    try {
      debugLog.info('Admin: Starting full basic data import');
      
      const employeeResult = await this.migrationService.migrateEmployees();
      const clientResult = await this.migrationService.migrateClients();
      
      const duration = Date.now() - startTime;

      debugLog.info('Admin: Full basic data import completed', { 
        employeesImported: employeeResult.imported,
        clientsImported: clientResult.imported,
        totalErrors: employeeResult.errors.length + clientResult.errors.length,
        duration 
      });

      let output = `Import completed:\n`;
      output += `  - Employees: ${employeeResult.imported} imported`;
      output += `\n  - Clients: ${clientResult.imported} imported`;
      
      const allErrors = [...employeeResult.errors, ...clientResult.errors];
      if (allErrors.length > 0) {
        output += `\n\nWarnings/Errors: ${allErrors.length}`;
        allErrors.forEach(error => {
          output += `\n  - ${error}`;
        });
      }

      return {
        success: true,
        output,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      debugLog.error('Admin: Error importing all basic data', { error, duration });
      
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      };
    }
  }

  /**
   * Run database migrations
   */
  async runMigrations(): Promise<ScriptResult> {
    const startTime = Date.now();
    
    try {
      debugLog.info('Admin: Starting database migrations');
      
      // Run the migration script
      const scriptPath = path.resolve(__dirname, '../../scripts/migrate-and-exit.js');
      const { stdout, stderr } = await execAsync(`node ${scriptPath}`, {
        cwd: path.resolve(__dirname, '../..'),
        env: { ...process.env }
      });

      const duration = Date.now() - startTime;
      debugLog.info('Admin: Database migrations completed', { duration });

      let output = stdout;
      if (stderr) {
        output += '\nWarnings:\n' + stderr;
      }

      return {
        success: true,
        output: output || 'Migrations completed successfully',
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      debugLog.error('Admin: Error running migrations', { error, duration });
      
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      };
    }
  }

  /**
   * Validate admin permissions for a user
   */
  isUserAdmin(user: any): boolean {
    // In development mode with auth bypass, allow access
    if (process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true') {
      debugLog.debug('Admin access granted via development auth bypass');
      return true;
    }
    
    // For now, all authenticated users are admins
    // TODO: Implement proper role-based access control
    const hasAccess = !!user;
    debugLog.debug('Admin access check', { hasUser: !!user, hasAccess });
    return hasAccess;
  }
} 