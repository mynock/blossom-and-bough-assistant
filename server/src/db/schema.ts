import { pgTable, text, integer, real, numeric, date, time, boolean, timestamp, serial, uniqueIndex, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Postgres `numeric(precision, scale)` returned as JS number (not string).
// Use these for money and hours so storage is exact (no IEEE-754 drift) but
// the TypeScript API stays as `number`. JS Number can exactly represent any
// 12,2 money amount up to ~$10^10 and any 6,2 hours value, so the cast back
// to number is lossless for the values this app stores.
const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: 'number' });
const hours = (name: string) => numeric(name, { precision: 6, scale: 2, mode: 'number' });

// Native `date` returned as a 'YYYY-MM-DD' string so existing code that
// reads/writes ISO date strings keeps working — the storage becomes proper
// `date` (correct sorting, range queries, BETWEEN) without forcing every
// consumer to switch to Date objects.
const dateText = (name: string) => date(name, { mode: 'string' });

// Clients table
export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  clientId: text('client_id').unique().notNull(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  geoZone: text('geo_zone').notNull(),
  isRecurringMaintenance: boolean('is_recurring_maintenance').notNull().default(false),
  maintenanceIntervalWeeks: integer('maintenance_interval_weeks'),
  maintenanceHoursPerVisit: hours('maintenance_hours_per_visit'),
  maintenanceRate: money('maintenance_rate'),
  lastMaintenanceDate: dateText('last_maintenance_date'),
  nextMaintenanceTarget: dateText('next_maintenance_target'),
  priorityLevel: text('priority_level'),
  scheduleFlexibility: text('schedule_flexibility'),
  preferredDays: text('preferred_days'),
  preferredTime: text('preferred_time'),
  specialNotes: text('special_notes'),
  activeStatus: text('active_status').notNull().default('active'),
  qboCustomerId: text('qbo_customer_id').unique(), // Nullable: populated during QBO customer sync; used as primary join key for invoice import
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
  date: dateText('date').notNull(),
  status: text('status').notNull(), // planned, in_progress, completed, invoiced
  startTime: time('start_time'),
  endTime: time('end_time'),
  billableHours: hours('billable_hours'),
  totalHours: hours('total_hours').notNull(),
  hourlyRate: money('hourly_rate'),
  projectId: integer('project_id').references(() => projects.id),
  clientId: integer('client_id').references(() => clients.id), // required if billable_hours > 0
  travelTimeMinutes: integer('travel_time_minutes'),
  adjustedTravelTimeMinutes: integer('adjusted_travel_time_minutes'),
  breakTimeMinutes: integer('break_time_minutes'),
  adjustedBreakTimeMinutes: integer('adjusted_break_time_minutes'),
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
  hours: hours('hours').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (t) => ({
  // One row per (activity, employee). Double-clicks, retries, and re-runs of
  // NotionSyncService used to be able to double-count an employee's hours,
  // which then flowed straight into invoices.
  workActivityEmployeeUnique: uniqueIndex('wae_wa_emp_uidx').on(t.workActivityId, t.employeeId)
}));

// Other Charges table
export const otherCharges = pgTable('other_charges', {
  id: serial('id').primaryKey(),
  workActivityId: integer('work_activity_id').notNull().references(() => workActivities.id),
  chargeType: text('charge_type').notNull(), // material, service, debris, delivery, etc.
  description: text('description').notNull(), // e.g., "1 debris bag", "3 astrantia", "mulch delivery"
  quantity: real('quantity'),
  unitRate: money('unit_rate'),
  totalCost: money('total_cost'),
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
  date: dateText('date'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// QuickBooks Online credentials (singleton — one row enforced by id default).
// Tokens are encrypted at rest with AES-256-GCM; see utils/encryption.ts.
export const qboCredentials = pgTable('qbo_credentials', {
  id: integer('id').primaryKey().default(1),
  realmId: text('realm_id').notNull(),
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),
  accessTokenExpiresAt: timestamp('access_token_expires_at').notNull(),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// QuickBooks Online Items table
export const qboItems = pgTable('qbo_items', {
  id: serial('id').primaryKey(),
  qboId: text('qbo_id').unique().notNull(), // QuickBooks Item ID
  name: text('name').notNull(), // Item name in QuickBooks
  description: text('description'), // Item description
  type: text('type').notNull(), // Service, Inventory, NonInventory
  unitPrice: money('unit_price'), // Current unit price from QBO
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
  totalAmount: money('total_amount').notNull(),
  invoiceDate: dateText('invoice_date').notNull(),
  dueDate: dateText('due_date'),
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
  rate: money('rate').notNull(), // Rate at time of invoice
  amount: money('amount').notNull(), // Total line amount
  matchStatus: text('match_status').notNull().default('unmatched'), // 'auto' | 'manual' | 'needs_review' | 'unmatched'
  matchScore: real('match_score'), // Nullable: winning candidate's score for debugging/sorting
  matchCandidates: jsonb('match_candidates'), // Nullable: top-3 candidates { workActivityId, score, reason }; cleared when status → 'manual'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Settings table for application configuration
export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: text('key').unique().notNull(), // e.g., 'billable_hours_rounding'
  value: text('value').notNull(), // JSON string for complex values
  description: text('description'), // Human-readable description
  category: text('category').notNull().default('general'), // e.g., 'billing', 'general', 'notifications'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Notifications table - persistent record of events the user should review
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(), // e.g. 'employee_auto_created', 'employee_ambiguous_match', 'client_auto_created', 'cron_failed', 'hours_unparsed'
  severity: text('severity').notNull().default('info'), // 'info' | 'warn' | 'error'
  title: text('title').notNull(),
  body: text('body'),
  link: text('link'), // in-app route, e.g. '/employees/123'
  sourceUrl: text('source_url'), // external link, e.g. Notion page URL
  entityType: text('entity_type'), // 'employee' | 'client' | 'work_activity' | 'cron_run'
  entityId: integer('entity_id'),
  metadata: jsonb('metadata'),
  readAt: timestamp('read_at'),
  dismissedAt: timestamp('dismissed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => ({
  activeIdx: index('notifications_active_idx').on(table.dismissedAt, table.createdAt)
}));

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

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
