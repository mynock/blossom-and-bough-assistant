/**
 * Service Container
 *
 * Provides centralized, lazy-initialized access to all application services.
 * This eliminates scattered `new *Service()` calls across route files and
 * ensures consistent service instance management.
 *
 * Usage:
 *   import { services } from '../services/container';
 *   const clients = await services.clientService.getAllClients();
 */

import { ClientService } from './ClientService';
import { ClientNotesService } from './ClientNotesService';
import { EmployeeService } from './EmployeeService';
import { WorkActivityService } from './WorkActivityService';
import { ProjectService } from './ProjectService';
import { AdminService } from './AdminService';
import { NotionService } from './NotionService';
import { NotionSyncService } from './NotionSyncService';
import { NaturalLanguageSQLService } from './NaturalLanguageSQLService';
import { BreakTimeAllocationService } from './BreakTimeAllocationService';
import { TravelTimeAllocationService } from './TravelTimeAllocationService';
import { SettingsService } from './SettingsService';
import { QuickBooksService } from './QuickBooksService';
import { InvoiceService } from './InvoiceService';
import { DataMigrationService } from './DataMigrationService';
import { GoogleSheetsService } from './GoogleSheetsService';
import { GoogleCalendarService } from './GoogleCalendarService';
import { AnthropicService } from './AnthropicService';
import { TravelTimeService } from './TravelTimeService';
import { SchedulingService } from './SchedulingService';

class ServiceContainer {
  // Core business services
  private _clientService?: ClientService;
  private _clientNotesService?: ClientNotesService;
  private _employeeService?: EmployeeService;
  private _workActivityService?: WorkActivityService;
  private _projectService?: ProjectService;

  // Admin and settings
  private _adminService?: AdminService;
  private _settingsService?: SettingsService;

  // Integration services
  private _notionService?: NotionService;
  private _notionSyncService?: NotionSyncService;
  private _quickBooksService?: QuickBooksService;
  private _invoiceService?: InvoiceService;

  // Google services
  private _googleSheetsService?: GoogleSheetsService;
  private _googleCalendarService?: GoogleCalendarService;
  private _travelTimeService?: TravelTimeService;

  // AI and specialized services
  private _anthropicService?: AnthropicService;
  private _naturalLanguageSQLService?: NaturalLanguageSQLService;
  private _schedulingService?: SchedulingService;

  // Time allocation services
  private _breakTimeAllocationService?: BreakTimeAllocationService;
  private _travelTimeAllocationService?: TravelTimeAllocationService;

  // Migration service
  private _dataMigrationService?: DataMigrationService;

  // Core business services
  get clientService(): ClientService {
    return this._clientService ??= new ClientService();
  }

  get clientNotesService(): ClientNotesService {
    return this._clientNotesService ??= new ClientNotesService();
  }

  get employeeService(): EmployeeService {
    return this._employeeService ??= new EmployeeService();
  }

  get workActivityService(): WorkActivityService {
    return this._workActivityService ??= new WorkActivityService();
  }

  get projectService(): ProjectService {
    return this._projectService ??= new ProjectService();
  }

  // Admin and settings
  get adminService(): AdminService {
    return this._adminService ??= new AdminService();
  }

  get settingsService(): SettingsService {
    return this._settingsService ??= new SettingsService();
  }

  // Integration services
  get notionService(): NotionService {
    return this._notionService ??= new NotionService();
  }

  get notionSyncService(): NotionSyncService {
    return this._notionSyncService ??= new NotionSyncService();
  }

  get quickBooksService(): QuickBooksService {
    return this._quickBooksService ??= new QuickBooksService();
  }

  get invoiceService(): InvoiceService {
    return this._invoiceService ??= new InvoiceService();
  }

  // Google services
  get googleSheetsService(): GoogleSheetsService {
    return this._googleSheetsService ??= new GoogleSheetsService();
  }

  get googleCalendarService(): GoogleCalendarService {
    return this._googleCalendarService ??= new GoogleCalendarService();
  }

  get travelTimeService(): TravelTimeService {
    return this._travelTimeService ??= new TravelTimeService();
  }

  // AI and specialized services
  get anthropicService(): AnthropicService {
    return this._anthropicService ??= new AnthropicService();
  }

  get naturalLanguageSQLService(): NaturalLanguageSQLService {
    return this._naturalLanguageSQLService ??= new NaturalLanguageSQLService();
  }

  get schedulingService(): SchedulingService {
    return this._schedulingService ??= new SchedulingService(
      this.googleSheetsService,
      this.googleCalendarService,
      this.anthropicService,
      this.travelTimeService
    );
  }

  // Time allocation services
  get breakTimeAllocationService(): BreakTimeAllocationService {
    return this._breakTimeAllocationService ??= new BreakTimeAllocationService();
  }

  get travelTimeAllocationService(): TravelTimeAllocationService {
    return this._travelTimeAllocationService ??= new TravelTimeAllocationService();
  }

  // Migration service
  get dataMigrationService(): DataMigrationService {
    return this._dataMigrationService ??= new DataMigrationService();
  }
}

/**
 * Singleton instance of the service container.
 * All route files should import and use this instance.
 */
export const services = new ServiceContainer();
