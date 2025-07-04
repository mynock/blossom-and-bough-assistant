CREATE TABLE "invoice_line_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"work_activity_id" integer,
	"other_charge_id" integer,
	"qbo_item_id" text,
	"description" text NOT NULL,
	"quantity" real NOT NULL,
	"rate" real NOT NULL,
	"amount" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"qbo_invoice_id" text NOT NULL,
	"qbo_customer_id" text NOT NULL,
	"client_id" integer NOT NULL,
	"invoice_number" text NOT NULL,
	"status" text NOT NULL,
	"total_amount" real NOT NULL,
	"invoice_date" text NOT NULL,
	"due_date" text,
	"qbo_sync_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_qbo_invoice_id_unique" UNIQUE("qbo_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "qbo_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"qbo_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"unit_price" real,
	"income_account_ref" text,
	"active" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "qbo_items_qbo_id_unique" UNIQUE("qbo_id")
);
--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_work_activity_id_work_activities_id_fk" FOREIGN KEY ("work_activity_id") REFERENCES "public"."work_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_other_charge_id_other_charges_id_fk" FOREIGN KEY ("other_charge_id") REFERENCES "public"."other_charges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_qbo_item_id_qbo_items_qbo_id_fk" FOREIGN KEY ("qbo_item_id") REFERENCES "public"."qbo_items"("qbo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;