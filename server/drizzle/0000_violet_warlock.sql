CREATE TABLE `client_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`note_type` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`geo_zone` text NOT NULL,
	`is_recurring_maintenance` integer DEFAULT false NOT NULL,
	`maintenance_interval_weeks` integer,
	`maintenance_hours_per_visit` text,
	`maintenance_rate` text,
	`last_maintenance_date` text,
	`next_maintenance_target` text,
	`priority_level` text,
	`schedule_flexibility` text,
	`preferred_days` text,
	`preferred_time` text,
	`special_notes` text,
	`active_status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_client_id_unique` ON `clients` (`client_id`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` text NOT NULL,
	`name` text NOT NULL,
	`regular_workdays` text NOT NULL,
	`home_address` text NOT NULL,
	`min_hours_per_day` integer NOT NULL,
	`max_hours_per_day` real NOT NULL,
	`capability_level` real NOT NULL,
	`hourly_rate` real NOT NULL,
	`notes` text,
	`active_status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_employee_id_unique` ON `employees` (`employee_id`);--> statement-breakpoint
CREATE TABLE `other_charges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_activity_id` integer NOT NULL,
	`charge_type` text NOT NULL,
	`description` text NOT NULL,
	`quantity` real,
	`unit_rate` real,
	`total_cost` real NOT NULL,
	`billable` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`work_activity_id`) REFERENCES `work_activities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`status` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `work_activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_type` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`billable_hours` real,
	`total_hours` real NOT NULL,
	`hourly_rate` real,
	`project_id` integer,
	`client_id` integer,
	`travel_time_minutes` integer,
	`break_time_minutes` integer,
	`notes` text,
	`tasks` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `work_activity_employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_activity_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`hours` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`work_activity_id`) REFERENCES `work_activities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
