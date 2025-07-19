import { DatabaseService } from './DatabaseService';
import { clients, workActivities, type Client, type NewClient } from '../db';
import { eq, like, sql } from 'drizzle-orm';

export class ClientService extends DatabaseService {
  
  /**
   * Get all clients
   */
  async getAllClients(): Promise<Client[]> {
    return await this.db.select().from(clients);
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
    const results = await this.db
      .select()
      .from(clients)
      .where(eq(clients.id, id));
    
    return results[0];
  }

  /**
   * Get a client by client ID (external identifier)
   */
  async getClientByClientId(clientId: string): Promise<Client | undefined> {
    const results = await this.db
      .select()
      .from(clients)
      .where(eq(clients.clientId, clientId));
    
    return results[0];
  }

  /**
   * Create a new client
   */
  async createClient(data: NewClient): Promise<Client> {
    const results = await this.db
      .insert(clients)
      .values(data)
      .returning();
    
    return results[0];
  }

  /**
   * Update a client
   */
  async updateClient(id: number, data: Partial<NewClient>): Promise<Client | undefined> {
    const results = await this.db
      .update(clients)
      .set({ ...data, updatedAt: this.formatTimestamp(new Date()) })
      .where(eq(clients.id, id))
      .returning();
    
    return results[0];
  }

  /**
   * Delete a client
   */
  async deleteClient(id: number): Promise<boolean> {
    const result = await this.db.delete(clients).where(eq(clients.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Search clients by name
   */
  async searchClientsByName(searchTerm: string): Promise<Client[]> {
    return await this.db
      .select()
      .from(clients)
      .where(like(clients.name, `%${searchTerm}%`));
  }

  /**
   * Get active clients only
   */
  async getActiveClients(): Promise<Client[]> {
    return await this.db
      .select()
      .from(clients)
      .where(eq(clients.activeStatus, 'active'));
  }

  /**
   * Get a client by name (exact match)
   */
  async getClientByName(name: string): Promise<Client | undefined> {
    const results = await this.db
      .select()
      .from(clients)
      .where(eq(clients.name, name));
    
    return results[0];
  }
} 