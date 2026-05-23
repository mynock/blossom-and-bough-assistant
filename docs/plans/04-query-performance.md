# Plan 4 — Query Performance

**Findings**: #14, #15, #19
**Effort**: 1 week
**Tier**: 📉 Urgent-soon

## Why

List endpoints currently run ~3001 queries for 1000 activities (N+1 in `WorkActivityService`). Zero non-PK indexes means every FK filter is a sequential scan. Already painful, breaks at ~5k activities. SchedulingService also fetches the calendar O(helpers × days) when it could be O(1).

## 4.1 — Add indexes for every FK + common filter (Finding #15)

- **Files**: `server/src/db/schema.ts`
- **Problem**: Verified every table has `"indexes": {}` in the snapshot. Postgres does NOT auto-index FKs. Every join/filter on `client_id`, `employee_id`, `date`, `work_activity_id`, etc. is a sequential scan.
- **Approach**: Add to each table's second arg:
  ```typescript
  // work_activities
  (t) => ({
    clientIdx: index('work_activities_client_id_idx').on(t.clientId),
    projectIdx: index('work_activities_project_id_idx').on(t.projectId),
    dateIdx: index('work_activities_date_idx').on(t.date),
    statusIdx: index('work_activities_status_idx').on(t.status),
    clientDateIdx: index('work_activities_client_date_idx').on(t.clientId, t.date),
  })
  ```
  Same pattern for: `work_activity_employees(work_activity_id)` and `(employee_id)`, `other_charges(work_activity_id)`, `plant_list(work_activity_id)`, `client_notes(client_id)`, `projects(client_id)`, `invoices(client_id)`, `invoice_line_items(invoice_id)` and `(work_activity_id)`.
- **Verify**: Generate + run migration. `EXPLAIN ANALYZE SELECT * FROM work_activities WHERE client_id = 5` shows `Index Scan` not `Seq Scan`.

## 4.2 — Fix N+1 in WorkActivityService list methods (Finding #14)

- **Files**: `server/src/services/WorkActivityService.ts:157-172, 219-237, 540-555, 571-588, 606-623`
- **Problem**: Every list method loops `for (activity of activities) { await employees; await charges; await plants; }`. 1000 activities → 3001 sequential queries.
- **Approach**: Replace the per-row sub-query loop with three batched IN queries:
  ```typescript
  const activityIds = activities.map(a => a.id);
  const [allEmps, allCharges, allPlants] = await Promise.all([
    db.select({...}).from(workActivityEmployees)
      .leftJoin(employees, eq(workActivityEmployees.employeeId, employees.id))
      .where(inArray(workActivityEmployees.workActivityId, activityIds)),
    db.select().from(otherCharges).where(inArray(otherCharges.workActivityId, activityIds)),
    db.select().from(plantList).where(inArray(plantList.workActivityId, activityIds)),
  ]);
  const empsByActivity = Map.groupBy(allEmps, e => e.workActivityId);
  // ...attach to activities
  ```
  Apply to: `getAllWorkActivities`, `getWorkActivitiesByDateRange`, `findExistingWorkActivities`, `getWorkActivitiesByClientId`, `getWorkActivitiesByEmployeeId`.
- **Verify**: Add a query-count assertion in a test: list 100 activities runs ≤ 5 queries (was 301).

## 4.3 — Add `/api/dashboard/stats` endpoint (part of Finding #14)

- **Files**: New route `server/src/routes/dashboard.ts`; new service method on `WorkActivityService` or a new `DashboardService`; update `src/components/Dashboard.tsx:92-186`.
- **Problem**: Dashboard fetches the entire `/api/work-activities` (no filter, no pagination) on every page load and aggregates client-side.
- **Approach**: Backend computes `{ totalActivities, thisWeekActivities, totalHours, billableHours, needsReviewCount, recentActivities (LIMIT 5), upcomingActivities (LIMIT 5) }` with SQL `COUNT/SUM/GROUP BY`. Dashboard stops calling `/api/work-activities` and instead calls `/api/dashboard/stats`.
- **Verify**: Dashboard loads in <500ms even with 10k+ work activities (use the prod-pull feature to seed test data).

## 4.4 — Convert Reports route to SQL aggregation (also Finding #14)

- **Files**: `server/src/routes/reports.ts:59-138, 171-309`
- **Problem**: Both `/api/reports/time-series` and `/api/reports/summary` call `workActivityService.getAllWorkActivities(filters)` (full N+1 cost), then loop in JS to group by date/client/employee/day-of-week.
- **Approach**: Replace JS forEach loops with SQL `GROUP BY` queries. Example for day-of-week breakdown:
  ```typescript
  db.select({
    dayOfWeek: sql<string>`to_char(${workActivities.date}::date, 'Day')`,
    billableHours: sql<number>`SUM(${workActivities.billableHours})`,
    activities: sql<number>`COUNT(*)`,
  }).from(workActivities).where(...).groupBy(sql`to_char(${workActivities.date}::date, 'Day')`);
  ```
- **Verify**: Reports for "Last year" loads in <1s. Numbers match the prior JS-aggregated output on a known dataset.

## 4.5 — Calendar fetch deduplication (Finding #19)

- **Files**: `server/src/services/SchedulingService.ts:360-440, 75-148`
- **Problem**: `generateHelperAvailabilitySummary(helpers, 56)` loops over each helper and calls `checkHelperAvailability` → `getCalendarEventsInRange`. So for 5 helpers × 56 days = 5 separate Google Calendar API calls for the same range. Hits quota at ~50 chat queries/hour.
- **Approach**: In `getSchedulingContext`, fetch the full calendar range ONCE via `getCalendarEventsInRange`, then pass the events array into `generateHelperAvailabilitySummary` which filters per helper in-memory. Remove the per-helper `checkHelperAvailability` → `getEvents` call chain.
- **Verify**: A chat query that involves 5 helpers triggers exactly 1 Google Calendar API call (log/instrument to confirm).
