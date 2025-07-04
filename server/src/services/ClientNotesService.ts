import { DatabaseService } from './DatabaseService';
import { clientNotes, type ClientNote, type NewClientNote } from '../db';
import { eq, desc, and } from 'drizzle-orm';

export class ClientNotesService extends DatabaseService {
  
  /**
   * Get all notes for a client
   */
  async getNotesByClientId(clientId: number): Promise<ClientNote[]> {
    return await this.db
      .select()
      .from(clientNotes)
      .where(eq(clientNotes.clientId, clientId))
      .orderBy(desc(clientNotes.createdAt));
  }

  /**
   * Get a specific note by ID
   */
  async getNoteById(id: number): Promise<ClientNote | undefined> {
    const results = await this.db
      .select()
      .from(clientNotes)
      .where(eq(clientNotes.id, id));
    
    return results[0];
  }

  /**
   * Create a new note
   */
  async createNote(data: NewClientNote): Promise<ClientNote> {
    const results = await this.db
      .insert(clientNotes)
      .values(data)
      .returning();
    
    return results[0];
  }

  /**
   * Update a note
   */
  async updateNote(id: number, data: Partial<NewClientNote>): Promise<ClientNote | undefined> {
    const results = await this.db
      .update(clientNotes)
      .set({ ...data, updatedAt: this.formatTimestamp(new Date()) })
      .where(eq(clientNotes.id, id))
      .returning();
    
    return results[0];
  }

  /**
   * Delete a note
   */
  async deleteNote(id: number): Promise<boolean> {
    const results = await this.db
      .delete(clientNotes)
      .where(eq(clientNotes.id, id))
      .returning();
    
    return results.length > 0;
  }

  /**
   * Get notes by type for a client
   */
  async getNotesByType(clientId: number, noteType: string): Promise<ClientNote[]> {
    return await this.db
      .select()
      .from(clientNotes)
      .where(and(
        eq(clientNotes.clientId, clientId),
        eq(clientNotes.noteType, noteType)
      ))
      .orderBy(desc(clientNotes.createdAt));
  }
} 