import { DatabaseService } from './DatabaseService';
import { clients, type Client, type NewClient } from '../db';
import { eq, like } from 'drizzle-orm';

export class ClientService extends DatabaseService {
  
  /**
   * Get all clients
   */
  async getAllClients(): Promise<Client[]> {
    return await this.db.select().from(clients);
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
    return result.changes > 0;
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
} 