/**
 * Base CRUD Service
 *
 * Provides common CRUD operations for entity services.
 * Designed to work with Drizzle ORM and PostgreSQL.
 *
 * Usage:
 *   class MyService extends BaseCrudService<typeof myTable, MyEntity, NewMyEntity> {
 *     protected table = myTable;
 *     protected idColumn = myTable.id;
 *
 *     // Add entity-specific methods here
 *   }
 */

import { DatabaseService } from './DatabaseService';
import { eq, like, SQL } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';

/**
 * Generic base service for CRUD operations.
 *
 * Note: Uses 'any' casts in some places due to Drizzle ORM's complex
 * generic type constraints that don't compose well with abstract classes.
 * Type safety is maintained at the subclass level.
 *
 * @typeParam TTable - The Drizzle table type
 * @typeParam TSelect - The entity type returned from select operations
 * @typeParam TInsert - The entity type for insert operations
 */
export abstract class BaseCrudService<
  TTable,
  TSelect extends { id: number },
  TInsert
> extends DatabaseService {
  /**
   * The Drizzle table to operate on.
   * Must be set by the subclass.
   */
  protected abstract table: TTable;

  /**
   * The ID column of the table.
   * Must be set by the subclass.
   */
  protected abstract idColumn: PgColumn;

  /**
   * Get all entities from the table.
   */
  async getAll(): Promise<TSelect[]> {
    return await this.db.select().from(this.table as any) as unknown as TSelect[];
  }

  /**
   * Get an entity by its primary key ID.
   */
  async getById(id: number): Promise<TSelect | undefined> {
    const results = await this.db
      .select()
      .from(this.table as any)
      .where(eq(this.idColumn, id)) as unknown as TSelect[];

    return results[0];
  }

  /**
   * Create a new entity.
   */
  async create(data: TInsert): Promise<TSelect> {
    const results = await this.db
      .insert(this.table as any)
      .values(data as any)
      .returning() as unknown as TSelect[];

    return results[0];
  }

  /**
   * Update an entity by ID.
   * Automatically sets the updatedAt timestamp.
   */
  async update(id: number, data: Partial<TInsert>): Promise<TSelect | undefined> {
    const results = await this.db
      .update(this.table as any)
      .set({ ...data, updatedAt: this.formatTimestamp(new Date()) } as any)
      .where(eq(this.idColumn, id))
      .returning() as unknown as TSelect[];

    return results[0];
  }

  /**
   * Delete an entity by ID.
   * Returns true if the entity was deleted, false if it didn't exist.
   */
  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(this.table as any)
      .where(eq(this.idColumn, id));

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get entities matching a WHERE condition.
   * Utility method for building custom queries.
   */
  protected async getWhere(condition: SQL): Promise<TSelect[]> {
    return await this.db
      .select()
      .from(this.table as any)
      .where(condition) as unknown as TSelect[];
  }

  /**
   * Get a single entity matching a WHERE condition.
   */
  protected async getOneWhere(condition: SQL): Promise<TSelect | undefined> {
    const results = await this.getWhere(condition);
    return results[0];
  }

  /**
   * Search by a text column using LIKE pattern matching.
   */
  protected async searchByColumn(
    column: PgColumn,
    searchTerm: string
  ): Promise<TSelect[]> {
    return await this.db
      .select()
      .from(this.table as any)
      .where(like(column, `%${searchTerm}%`)) as unknown as TSelect[];
  }
}
