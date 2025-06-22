CREATE TABLE IF NOT EXISTS "client_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"note_type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"date" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"geo_zone" text NOT NULL,
	"is_recurring_maintenance" boolean DEFAULT false NOT NULL,
	"maintenance_interval_weeks" integer,
	"maintenance_hours_per_visit" text,
	"maintenance_rate" text,
	"last_maintenance_date" text,
	"next_maintenance_target" text,
	"priority_level" text,
	"schedule_flexibility" text,
	"preferred_days" text,
	"preferred_time" text,
	"special_notes" text,
	"active_status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clients_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"name" text NOT NULL,
	"regular_workdays" text NOT NULL,
	"home_address" text NOT NULL,
	"min_hours_per_day" integer NOT NULL,
	"max_hours_per_day" real NOT NULL,
	"capability_level" real NOT NULL,
	"hourly_rate" real,
	"notes" text,
	"active_status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employees_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "other_charges" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_activity_id" integer NOT NULL,
	"charge_type" text NOT NULL,
	"description" text NOT NULL,
	"quantity" real,
	"unit_rate" real,
	"total_cost" real NOT NULL,
	"billable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"status" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_type" text NOT NULL,
	"date" text NOT NULL,
	"status" text NOT NULL,
	"start_time" text,
	"end_time" text,
	"billable_hours" real,
	"total_hours" real NOT NULL,
	"hourly_rate" real,
	"project_id" integer,
	"client_id" integer,
	"travel_time_minutes" integer,
	"break_time_minutes" integer,
	"notes" text,
	"tasks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_activity_employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_activity_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"hours" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'client_notes_client_id_clients_id_fk'
    ) THEN
        ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'other_charges_work_activity_id_work_activities_id_fk'
    ) THEN
        ALTER TABLE "other_charges" ADD CONSTRAINT "other_charges_work_activity_id_work_activities_id_fk" FOREIGN KEY ("work_activity_id") REFERENCES "public"."work_activities"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'projects_client_id_clients_id_fk'
    ) THEN
        ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'work_activities_project_id_projects_id_fk'
    ) THEN
        ALTER TABLE "work_activities" ADD CONSTRAINT "work_activities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'work_activities_client_id_clients_id_fk'
    ) THEN
        ALTER TABLE "work_activities" ADD CONSTRAINT "work_activities_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'work_activity_employees_work_activity_id_work_activities_id_fk'
    ) THEN
        ALTER TABLE "work_activity_employees" ADD CONSTRAINT "work_activity_employees_work_activity_id_work_activities_id_fk" FOREIGN KEY ("work_activity_id") REFERENCES "public"."work_activities"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'work_activity_employees_employee_id_employees_id_fk'
    ) THEN
        ALTER TABLE "work_activity_employees" ADD CONSTRAINT "work_activity_employees_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;