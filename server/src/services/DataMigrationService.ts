import { DatabaseService } from './DatabaseService';
import { GoogleSheetsService } from './GoogleSheetsService';
import { ClientService } from './ClientService';
import { EmployeeService } from './EmployeeService';
import { 
  type NewClient, 
  type NewEmployee,
  clients,
  employees,
  projects,
  workActivities,
  workActivityEmployees,
  otherCharges,
  clientNotes
} from '../db';
import { type Helper, type Client } from '../types';

export interface MigrationResult {
  success: boolean;
  clientsImported: number;
  employeesImported: number;
  errors: string[];
}

export class DataMigrationService extends DatabaseService {
  private googleSheetsService: GoogleSheetsService;
  private clientService: ClientService;
  private employeeService: EmployeeService;

  constructor() {
    super();
    this.googleSheetsService = new GoogleSheetsService();
    this.clientService = new ClientService();
    this.employeeService = new EmployeeService();
  }

  /**
   * Migrate all data from Google Sheets to SQLite database
   */
  async migrateAllData(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      clientsImported: 0,
      employeesImported: 0,
      errors: []
    };

    try {
      console.log('🔄 Starting data migration from Google Sheets...');

      // Migrate employees first (since work activities reference them)
      const employeeResult = await this.migrateEmployees();
      result.employeesImported = employeeResult.imported;
      result.errors.push(...employeeResult.errors);

      // Migrate clients
      const clientResult = await this.migrateClients();
      result.clientsImported = clientResult.imported;
      result.errors.push(...clientResult.errors);

      if (result.errors.length > 0) {
        result.success = false;
        console.log('⚠️  Migration completed with errors');
      } else {
        console.log('✅ Migration completed successfully');
      }

      console.log(`📊 Summary: ${result.employeesImported} employees, ${result.clientsImported} clients imported`);

    } catch (error) {
      result.success = false;
      result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('❌ Migration failed:', error);
    }

    return result;
  }

  /**
   * Migrate employees from Google Sheets to database
   */
  async migrateEmployees(): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    try {
      console.log('👥 Migrating employees...');
      
      // Get employees from Google Sheets
      const helpers = await this.googleSheetsService.getHelpers();
      console.log(`Found ${helpers.length} employees in Google Sheets`);

      for (const helper of helpers) {
        try {
          // Check if employee already exists
          const existing = await this.employeeService.getEmployeeByEmployeeId(helper.id);
          if (existing) {
            console.log(`⏭️  Employee ${helper.name} (${helper.id}) already exists, skipping`);
            continue;
          }

          // Convert Helper to NewEmployee format
          const employeeData: NewEmployee = {
            employeeId: helper.id,
            name: helper.name,
            regularWorkdays: helper.workdays.join(' '), // Convert array to space-separated string
            homeAddress: helper.homeAddress,
            minHoursPerDay: helper.minHours,
            maxHoursPerDay: helper.maxHours,
            capabilityLevel: this.mapCapabilityTierToLevel(helper.capabilityTier),
            hourlyRate: helper.hourlyRate,
            notes: helper.notes || null,
            activeStatus: helper.status === 'active' ? 'active' : 'inactive'
          };

          // Create employee in database
          await this.employeeService.createEmployee(employeeData);
          imported++;
          console.log(`✅ Imported employee: ${helper.name} (${helper.id})`);

        } catch (error) {
          const errorMsg = `Failed to import employee ${helper.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

    } catch (error) {
      const errorMsg = `Failed to fetch employees from Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }

    return { imported, errors };
  }

  /**
   * Migrate clients from Google Sheets to database
   */
  async migrateClients(): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    try {
      console.log('🏢 Migrating clients...');
      
      // Get clients from Google Sheets
      const clients = await this.googleSheetsService.getClients();
      console.log(`Found ${clients.length} clients in Google Sheets`);

      for (const client of clients) {
        try {
          // Check if client already exists
          const existing = await this.clientService.getClientByClientId(client.id);
          if (existing) {
            console.log(`⏭️  Client ${client.name} (${client.id}) already exists, skipping`);
            continue;
          }

          // Convert Client to NewClient format
          const clientData: NewClient = {
            clientId: client.id,
            name: client.name,
            address: client.address,
            geoZone: client.zone,
            isRecurringMaintenance: client.maintenanceSchedule?.isMaintenance || false,
            maintenanceIntervalWeeks: client.maintenanceSchedule?.intervalWeeks || null,
            maintenanceHoursPerVisit: client.maintenanceSchedule?.hoursPerVisit?.toString() || null,
            maintenanceRate: client.maintenanceSchedule?.rate?.toString() || null,
            lastMaintenanceDate: client.maintenanceSchedule?.lastVisit || null,
            nextMaintenanceTarget: client.maintenanceSchedule?.nextTarget || null,
            priorityLevel: client.priority,
            scheduleFlexibility: client.preferences?.flexibility || null,
            preferredDays: client.preferences?.preferredDays?.join(' ') || null, // Convert array to space-separated string
            preferredTime: client.preferences?.preferredTime || null,
            specialNotes: client.notes || client.preferences?.specialRequirements || null,
            activeStatus: client.status === 'active' ? 'active' : 'inactive'
          };

          // Create client in database
          await this.clientService.createClient(clientData);
          imported++;
          console.log(`✅ Imported client: ${client.name} (${client.id})`);

        } catch (error) {
          const errorMsg = `Failed to import client ${client.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

    } catch (error) {
      const errorMsg = `Failed to fetch clients from Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }

    return { imported, errors };
  }

  /**
   * Clear all data from the database (for fresh migration)
   */
  async clearAllData(): Promise<void> {
    console.log('🗑️  Clearing all data from database...');
    
    // Delete in order to respect foreign key constraints
    await this.db.delete(otherCharges);
    await this.db.delete(workActivityEmployees);
    await this.db.delete(workActivities);
    await this.db.delete(clientNotes);
    await this.db.delete(projects);
    await this.db.delete(clients);
    await this.db.delete(employees);
    
    console.log('✅ Database cleared');
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{
    employeesCount: number;
    clientsCount: number;
    workActivitiesCount: number;
  }> {
    const employeesList = await this.employeeService.getAllEmployees();
    const clientsList = await this.clientService.getAllClients();
    const workActivitiesList = await this.db.select().from(workActivities);

    return {
      employeesCount: employeesList.length,
      clientsCount: clientsList.length,
      workActivitiesCount: workActivitiesList.length
    };
  }

  /**
   * Helper method to map capability tier to numeric level
   */
  private mapCapabilityTierToLevel(tier: string): number {
    switch (tier.toLowerCase()) {
      case 'beginner': return 1;
      case 'intermediate': return 3;
      case 'advanced': return 5;
      default: return 2;
    }
  }
} 