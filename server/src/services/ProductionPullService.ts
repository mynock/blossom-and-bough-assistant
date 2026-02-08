import { DatabaseService } from './DatabaseService';
import { WorkActivityService, CreateWorkActivityData } from './WorkActivityService';
import { debugLog } from '../utils/logger';
import {
  clients,
  employees,
  workActivities,
  type Client,
  type Employee,
  type NewClient,
  type NewEmployee,
} from '../db';
import { eq, and, ilike } from 'drizzle-orm';

export interface PullOptions {
  startDate?: string;
  endDate?: string;
  dryRun?: boolean;
  force?: boolean;
}

export interface PullProgress {
  phase: 'fetching' | 'clients' | 'employees' | 'activities' | 'complete' | 'error';
  message: string;
  progress?: number;
  total?: number;
  details?: any;
}

export interface PullResult {
  success: boolean;
  message: string;
  duration: number;
  error?: string;
  details?: {
    clientsCreated: number;
    clientsSkipped: number;
    employeesCreated: number;
    employeesSkipped: number;
    activitiesCreated: number;
    activitiesSkipped: number;
    activitiesErrored: number;
    errors: string[];
  };
}

interface ExportedActivity {
  workType: string;
  date: string;
  status: string;
  startTime?: string | null;
  endTime?: string | null;
  billableHours?: number | null;
  totalHours: number;
  hourlyRate?: number | null;
  clientName?: string | null;
  projectName?: string | null;
  travelTimeMinutes?: number | null;
  adjustedTravelTimeMinutes?: number | null;
  breakTimeMinutes?: number | null;
  adjustedBreakTimeMinutes?: number | null;
  nonBillableTimeMinutes?: number | null;
  notes?: string | null;
  tasks?: string | null;
  notionPageId?: string | null;
  lastUpdatedBy?: string | null;
  employees: Array<{ employeeName: string; hours: number }>;
  charges: Array<{
    chargeType: string;
    description: string;
    quantity?: number | null;
    unitRate?: number | null;
    totalCost?: number | null;
    billable: boolean;
  }>;
  plants: Array<{
    name: string;
    quantity: number;
  }>;
}

interface ExportedData {
  exportedAt: string;
  dateRange: { startDate: string; endDate: string };
  activities: ExportedActivity[];
  clients: Array<any>;
  employees: Array<any>;
}

export class ProductionPullService extends DatabaseService {
  private workActivityService: WorkActivityService;

  constructor() {
    super();
    this.workActivityService = new WorkActivityService();
  }

  /**
   * Fetch exported data from the production server.
   */
  async fetchFromProduction(options: PullOptions): Promise<ExportedData> {
    const prodUrl = process.env.PROD_API_URL;
    const secret = process.env.DATA_EXPORT_SECRET;

    if (!prodUrl) {
      throw new Error('PROD_API_URL is not configured');
    }
    if (!secret) {
      throw new Error('DATA_EXPORT_SECRET is not configured');
    }

    const params = new URLSearchParams();
    if (options.startDate) params.set('startDate', options.startDate);
    if (options.endDate) params.set('endDate', options.endDate);

    const url = `${prodUrl}/api/data-export/work-activities?${params.toString()}`;
    debugLog.info('Production pull: Fetching from', { url: url.replace(secret, '***') });

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${secret}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Production server returned ${response.status}: ${body}`);
    }

    return response.json();
  }

  /**
   * Import exported data into the local database.
   */
  async importData(
    data: ExportedData,
    options: PullOptions,
    onProgress?: (progress: PullProgress) => void
  ): Promise<PullResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let clientsCreated = 0;
    let clientsSkipped = 0;
    let employeesCreated = 0;
    let employeesSkipped = 0;
    let activitiesCreated = 0;
    let activitiesSkipped = 0;
    let activitiesErrored = 0;

    try {
      // Phase 1: Sync clients
      onProgress?.({
        phase: 'clients',
        message: `Syncing ${data.clients.length} clients...`,
        progress: 0,
        total: data.clients.length,
      });

      for (let i = 0; i < data.clients.length; i++) {
        const exportedClient = data.clients[i];
        try {
          const existing = await this.findClientByName(exportedClient.name);
          if (existing) {
            clientsSkipped++;
          } else if (!options.dryRun) {
            await this.createClientFromExport(exportedClient);
            clientsCreated++;
          } else {
            clientsCreated++; // Count as "would create" in dry run
          }
        } catch (err) {
          const msg = `Failed to sync client "${exportedClient.name}": ${err instanceof Error ? err.message : String(err)}`;
          errors.push(msg);
          debugLog.error(msg);
        }

        onProgress?.({
          phase: 'clients',
          message: `Syncing clients... (${i + 1}/${data.clients.length})`,
          progress: i + 1,
          total: data.clients.length,
        });
      }

      // Phase 2: Sync employees
      onProgress?.({
        phase: 'employees',
        message: `Syncing ${data.employees.length} employees...`,
        progress: 0,
        total: data.employees.length,
      });

      for (let i = 0; i < data.employees.length; i++) {
        const exportedEmployee = data.employees[i];
        try {
          const existing = await this.findEmployeeByName(exportedEmployee.name);
          if (existing) {
            employeesSkipped++;
          } else if (!options.dryRun) {
            await this.createEmployeeFromExport(exportedEmployee);
            employeesCreated++;
          } else {
            employeesCreated++;
          }
        } catch (err) {
          const msg = `Failed to sync employee "${exportedEmployee.name}": ${err instanceof Error ? err.message : String(err)}`;
          errors.push(msg);
          debugLog.error(msg);
        }

        onProgress?.({
          phase: 'employees',
          message: `Syncing employees... (${i + 1}/${data.employees.length})`,
          progress: i + 1,
          total: data.employees.length,
        });
      }

      // Phase 3: Import work activities
      onProgress?.({
        phase: 'activities',
        message: `Importing ${data.activities.length} work activities...`,
        progress: 0,
        total: data.activities.length,
      });

      for (let i = 0; i < data.activities.length; i++) {
        const activity = data.activities[i];
        try {
          // Check for duplicates
          const isDuplicate = await this.isDuplicateActivity(activity);
          if (isDuplicate && !options.force) {
            activitiesSkipped++;
            onProgress?.({
              phase: 'activities',
              message: `Skipped duplicate: ${activity.date} - ${activity.clientName || activity.workType} (${i + 1}/${data.activities.length})`,
              progress: i + 1,
              total: data.activities.length,
            });
            continue;
          }

          // If force and duplicate, delete existing first
          if (isDuplicate && options.force && !options.dryRun) {
            await this.deleteExistingActivity(activity);
          }

          if (!options.dryRun) {
            await this.createActivityFromExport(activity);
          }
          activitiesCreated++;
        } catch (err) {
          activitiesErrored++;
          const msg = `Failed to import activity "${activity.date} - ${activity.clientName || activity.workType}": ${err instanceof Error ? err.message : String(err)}`;
          errors.push(msg);
          debugLog.error(msg);
        }

        onProgress?.({
          phase: 'activities',
          message: `Importing activities... (${i + 1}/${data.activities.length})`,
          progress: i + 1,
          total: data.activities.length,
        });
      }

      const duration = Date.now() - startTime;
      const dryRunLabel = options.dryRun ? ' (dry run)' : '';

      onProgress?.({
        phase: 'complete',
        message: `Import complete${dryRunLabel}: ${activitiesCreated} activities, ${clientsCreated} clients, ${employeesCreated} employees`,
      });

      return {
        success: true,
        message: `Import complete${dryRunLabel}`,
        duration,
        details: {
          clientsCreated,
          clientsSkipped,
          employeesCreated,
          employeesSkipped,
          activitiesCreated,
          activitiesSkipped,
          activitiesErrored,
          errors,
        },
      };
    } catch (err) {
      const duration = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);

      onProgress?.({
        phase: 'error',
        message: `Import failed: ${errorMsg}`,
      });

      return {
        success: false,
        message: 'Import failed',
        duration,
        error: errorMsg,
        details: {
          clientsCreated,
          clientsSkipped,
          employeesCreated,
          employeesSkipped,
          activitiesCreated,
          activitiesSkipped,
          activitiesErrored,
          errors,
        },
      };
    }
  }

  private async findClientByName(name: string): Promise<Client | undefined> {
    const results = await this.db
      .select()
      .from(clients)
      .where(ilike(clients.name, name));
    return results[0];
  }

  private async findEmployeeByName(name: string): Promise<Employee | undefined> {
    const results = await this.db
      .select()
      .from(employees)
      .where(ilike(employees.name, name));
    return results[0];
  }

  private async createClientFromExport(exportedClient: any): Promise<Client> {
    const newClient: NewClient = {
      clientId: exportedClient.clientId || `imported-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: exportedClient.name,
      address: exportedClient.address || 'Unknown',
      geoZone: exportedClient.geoZone || 'Unknown',
      isRecurringMaintenance: exportedClient.isRecurringMaintenance ?? false,
      maintenanceIntervalWeeks: exportedClient.maintenanceIntervalWeeks,
      maintenanceHoursPerVisit: exportedClient.maintenanceHoursPerVisit,
      maintenanceRate: exportedClient.maintenanceRate,
      lastMaintenanceDate: exportedClient.lastMaintenanceDate,
      nextMaintenanceTarget: exportedClient.nextMaintenanceTarget,
      priorityLevel: exportedClient.priorityLevel,
      scheduleFlexibility: exportedClient.scheduleFlexibility,
      preferredDays: exportedClient.preferredDays,
      preferredTime: exportedClient.preferredTime,
      specialNotes: exportedClient.specialNotes,
      activeStatus: exportedClient.activeStatus || 'active',
    };

    const result = await this.db.insert(clients).values(newClient).returning();
    return result[0];
  }

  private async createEmployeeFromExport(exportedEmployee: any): Promise<Employee> {
    const newEmployee: NewEmployee = {
      employeeId: exportedEmployee.employeeId || `imported-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: exportedEmployee.name,
      regularWorkdays: exportedEmployee.regularWorkdays || 'Mon,Tue,Wed,Thu,Fri',
      homeAddress: exportedEmployee.homeAddress || 'Unknown',
      minHoursPerDay: exportedEmployee.minHoursPerDay ?? 0,
      maxHoursPerDay: exportedEmployee.maxHoursPerDay ?? 8,
      capabilityLevel: exportedEmployee.capabilityLevel ?? 1,
      hourlyRate: exportedEmployee.hourlyRate,
      notes: exportedEmployee.notes,
      activeStatus: exportedEmployee.activeStatus || 'active',
    };

    const result = await this.db.insert(employees).values(newEmployee).returning();
    return result[0];
  }

  private async isDuplicateActivity(activity: ExportedActivity): Promise<boolean> {
    // Match by notionPageId if present
    if (activity.notionPageId) {
      const existing = await this.db
        .select({ id: workActivities.id })
        .from(workActivities)
        .where(eq(workActivities.notionPageId, activity.notionPageId));
      if (existing.length > 0) return true;
    }

    // Otherwise match by date + client + workType
    if (activity.clientName) {
      const client = await this.findClientByName(activity.clientName);
      if (client) {
        const existing = await this.db
          .select({ id: workActivities.id })
          .from(workActivities)
          .where(and(
            eq(workActivities.date, activity.date),
            eq(workActivities.clientId, client.id),
            eq(workActivities.workType, activity.workType)
          ));
        if (existing.length > 0) return true;
      }
    }

    return false;
  }

  private async deleteExistingActivity(activity: ExportedActivity): Promise<void> {
    // Delete by notionPageId if present
    if (activity.notionPageId) {
      const existing = await this.db
        .select({ id: workActivities.id })
        .from(workActivities)
        .where(eq(workActivities.notionPageId, activity.notionPageId));

      if (existing.length > 0) {
        await this.workActivityService.deleteWorkActivity(existing[0].id);
        return;
      }
    }

    // Otherwise delete by date + client + workType
    if (activity.clientName) {
      const client = await this.findClientByName(activity.clientName);
      if (client) {
        const existing = await this.db
          .select({ id: workActivities.id })
          .from(workActivities)
          .where(and(
            eq(workActivities.date, activity.date),
            eq(workActivities.clientId, client.id),
            eq(workActivities.workType, activity.workType)
          ));

        if (existing.length > 0) {
          await this.workActivityService.deleteWorkActivity(existing[0].id);
        }
      }
    }
  }

  private async createActivityFromExport(activity: ExportedActivity): Promise<void> {
    // Resolve client ID
    let clientId: number | undefined;
    if (activity.clientName) {
      const client = await this.findClientByName(activity.clientName);
      if (!client) {
        throw new Error(`Client "${activity.clientName}" not found locally`);
      }
      clientId = client.id;
    }

    // Resolve employee IDs
    const resolvedEmployees: Array<{ employeeId: number; hours: number }> = [];
    for (const emp of activity.employees) {
      const employee = await this.findEmployeeByName(emp.employeeName);
      if (!employee) {
        throw new Error(`Employee "${emp.employeeName}" not found locally`);
      }
      resolvedEmployees.push({ employeeId: employee.id, hours: emp.hours });
    }

    const data: CreateWorkActivityData = {
      workActivity: {
        workType: activity.workType,
        date: activity.date,
        status: activity.status,
        startTime: activity.startTime,
        endTime: activity.endTime,
        billableHours: activity.billableHours,
        totalHours: activity.totalHours,
        hourlyRate: activity.hourlyRate,
        clientId: clientId ?? null,
        travelTimeMinutes: activity.travelTimeMinutes,
        adjustedTravelTimeMinutes: activity.adjustedTravelTimeMinutes,
        breakTimeMinutes: activity.breakTimeMinutes,
        adjustedBreakTimeMinutes: activity.adjustedBreakTimeMinutes,
        nonBillableTimeMinutes: activity.nonBillableTimeMinutes,
        notes: activity.notes,
        tasks: activity.tasks,
        notionPageId: activity.notionPageId,
        lastUpdatedBy: 'web_app',
      },
      employees: resolvedEmployees,
      charges: activity.charges?.map(c => ({
        chargeType: c.chargeType,
        description: c.description,
        quantity: c.quantity ?? null,
        unitRate: c.unitRate ?? null,
        totalCost: c.totalCost ?? null,
        billable: c.billable,
      })),
      plants: activity.plants?.map(p => ({
        name: p.name,
        quantity: p.quantity,
      })),
    };

    await this.workActivityService.createWorkActivity(data);
  }
}
