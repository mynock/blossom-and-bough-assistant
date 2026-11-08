# Batch state file

One JSON file per watched batch. Keep it somewhere that survives session restarts,
`~/.claude/invoice-watch/<batch-date>/state.json` (the session scratchpad is wiped).
The log baseline (`log-baseline.md`) is written next to it by `watch.py log-save`.

The Notion **snapshot page** is the durable, human-readable copy of the same invoice
data. If the state file is lost, rebuild it from the snapshot page plus a fresh
QuickBooks read (`qbo-save`), then set service dates from the snapshot.

```json
{
  "batch": "2026-10-25",
  "log_page_id": "40489559-0126-8109-ad56-c47b2e4a45f2",
  "snapshot_page_id": "40689559-0126-81a6-b7af-ea10c8005eb5",
  "rules_page_id": "40389559-0126-81e7-b0cb-d6952291951e",

  "log": {
    "baseline_file": "/Users/.../invoice-watch/2026-10-25/log-baseline.md",
    "last_edited_by_me": "2026-10-28T03:58:15.412Z",
    "known_discussion_ids": ["40689559-0126-8050-b7f3-001c5d202b14", "..."]
  },

  "invoices": {
    "2272": {
      "txn_id": "5364",
      "customer_id": "djQuMToxOTM1MTQ4ODQ1NDM5NTk6OWQ2OTllOTYwOA:30",
      "total": 550.75, "txn_date": "2026-10-26", "due_date": "2026-11-25",
      "lines": [
        {"id": "1", "item": "Specialized garden care", "item_id": "55", "qty": 3.25, "rate": 55.0,
         "amount": 178.75, "service_date": "2026-09-10", "description": "Weeding and horsetail removal, ..."}
      ]
    }
  },

  "entries": {
    "processed_through": "2026-10-28T03:33:00Z",
    "scope": {
      "clients": ["Alder", "Birch", "Cedar"],
      "dates": ["2026-09-08", "2026-09-10", "..."],
      "why": "Clients in this batch, plus every date with a billed visit (same-day entries share drive)."
    }
  },

  "held": {"Cedar": "October work held until Andrea fills in dates"},
  "pending": [{"what": "Andrea: Alder Oct 27 raking deduction? shrub price?"}],
  "handled": [{"at": "2026-10-28T04:35Z", "what": "Birch Sep 30 logged -> new #2280 ..."}],
  "comments_handled_through": "2026-10-28T05:25Z",
  "jobs": "RUNNING: 5afea4fd '3-59/10' comments+log+QBO; 35e2ed4f '22,52' entries + thread sweep"
}
```

Field notes:

- `invoices.*.lines[].service_date` is the one thing QuickBooks never returns. It is
  needed for every `update_invoice` (a full line replace), so keep it current whenever
  you write a line. `null` = undated (design / PM lines). `qbo-save` keeps existing
  dates and marks new lines `UNKNOWN` for you to fill in.
- `entries.scope.dates`: any client's entry on these dates matters, because drive is
  split across the same crew's visits that day. Add a date whenever a visit is billed.
- `processed_through`: the newest `Last edited` you have fully handled. Never move it
  past an entry you haven't settled.
- `handled`: one short line per change, with what moved (old → new totals). Useful
  when Kevin asks "what changed?" and when a later edit has to be reconciled.
- `jobs`: the cron job ids and schedules, or `STOPPED <when> per Kevin`.

## Setting up a new batch

1. Create the folder and state file. Fill `invoices` by reading the batch's invoices
   (`qbo_sales_get_invoices` with `doc_numbers`), then `watch.py STATE qbo-save`, then
   fill in each line's `service_date` from what you wrote (or the snapshot page).
2. Fetch the log page, then `watch.py STATE log-save` (baseline + thread ids).
3. If the batch has no snapshot page yet, create "YYYY-MM-DD — Invoice snapshot"
   under Invoicing (parent 40389559-0126-8122-94b2-fee44c2c1328): one table per
   invoice (Date / Item / Qty / Rate / Amount / Description), a total line, an
   **Andrea's edits** table (Invoice / line | Claude's version | Andrea's version),
   **Held for later** and **Open questions**. Link it from the log header.
4. Set `entries.processed_through` to now and fill `scope`.
