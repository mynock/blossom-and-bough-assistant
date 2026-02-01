import { BaseCrudService } from './BaseCrudService';
import { clients, workActivities, type Client, type NewClient } from '../db';
import { eq, sql } from 'drizzle-orm';

export class ClientService extends BaseCrudService<typeof clients, Client, NewClient> {
  protected table = clients;
  protected idColumn = clients.id;

  /**
   * Get all clients
   */
  async getAllClients(): Promise<Client[]> {
    return this.getAll();
  }

  /**
   * Get all clients with work activity statistics
   */
  async getAllClientsWithStats(): Promise<(Client & {
    totalWorkActivities: number;
    totalHours: number;
    totalBillableHours: number;
  })[]> {
    const result = await this.db
      .select({
        // Client fields
        id: clients.id,
        clientId: clients.clientId,
        name: clients.name,
        address: clients.address,
        geoZone: clients.geoZone,
        isRecurringMaintenance: clients.isRecurringMaintenance,
        maintenanceIntervalWeeks: clients.maintenanceIntervalWeeks,
        maintenanceHoursPerVisit: clients.maintenanceHoursPerVisit,
        maintenanceRate: clients.maintenanceRate,
        lastMaintenanceDate: clients.lastMaintenanceDate,
        nextMaintenanceTarget: clients.nextMaintenanceTarget,
        priorityLevel: clients.priorityLevel,
        scheduleFlexibility: clients.scheduleFlexibility,
        preferredDays: clients.preferredDays,
        preferredTime: clients.preferredTime,
        specialNotes: clients.specialNotes,
        activeStatus: clients.activeStatus,
        createdAt: clients.createdAt,
        updatedAt: clients.updatedAt,
        // Work activity statistics
        totalWorkActivities: sql<number>`COALESCE(COUNT(${workActivities.id}), 0)`,
        totalHours: sql<number>`COALESCE(SUM(${workActivities.totalHours}), 0)`,
        totalBillableHours: sql<number>`COALESCE(SUM(${workActivities.billableHours}), 0)`,
      })
      .from(clients)
      .leftJoin(workActivities, eq(clients.id, workActivities.clientId))
      .groupBy(clients.id)
      .orderBy(clients.name);

    return result;
  }

  /**
   * Get a client by ID
   */
  async getClientById(id: number): Promise<Client | undefined> {
    return this.getById(id);
  }

  /**
   * Get a client by client ID (external identifier)
   */
  async getClientByClientId(clientId: string): Promise<Client | undefined> {
    return this.getOneWhere(eq(clients.clientId, clientId));
  }

  /**
   * Create a new client
   */
  async createClient(data: NewClient): Promise<Client> {
    return this.create(data);
  }

  /**
   * Update a client
   */
  async updateClient(id: number, data: Partial<NewClient>): Promise<Client | undefined> {
    return this.update(id, data);
  }

  /**
   * Delete a client
   */
  async deleteClient(id: number): Promise<boolean> {
    return this.delete(id);
  }

  /**
   * Search clients by name
   */
  async searchClientsByName(searchTerm: string): Promise<Client[]> {
    return this.searchByColumn(clients.name, searchTerm);
  }

  /**
   * Get active clients only
   */
  async getActiveClients(): Promise<Client[]> {
    return this.getWhere(eq(clients.activeStatus, 'active'));
  }

  /**
   * Get a client by name (exact match)
   */
  async getClientByName(name: string): Promise<Client | undefined> {
    return this.getOneWhere(eq(clients.name, name));
  }
}
