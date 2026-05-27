ALTER TABLE "clients" ADD COLUMN "qbo_customer_id" text;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "match_status" text DEFAULT 'unmatched' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "match_score" real;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "match_candidates" jsonb;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_qbo_customer_id_unique" UNIQUE("qbo_customer_id");