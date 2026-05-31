-- Indexes supporting QBO invoice import / matcher hot paths.
--
-- 1) Composite index for the per-invoice candidate query in
--    InvoiceImportService.matchInvoiceLines and rematchInvoice. Without this,
--    a sync of N invoices triggers N seq scans of work_activities.
CREATE INDEX IF NOT EXISTS "work_activities_matcher_idx"
  ON "work_activities" ("client_id", "status", "date");

-- 2) Speeds up the WHERE match_status='needs_review' scan in getReviewQueue.
--    Partial keeps it small since most line items are 'auto' or 'manual'.
CREATE INDEX IF NOT EXISTS "invoice_line_items_review_queue_idx"
  ON "invoice_line_items" ("invoice_id")
  WHERE "match_status" = 'needs_review';

-- 3) Speeds up the double-link cross-invoice check in relinkLineItem and the
--    orphan check in revertOrphanedActivities. Partial — only meaningful rows.
CREATE INDEX IF NOT EXISTS "invoice_line_items_work_activity_idx"
  ON "invoice_line_items" ("work_activity_id")
  WHERE "work_activity_id" IS NOT NULL;

-- 4) DB-enforced single-claim invariant: a work activity can only be linked
--    to one invoice_line_item in ('auto','manual') status at a time. Prevents
--    the SELECT-then-UPDATE race in relinkLineItem from silently creating
--    double-links. The application-level check in relinkLineItem still issues
--    the 409 warning for the common UX case; this index is the safety net.
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_line_items_work_activity_single_claim_uidx"
  ON "invoice_line_items" ("work_activity_id")
  WHERE "work_activity_id" IS NOT NULL AND "match_status" IN ('auto', 'manual');
