-- Plan 2.2/2.3/2.4 — Money columns to numeric, text dates to native date/time,
-- add composite unique on work_activity_employees.
--
-- This migration includes pre-flight validation that fails loudly if existing
-- data cannot be cast cleanly. If any of these guards trip, fix the data
-- first (or back it up) before re-running.

-- ---------- 2.2 pre-flight: text-stored numerics must parse as numbers ----------

DO $$
DECLARE bad_count int;
BEGIN
  SELECT COUNT(*) INTO bad_count FROM clients
   WHERE maintenance_rate IS NOT NULL AND maintenance_rate !~ '^\d+(\.\d+)?$';
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'clients.maintenance_rate has % non-numeric rows — clean up before migrating', bad_count;
  END IF;

  SELECT COUNT(*) INTO bad_count FROM clients
   WHERE maintenance_hours_per_visit IS NOT NULL AND maintenance_hours_per_visit !~ '^\d+(\.\d+)?$';
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'clients.maintenance_hours_per_visit has % non-numeric rows — clean up before migrating', bad_count;
  END IF;
END $$;
--> statement-breakpoint

-- ---------- 2.3 pre-flight: text dates must be ISO YYYY-MM-DD ----------

DO $$
DECLARE bad_count int;
BEGIN
  SELECT COUNT(*) INTO bad_count FROM work_activities
   WHERE date !~ '^\d{4}-\d{2}-\d{2}$';
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'work_activities.date has % non-ISO rows — normalize before migrating', bad_count;
  END IF;

  SELECT COUNT(*) INTO bad_count FROM client_notes
   WHERE date IS NOT NULL AND date !~ '^\d{4}-\d{2}-\d{2}$';
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'client_notes.date has % non-ISO rows — normalize before migrating', bad_count;
  END IF;

  SELECT COUNT(*) INTO bad_count FROM clients
   WHERE last_maintenance_date IS NOT NULL AND last_maintenance_date !~ '^\d{4}-\d{2}-\d{2}$';
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'clients.last_maintenance_date has % non-ISO rows — normalize before migrating', bad_count;
  END IF;

  SELECT COUNT(*) INTO bad_count FROM clients
   WHERE next_maintenance_target IS NOT NULL AND next_maintenance_target !~ '^\d{4}-\d{2}-\d{2}$';
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'clients.next_maintenance_target has % non-ISO rows — normalize before migrating', bad_count;
  END IF;

  SELECT COUNT(*) INTO bad_count FROM invoices
   WHERE invoice_date !~ '^\d{4}-\d{2}-\d{2}$';
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'invoices.invoice_date has % non-ISO rows — normalize before migrating', bad_count;
  END IF;

  SELECT COUNT(*) INTO bad_count FROM invoices
   WHERE due_date IS NOT NULL AND due_date !~ '^\d{4}-\d{2}-\d{2}$';
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'invoices.due_date has % non-ISO rows — normalize before migrating', bad_count;
  END IF;

  -- start/end times: H:MM, HH:MM, or HH:MM:SS. Postgres' `time` parser
  -- handles single-digit hours natively ('9:00'::time → 09:00:00) so we
  -- accept either width here — the USING cast below does the real check.
  SELECT COUNT(*) INTO bad_count FROM work_activities
   WHERE start_time IS NOT NULL AND start_time !~ '^\d{1,2}:\d{2}(:\d{2})?$';
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'work_activities.start_time has % non-parseable rows — expected H:MM, HH:MM, or HH:MM:SS', bad_count;
  END IF;

  SELECT COUNT(*) INTO bad_count FROM work_activities
   WHERE end_time IS NOT NULL AND end_time !~ '^\d{1,2}:\d{2}(:\d{2})?$';
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'work_activities.end_time has % non-parseable rows — expected H:MM, HH:MM, or HH:MM:SS', bad_count;
  END IF;
END $$;
--> statement-breakpoint

-- ---------- 2.4 pre-flight: de-duplicate work_activity_employees ----------

-- Keep the highest-id duplicate so we don't disturb the most recent assignment.
DELETE FROM work_activity_employees a
 USING work_activity_employees b
 WHERE a.id < b.id
   AND a.work_activity_id = b.work_activity_id
   AND a.employee_id = b.employee_id;
--> statement-breakpoint

-- ---------- 2.2: real → numeric (money) ----------
-- real → numeric does not need USING because Postgres casts implicitly,
-- but we include it for clarity and consistency.

ALTER TABLE "invoices" ALTER COLUMN "total_amount" SET DATA TYPE numeric(12, 2) USING "total_amount"::numeric(12, 2);--> statement-breakpoint
ALTER TABLE "invoice_line_items" ALTER COLUMN "rate" SET DATA TYPE numeric(12, 2) USING "rate"::numeric(12, 2);--> statement-breakpoint
ALTER TABLE "invoice_line_items" ALTER COLUMN "amount" SET DATA TYPE numeric(12, 2) USING "amount"::numeric(12, 2);--> statement-breakpoint
ALTER TABLE "other_charges" ALTER COLUMN "unit_rate" SET DATA TYPE numeric(12, 2) USING "unit_rate"::numeric(12, 2);--> statement-breakpoint
ALTER TABLE "other_charges" ALTER COLUMN "total_cost" SET DATA TYPE numeric(12, 2) USING "total_cost"::numeric(12, 2);--> statement-breakpoint
ALTER TABLE "qbo_items" ALTER COLUMN "unit_price" SET DATA TYPE numeric(12, 2) USING "unit_price"::numeric(12, 2);--> statement-breakpoint
ALTER TABLE "work_activities" ALTER COLUMN "hourly_rate" SET DATA TYPE numeric(12, 2) USING "hourly_rate"::numeric(12, 2);--> statement-breakpoint

-- ---------- 2.2: text/real → numeric (hours) ----------

ALTER TABLE "clients" ALTER COLUMN "maintenance_rate" SET DATA TYPE numeric(12, 2) USING "maintenance_rate"::numeric(12, 2);--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "maintenance_hours_per_visit" SET DATA TYPE numeric(6, 2) USING "maintenance_hours_per_visit"::numeric(6, 2);--> statement-breakpoint
ALTER TABLE "work_activities" ALTER COLUMN "billable_hours" SET DATA TYPE numeric(6, 2) USING "billable_hours"::numeric(6, 2);--> statement-breakpoint
ALTER TABLE "work_activities" ALTER COLUMN "total_hours" SET DATA TYPE numeric(6, 2) USING "total_hours"::numeric(6, 2);--> statement-breakpoint
ALTER TABLE "work_activity_employees" ALTER COLUMN "hours" SET DATA TYPE numeric(6, 2) USING "hours"::numeric(6, 2);--> statement-breakpoint

-- ---------- 2.3: text → date ----------

ALTER TABLE "client_notes" ALTER COLUMN "date" SET DATA TYPE date USING "date"::date;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "last_maintenance_date" SET DATA TYPE date USING "last_maintenance_date"::date;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "next_maintenance_target" SET DATA TYPE date USING "next_maintenance_target"::date;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "invoice_date" SET DATA TYPE date USING "invoice_date"::date;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "due_date" SET DATA TYPE date USING "due_date"::date;--> statement-breakpoint
ALTER TABLE "work_activities" ALTER COLUMN "date" SET DATA TYPE date USING "date"::date;--> statement-breakpoint

-- ---------- 2.3: text → time ----------

ALTER TABLE "work_activities" ALTER COLUMN "start_time" SET DATA TYPE time USING "start_time"::time;--> statement-breakpoint
ALTER TABLE "work_activities" ALTER COLUMN "end_time" SET DATA TYPE time USING "end_time"::time;--> statement-breakpoint

-- ---------- 2.4: composite unique index ----------

CREATE UNIQUE INDEX "wae_wa_emp_uidx" ON "work_activity_employees" USING btree ("work_activity_id","employee_id");
