import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Clients table
export const clients = sqliteTable('clients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: text('client_id').unique().notNull(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  geoZone: text('geo_zone').notNull(),
  isRecurringMaintenance: integer('is_recurring_maintenance', { mode: 'boolean' }).notNull().default(false),
  maintenanceIntervalWeeks: integer('maintenance_interval_weeks'),
  maintenanceHoursPerVisit: text('maintenance_hours_per_visit'),
  maintenanceRate: text('maintenance_rate'),
  lastMaintenanceDate: text('last_maintenance_date'), // ISO date string
  nextMaintenanceTarget: text('next_maintenance_target'), // ISO date string
  priorityLevel: text('priority_level'),
  scheduleFlexibility: text('schedule_flexibility'),
  preferredDays: text('preferred_days'),
  preferredTime: text('preferred_time'),
  specialNotes: text('special_notes'),
  activeStatus: text('active_status').notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Employees table
export const employees = sqliteTable('employees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: text('employee_id').unique().notNull(),
  name: text('name').notNull(),
  regularWorkdays: text('regular_workdays').notNull(),
  homeAddress: text('home_address').notNull(),
  minHoursPerDay: integer('min_hours_per_day').notNull(),
  maxHoursPerDay: real('max_hours_per_day').notNull(),
  capabilityLevel: real('capability_level').notNull(),
  hourlyRate: real('hourly_rate'),
  notes: text('notes'),
  activeStatus: text('active_status').notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Projects table
export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: integer('client_id').notNull().references(() => clients.id),
  status: text('status').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Work Activities table
export const workActivities = sqliteTable('work_activities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workType: text('work_type').notNull(), // maintenance, install, errand, office work, etc.
  date: text('date').notNull(), // ISO date string
  status: text('status').notNull(), // planned, in_progress, completed, invoiced
  startTime: text('start_time'), // ISO time string
  endTime: text('end_time'), // ISO time string
  billableHours: real('billable_hours'),
  totalHours: real('total_hours').notNull(),
  hourlyRate: real('hourly_rate'),
  projectId: integer('project_id').references(() => projects.id),
  clientId: integer('client_id').references(() => clients.id), // required if billable_hours > 0
  travelTimeMinutes: integer('travel_time_minutes'),
  breakTimeMinutes: integer('break_time_minutes'),
  notes: text('notes'),
  tasks: text('tasks'), // future work items/to-do notes
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Work Activity Employees junction table
export const workActivityEmployees = sqliteTable('work_activity_employees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workActivityId: integer('work_activity_id').notNull().references(() => workActivities.id),
  employeeId: integer('employee_id').notNull().references(() => employees.id),
  hours: real('hours').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Other Charges table
export const otherCharges = sqliteTable('other_charges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workActivityId: integer('work_activity_id').notNull().references(() => workActivities.id),
  chargeType: text('charge_type').notNull(), // material, service, debris, delivery, etc.
  description: text('description').notNull(), // e.g., "1 debris bag", "3 astrantia", "mulch delivery"
  quantity: real('quantity'),
  unitRate: real('unit_rate'),
  totalCost: real('total_cost').notNull(),
  billable: integer('billable', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Client Notes table
export const clientNotes = sqliteTable('client_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: integer('client_id').notNull().references(() => clients.id),
  noteType: text('note_type').notNull(), // meeting, property_info, client_preferences, etc.
  title: text('title').notNull(), // e.g., "Rod & Yahya convo 3/12"
  content: text('content').notNull(),
  date: text('date'), // ISO date string
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Export types for use in the application
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type WorkActivity = typeof workActivities.$inferSelect;
export type NewWorkActivity = typeof workActivities.$inferInsert;

export type WorkActivityEmployee = typeof workActivityEmployees.$inferSelect;
export type NewWorkActivityEmployee = typeof workActivityEmployees.$inferInsert;

export type OtherCharge = typeof otherCharges.$inferSelect;
export type NewOtherCharge = typeof otherCharges.$inferInsert;

export type ClientNote = typeof clientNotes.$inferSelect;
export type NewClientNote = typeof clientNotes.$inferInsert; 