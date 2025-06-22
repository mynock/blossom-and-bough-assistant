import { DatabaseService } from './DatabaseService';
import { projects, clients, type Project, type NewProject } from '../db';
import { eq, like, desc } from 'drizzle-orm';

export class ProjectService extends DatabaseService {
  
  /**
   * Get all projects with client information
   */
  async getAllProjects(): Promise<(Project & { clientName: string })[]> {
    const results = await this.db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        status: projects.status,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        clientName: clients.name
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .orderBy(desc(projects.createdAt));
    
    return results as (Project & { clientName: string })[];
  }

  /**
   * Get a project by ID with client information
   */
  async getProjectById(id: number): Promise<(Project & { clientName: string }) | undefined> {
    const results = await this.db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        status: projects.status,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        clientName: clients.name
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(projects.id, id));
    
    return results[0] as (Project & { clientName: string }) | undefined;
  }

  /**
   * Get projects by client ID
   */
  async getProjectsByClientId(clientId: number): Promise<Project[]> {
    return await this.db
      .select()
      .from(projects)
      .where(eq(projects.clientId, clientId))
      .orderBy(desc(projects.createdAt));
  }

  /**
   * Create a new project
   */
  async createProject(data: NewProject): Promise<Project> {
    const results = await this.db
      .insert(projects)
      .values(data)
      .returning();
    
    return results[0];
  }

  /**
   * Update a project
   */
  async updateProject(id: number, data: Partial<NewProject>): Promise<Project | undefined> {
    const results = await this.db
      .update(projects)
      .set({ ...data, updatedAt: this.formatTimestamp(new Date()) })
      .where(eq(projects.id, id))
      .returning();
    
    return results[0];
  }

  /**
   * Delete a project
   */
  async deleteProject(id: number): Promise<boolean> {
    const result = await this.db.delete(projects).where(eq(projects.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Search projects by name or description
   */
  async searchProjects(searchTerm: string): Promise<(Project & { clientName: string })[]> {
    const results = await this.db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        status: projects.status,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        clientName: clients.name
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(like(projects.name, `%${searchTerm}%`))
      .orderBy(desc(projects.createdAt));
    
    return results as (Project & { clientName: string })[];
  }

  /**
   * Get projects by status
   */
  async getProjectsByStatus(status: string): Promise<(Project & { clientName: string })[]> {
    const results = await this.db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        status: projects.status,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        clientName: clients.name
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(projects.status, status))
      .orderBy(desc(projects.createdAt));
    
    return results as (Project & { clientName: string })[];
  }
} 