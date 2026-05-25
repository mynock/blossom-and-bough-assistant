# Plan 2 — Data Integrity & Schema

**Findings**: #8, #9, #10, #11, #12
**Effort**: 1.5 weeks
**Tier**: 🚨 Urgent

## Why

Zero transactions across the entire codebase + several silent-corruption risks in column types and constraints. Each item below is independently shippable. The transaction fix (2.1) alone closes the largest class of silent data-loss risks in the codebase.

## 2.1 — Add `db.transaction()` to all multi-statement writes (Finding #8)

- **Files**:
  - `server/src/services/WorkActivityService.ts:286-339` (createWorkActivity — 4 separate inserts)
  - `server/src/services/WorkActivityService.ts:463-473` (deleteWorkActivity — 4 separate deletes)
  - `server/src/services/WorkActivityService.ts` updateWorkActivity (find the multi-step update)
  - `server/src/services/NotionSyncService.ts:1271-1370` (delete-then-reinsert charges + employees — biggest data-loss risk)
  - `server/src/services/InvoiceService.ts:526-566` (saveInvoiceToLocal — invoice + line items)
  - `server/src/services/InvoiceService.ts:589-638` (deleteInvoice)
  - `server/src/services/DataMigrationService.ts:198-211` (clearAllData)
  - `server/src/services/AdminService.ts:113-115` (clearWorkActivities), `:113-152` (clearAllData)
- **Problem**: Grepping `db.transaction` returns zero hits. Multi-statement writes execute as independent transactions. A failure between any two statements leaves orphaned rows or half-deleted records. Concrete scenario: `NotionSyncService.updateWorkActivityFromParsedData` deletes all `otherCharges` rows, then crashes before reinserting → billing data permanently lost.
- **Approach**: Wrap each multi-statement body in `await this.db.transaction(async (tx) => { ... })`. Pass `tx` through to any helper methods called from within. Add a helper `withTransaction<T>(fn: (tx) => Promise<T>): Promise<T>` on `DatabaseService` for use by services that compose across multiple service methods.
- **Verify**: For each fixed path, write an integration test that injects a synthetic failure between writes and asserts no partial state remains (use `tx.rollback()` mid-method to simulate).

## 2.2 — Migrate money columns to `numeric` (Finding #9)

- **Files**: `server/src/db/schema.ts:13-14, 64-65, 87, 99-100, 135, 151, 168-169`
- **Problem**: Invoice amounts, rates, hours, totals all use Postgres `real` (~7 significant digits, IEEE-754). Invoice line totals will drift from invoice totals; QuickBooks reconciliation breaks. Also `clients.maintenance_hours_per_visit` and `clients.maintenance_rate` are stored as `text` — also wrong.
- **Approach**: Update schema column types and generate a migration:
  ```typescript
  // schema.ts: replace real() with numeric({ precision: 12, scale: 2 }) for money,
  //            numeric({ precision: 6, scale: 2 }) for hours.
  ```
  Migration SQL pattern:
  ```sql
  ALTER TABLE invoices ALTER COLUMN total_amount TYPE numeric(12,2) USING total_amount::numeric(12,2);
  -- repeat for: invoice_line_items.rate, .amount; other_charges.unit_rate, .total_cost;
  -- qbo_items.unit_price; work_activities.hourly_rate, .billable_hours, .total_hours
  ```
  For `clients.maintenance_hours_per_visit` and `clients.maintenance_rate` (text), validate first: `SELECT id FROM clients WHERE maintenance_rate !~ '^\d+(\.\d+)?$'`.
- **Verify**: After migration, `SELECT 0.1::numeric(12,2) + 0.2::numeric(12,2)` returns `0.30` (not 0.30000000000000004). Existing invoice totals unchanged.

## 2.3 — Migrate text date columns to native `date` (Finding #10)

- **Files**: `server/src/db/schema.ts` (clients.last_maintenance_date, clients.next_maintenance_target, work_activities.date, client_notes.date, invoices.invoice_date, invoices.due_date); `work_activities.start_time` and `end_time` → `time`.
- **Problem**: Range queries work only by accident (ISO sort ≈ date sort). One non-ISO string corrupts ordering. `WorkActivityService.getWorkActivitiesByDateRange` (lines 206-216) has a broken implementation — uses `eq` instead of `between` with a `// TODO` comment.
- **Approach**:
  1. Pre-flight: `SELECT id, date FROM work_activities WHERE date !~ '^\d{4}-\d{2}-\d{2}$'` — if any rows, normalize first.
  2. Update schema, generate migration with `ALTER TABLE ... TYPE date USING col::date`.
  3. Fix `WorkActivityService.getWorkActivitiesByDateRange` — switch to `between(workActivities.date, start, end)`.
  4. Update any frontend code that compares dates as strings.
- **Verify**: `getWorkActivitiesByDateRange('2024-01-01', '2024-12-31')` returns expected rows. `EXPLAIN` shows index usage (after Plan 4 adds indexes).

## 2.4 — Add composite unique on `work_activity_employees` (Finding #11)

- **Files**: `server/src/db/schema.ts:83-90`
- **Problem**: Same `(workActivityId, employeeId)` pair can be inserted twice. Double-clicks, retries, or re-runs of `NotionSyncService` double-count employee hours, which flow into invoices.
- **Approach**:
  1. De-dupe existing rows:
     ```sql
     DELETE FROM work_activity_employees a USING work_activity_employees b
      WHERE a.id < b.id
        AND a.work_activity_id = b.work_activity_id
        AND a.employee_id = b.employee_id;
     ```
  2. Add `uniqueIndex('wae_wa_emp_uidx').on(t.workActivityId, t.employeeId)` in schema.
  3. Update `WorkActivityService` insert paths to use `.onConflictDoUpdate({ target: [workActivityId, employeeId], set: { hours, ... } })`.
- **Verify**: Insert same `(workActivityId, employeeId)` twice → second call updates, doesn't create duplicate.

## 2.5 — Make FK on-delete behavior explicit (Finding #12) — 🚫 Won't do

**Decision**: skip this sub-plan. The original problem statement and approach are preserved below as a historical record, but no work is scheduled.

**Rationale**:

1. **Scale**: the app has ~2 users (business owner + dev/ops consultant). Destructive-delete scenarios where a stale row would silently corrupt downstream data are vanishingly rare in practice.
2. **Current behavior is safe**: all FKs use `ON DELETE NO ACTION`, which fails loudly when a delete would violate referential integrity. That's the desired behavior — a thrown error is much better than silent cascade or orphaned rows. The risk this sub-plan was meant to address ("someone switches to `CASCADE` to silence the error") is a code-review concern, not an architectural one.
3. **Cross-cutting cost**: introducing `deleted_at` on `clients`, `employees`, `projects`, and `invoices` would touch *every* active query against those tables — every list, every join, every report — and add a permanent maintenance tax (forget the `isNull(deletedAt)` filter once and you leak deleted data into reports). Not justified at current scale.
4. **Revisit trigger**: if multi-user/role separation lands (i.e. Finding #7 gets addressed), reopen this. At that point soft-delete becomes more defensible because (a) more humans means more accidental deletes, and (b) audit/recovery needs grow.

---

### Original problem statement (historical)

- **Files**: `server/src/db/schema.ts` (all 13 FK columns)
- **Problem**: All FKs use `ON DELETE NO ACTION`. `ClientService.deleteClient`, `EmployeeService.deleteEmployee`, `ProjectService.deleteProject` just call `db.delete()` and rely on the FK to throw. If anyone "fixes" this by switching to `CASCADE` to silence the error, a single client delete wipes their invoice history.
- **Approach (not executed)**: Per-FK intent:
  - **`CASCADE`** (true junction/child): `work_activity_employees.work_activity_id`, `other_charges.work_activity_id`, `plant_list.work_activity_id`, `invoice_line_items.invoice_id`.
  - **`RESTRICT`/`NO ACTION`** (preserve business entity): `work_activities.client_id`, `invoices.client_id`, `projects.client_id`, `work_activity_employees.employee_id`.
  - **`SET NULL`** (preserve historical row): `invoice_line_items.qbo_item_id`, `invoice_line_items.work_activity_id`.
  - Add a `deleted_at timestamp` column to `clients`, `employees`, `projects`, `invoices` and convert their `delete*` service methods to UPDATE-set-deleted-at. Filter every active query by `isNull(table.deletedAt)`.
