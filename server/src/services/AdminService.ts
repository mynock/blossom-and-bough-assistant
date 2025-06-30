import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { debugLog } from '../utils/logger';
import { DataMigrationService } from './DataMigrationService';
import { DatabaseService } from './DatabaseService';
import { GoogleSheetsHistoricalDataService } from './GoogleSheetsHistoricalDataService';
import { AnthropicService } from './AnthropicService';
import { WorkActivityService } from './WorkActivityService';
import { workActivities, workActivityEmployees, otherCharges, projects, clientNotes, clients, employees } from '../db/index';
import { like } from 'drizzle-orm';

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

export interface WorkActivityImportOptions {
  client: string;
  dryRun?: boolean;
  interactive?: boolean;
  batchSize?: number;
  maxBatches?: number;
  startBatch?: number;
  startDate?: string;
  endDate?: string;
  force?: boolean;
}

export interface ImportProgress {
  phase: 'loading' | 'parsing' | 'filtering' | 'saving' | 'complete' | 'error';
  message: string;
  progress?: number;
  total?: number;
  details?: any;
}

export interface WorkActivityImportResult {
  success: boolean;
  message: string;
  duration: number;
  error?: string;
  details?: {
    totalFound: number;
    totalSaved: number;
    duplicatesSkipped: number;
    errors: string[];
  };
}

export class AdminService {
  private migrationService: DataMigrationService;
  private dbService: DatabaseService;
  private sheetsService: GoogleSheetsHistoricalDataService;
  private anthropicService: AnthropicService;
  private workActivityService: WorkActivityService;

  constructor() {
    this.migrationService = new DataMigrationService();
    this.dbService = new DatabaseService();
    this.sheetsService = new GoogleSheetsHistoricalDataService();
    this.anthropicService = new AnthropicService();
    this.workActivityService = new WorkActivityService();
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
   * Get available client sheets for work activity import
   */
  async getAvailableClients(): Promise<ScriptResult & { clients?: string[] }> {
    const startTime = Date.now();
    
    try {
      debugLog.info('Admin: Getting available client sheets');
      
      const clients = await this.sheetsService.getClientSheets();
      const duration = Date.now() - startTime;

      debugLog.info('Admin: Retrieved client sheets', { count: clients.length, duration });

      return {
        success: true,
        output: `Found ${clients.length} client sheets`,
        duration,
        clients
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      debugLog.error('Admin: Error getting client sheets', { error, duration });
      
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      };
    }
  }

  /**
   * Preview client data before import
   */
  async previewClientData(clientName: string): Promise<ScriptResult & { preview?: any }> {
    const startTime = Date.now();
    
    try {
      debugLog.info('Admin: Previewing client data', { clientName });
      
      const preview = await this.sheetsService.previewClientData(clientName);
      const duration = Date.now() - startTime;

      debugLog.info('Admin: Client data preview completed', { 
        clientName, 
        totalRows: preview.totalRows,
        duration 
      });

      return {
        success: true,
        output: `Preview for ${clientName}: ${preview.totalRows} rows`,
        duration,
        preview
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      debugLog.error('Admin: Error previewing client data', { error, clientName, duration });
      
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      };
    }
  }

  /**
   * Import work activities from historical data with progress callbacks
   */
  async importWorkActivities(
    options: WorkActivityImportOptions,
    progressCallback?: (progress: ImportProgress) => void
  ): Promise<WorkActivityImportResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      debugLog.info('Admin: Starting work activities import', { options });
      
      const updateProgress = (progress: ImportProgress) => {
        debugLog.debug('Admin: Import progress', progress);
        if (progressCallback) {
          progressCallback(progress);
        }
      };

      updateProgress({
        phase: 'loading',
        message: `Loading data for client: ${options.client}`
      });

      // Load client data
      const sheetData = await this.sheetsService.extractClientData(options.client);
      
      updateProgress({
        phase: 'parsing',
        message: `Parsing ${sheetData.dataRows.length} rows`,
        progress: 0,
        total: sheetData.dataRows.length
      });

      // Parse activities with progress tracking
      const activities = await this.anthropicService.parseHistoricalSheetData(
        options.client,
        sheetData.headers,
        sheetData.dataRows,
        undefined,
        {
          batchSize: options.batchSize || 8,
          onProgress: (message: string) => {
            updateProgress({
              phase: 'parsing',
              message
            });
          },
          onBatchComplete: async (batchIndex: number, batchActivities: any[], totalBatches: number) => {
            updateProgress({
              phase: 'parsing',
              message: `Completed batch ${batchIndex + 1}/${totalBatches}`,
              progress: batchIndex + 1,
              total: totalBatches
            });
            
            // Check if we've reached max batches limit
            if (options.maxBatches && (batchIndex + 1) >= (options.startBatch || 1) - 1 + options.maxBatches) {
              updateProgress({
                phase: 'parsing',
                message: `Reached maximum batches limit (${options.maxBatches})`
              });
              return false; // Stop processing
            }
            
            // For web interface, auto-continue (no interactive prompts)
            return true;
          }
        }
      );

      updateProgress({
        phase: 'filtering',
        message: `Filtering ${activities.length} activities`
      });

      // Apply date filtering
      let filteredActivities = activities;
      if (options.startDate || options.endDate) {
        const originalCount = filteredActivities.length;
        filteredActivities = filteredActivities.filter(activity => {
          const activityDate = new Date(activity.date);
          
          if (options.startDate && activityDate < new Date(options.startDate)) {
            return false;
          }
          
          if (options.endDate && activityDate > new Date(options.endDate)) {
            return false;
          }
          
          return true;
        });
        
        updateProgress({
          phase: 'filtering',
          message: `Date filtering: ${originalCount} → ${filteredActivities.length} activities`
        });
      }

      if (filteredActivities.length === 0) {
        const duration = Date.now() - startTime;
        return {
          success: true,
          message: 'No activities to import after filtering',
          duration,
          details: {
            totalFound: activities.length,
            totalSaved: 0,
            duplicatesSkipped: 0,
            errors: []
          }
        };
      }

      // Handle dry run
      if (options.dryRun) {
        const duration = Date.now() - startTime;
        updateProgress({
          phase: 'complete',
          message: `Dry run complete - found ${filteredActivities.length} activities`
        });

        return {
          success: true,
          message: `Dry run complete - would import ${filteredActivities.length} activities`,
          duration,
          details: {
            totalFound: filteredActivities.length,
            totalSaved: 0,
            duplicatesSkipped: 0,
            errors: []
          }
        };
      }

      updateProgress({
        phase: 'saving',
        message: 'Looking up client and employees'
      });

      // Look up client
      const clientResults = await this.dbService.db
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(like(clients.name, `%${options.client}%`));

      if (clientResults.length === 0) {
        throw new Error(`Client "${options.client}" not found in database`);
      }

      const clientId = clientResults[0].id;
      
      // Get all employees for lookup
      const allEmployees = await this.dbService.db.select().from(employees);
      const employeeMap = new Map<string, number>();
      
      allEmployees.forEach(emp => {
        const fullName = emp.name.toLowerCase();
        const firstName = emp.name.split(' ')[0].toLowerCase();
        
        employeeMap.set(fullName, emp.id);
        employeeMap.set(firstName, emp.id);
        
        // Common abbreviations
        const abbreviations: Record<string, string> = {
          'rebecca': 'r',
          'megan': 'm', 
          'virginia': 'v',
          'anne': 'a'
        };
        
        if (abbreviations[firstName]) {
          employeeMap.set(abbreviations[firstName], emp.id);
        }
      });

      // Check for duplicates
      let duplicateCount = 0;
      if (!options.force) {
        updateProgress({
          phase: 'saving',
          message: 'Checking for existing activities'
        });

        const existingActivities = await this.workActivityService.getWorkActivitiesByClientId(clientId);
        const existingDates = new Set(existingActivities.map(a => a.date));
        
        const originalCount = filteredActivities.length;
        filteredActivities = filteredActivities.filter(activity => {
          if (existingDates.has(activity.date)) {
            duplicateCount++;
            return false;
          }
          return true;
        });

        updateProgress({
          phase: 'saving',
          message: `Duplicate check: ${originalCount} → ${filteredActivities.length} activities (${duplicateCount} duplicates skipped)`
        });
      }

      if (filteredActivities.length === 0) {
        const duration = Date.now() - startTime;
        return {
          success: true,
          message: `No new activities to import after duplicate filtering (${duplicateCount} duplicates found)`,
          duration,
          details: {
            totalFound: activities.length,
            totalSaved: 0,
            duplicatesSkipped: duplicateCount,
            errors: []
          }
        };
      }

      // Save activities
      let saved = 0;
      let failed = 0;

      for (const [index, activity] of filteredActivities.entries()) {
        try {
          updateProgress({
            phase: 'saving',
            message: `Saving activity ${index + 1}/${filteredActivities.length}: ${activity.date}`,
            progress: index + 1,
            total: filteredActivities.length
          });

          // Map employee names to IDs
          const employeeIds: number[] = [];
          for (const empName of activity.employees) {
            const empId = employeeMap.get(empName.toLowerCase());
            if (empId) {
              employeeIds.push(empId);
            }
          }
          
          // Default to first employee if none found
          if (employeeIds.length === 0) {
            employeeIds.push(allEmployees[0].id);
          }
          
          // Create work activity
          const workActivity = {
            workType: activity.workType || 'maintenance',
            date: activity.date,
            status: 'completed' as const,
            startTime: activity.startTime || null,
            endTime: activity.endTime || null,
            billableHours: Math.max(0, activity.totalHours),
            totalHours: Math.max(0, activity.totalHours),
            hourlyRate: null,
            clientId: clientId,
            projectId: null,
            travelTimeMinutes: activity.driveTime || 0,
            breakTimeMinutes: activity.lunchTime || 0,
            notes: activity.notes || '',
            tasks: activity.tasks.join('\n'),
            lastUpdatedBy: 'web_app' as const
          };
          
          // Create employee assignments
          const employeeAssignments = employeeIds.map(empId => ({
            employeeId: empId,
            hours: activity.totalHours / employeeIds.length
          }));
          
          // Create charges
          const charges = (activity.charges || [])
            .filter(charge => charge.description && !isNaN(Number(charge.cost || 0)))
            .map(charge => ({
              chargeType: charge.type || 'material',
              description: charge.description,
              quantity: 1,
              unitRate: Number(charge.cost || 0),
              totalCost: Number(charge.cost || 0),
              billable: true
            }));

          // Save to database
          await this.workActivityService.createWorkActivity({
            workActivity,
            employees: employeeAssignments,
            charges
          });

          saved++;
        } catch (error) {
          failed++;
          const errorMsg = `Failed to save activity ${activity.date}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          debugLog.error('Admin: Error saving work activity', { error, activityDate: activity.date });
        }
      }

      const duration = Date.now() - startTime;
      
      updateProgress({
        phase: 'complete',
        message: `Import complete: ${saved} saved, ${failed} failed, ${duplicateCount} duplicates skipped`
      });

      debugLog.info('Admin: Work activities import completed', { 
        client: options.client,
        saved,
        failed,
        duplicatesSkipped: duplicateCount,
        totalErrors: errors.length,
        duration 
      });

      return {
        success: true,
        message: `Import completed: ${saved} activities saved, ${failed} failed`,
        duration,
        details: {
          totalFound: activities.length,
          totalSaved: saved,
          duplicatesSkipped: duplicateCount,
          errors
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      debugLog.error('Admin: Error importing work activities', { error, options, duration });
      
      return {
        success: false,
        message: 'Import failed',
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          totalFound: 0,
          totalSaved: 0,
          duplicatesSkipped: 0,
          errors: [...errors, error instanceof Error ? error.message : 'Unknown error']
        }
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