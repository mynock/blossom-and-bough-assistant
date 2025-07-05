import { pgTable, text, integer, real, boolean, timestamp, serial } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Clients table
export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  clientId: text('client_id').unique().notNull(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  geoZone: text('geo_zone').notNull(),
  isRecurringMaintenance: boolean('is_recurring_maintenance').notNull().default(false),
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
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Employees table
export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
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
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Projects table
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => clients.id),
  status: text('status').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Work Activities table
export const workActivities = pgTable('work_activities', {
  id: serial('id').primaryKey(),
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
  nonBillableTimeMinutes: integer('non_billable_time_minutes'),
  notes: text('notes'),
  tasks: text('tasks'), // future work items/to-do notes
  notionPageId: text('notion_page_id').unique(), // Notion page ID for syncing
  lastNotionSyncAt: timestamp('last_notion_sync_at'), // Stores the Notion page's last_edited_time from the last sync
  lastUpdatedBy: text('last_updated_by').$type<'web_app' | 'notion_sync'>().default('web_app'), // Who made the last update
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Work Activity Employees junction table
export const workActivityEmployees = pgTable('work_activity_employees', {
  id: serial('id').primaryKey(),
  workActivityId: integer('work_activity_id').notNull().references(() => workActivities.id),
  employeeId: integer('employee_id').notNull().references(() => employees.id),
  hours: real('hours').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Other Charges table
export const otherCharges = pgTable('other_charges', {
  id: serial('id').primaryKey(),
  workActivityId: integer('work_activity_id').notNull().references(() => workActivities.id),
  chargeType: text('charge_type').notNull(), // material, service, debris, delivery, etc.
  description: text('description').notNull(), // e.g., "1 debris bag", "3 astrantia", "mulch delivery"
  quantity: real('quantity'),
  unitRate: real('unit_rate'),
  totalCost: real('total_cost'),
  billable: boolean('billable').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Plant List table
export const plantList = pgTable('plant_list', {
  id: serial('id').primaryKey(),
  workActivityId: integer('work_activity_id').notNull().references(() => workActivities.id),
  name: text('name').notNull(), // e.g., "Native Mock Orange", "Achillea Terracotta"
  quantity: real('quantity').notNull(), // e.g., 2, 3.5
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Client Notes table
export const clientNotes = pgTable('client_notes', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => clients.id),
  noteType: text('note_type').notNull(), // meeting, property_info, client_preferences, etc.
  title: text('title').notNull(), // e.g., "Rod & Yahya convo 3/12"
  content: text('content').notNull(),
  date: text('date'), // ISO date string
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// QuickBooks Online Items table
export const qboItems = pgTable('qbo_items', {
  id: serial('id').primaryKey(),
  qboId: text('qbo_id').unique().notNull(), // QuickBooks Item ID
  name: text('name').notNull(), // Item name in QuickBooks
  description: text('description'), // Item description
  type: text('type').notNull(), // Service, Inventory, NonInventory
  unitPrice: real('unit_price'), // Current unit price from QBO
  incomeAccountRef: text('income_account_ref'), // QBO Income Account reference
  active: boolean('active').notNull().default(true), // Active status in QBO
  lastSyncAt: timestamp('last_sync_at').notNull().defaultNow(), // Last sync from QBO
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Invoices table
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  qboInvoiceId: text('qbo_invoice_id').unique().notNull(), // QuickBooks Invoice ID
  qboCustomerId: text('qbo_customer_id').notNull(), // QuickBooks Customer ID
  clientId: integer('client_id').notNull().references(() => clients.id),
  invoiceNumber: text('invoice_number').notNull(), // QBO Invoice Number
  status: text('status').notNull(), // draft, sent, paid, overdue, void, etc.
  totalAmount: real('total_amount').notNull(),
  invoiceDate: text('invoice_date').notNull(), // ISO date string
  dueDate: text('due_date'), // ISO date string
  qboSyncAt: timestamp('qbo_sync_at').notNull().defaultNow(), // Last sync from QBO
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Invoice Line Items table
export const invoiceLineItems = pgTable('invoice_line_items', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull().references(() => invoices.id),
  workActivityId: integer('work_activity_id').references(() => workActivities.id), // For work activity charges
  otherChargeId: integer('other_charge_id').references(() => otherCharges.id), // For material/other charges
  qboItemId: text('qbo_item_id').references(() => qboItems.qboId), // Reference to QBO Item
  description: text('description').notNull(),
  quantity: real('quantity').notNull(),
  rate: real('rate').notNull(), // Rate at time of invoice
  amount: real('amount').notNull(), // Total line amount
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
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

export type PlantListItem = typeof plantList.$inferSelect;
export type NewPlantListItem = typeof plantList.$inferInsert;

export type ClientNote = typeof clientNotes.$inferSelect;
export type NewClientNote = typeof clientNotes.$inferInsert;

export type QboItem = typeof qboItems.$inferSelect;
export type NewQboItem = typeof qboItems.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert; 