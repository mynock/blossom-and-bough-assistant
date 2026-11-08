# Watching a batch

After the drafts exist, Andrea reviews them. She comments on the log, edits the log
directly, fixes or adds Work Log entries, and edits invoices by hand in QuickBooks. The
watch keeps the invoices, the log and the snapshot page in step with her, without
losing her edits or missing her comments.

## The helper script

`scripts/watch.py STATE <command>` reads the newest tool results straight out of this
session's transcript, so you never paste page text or invoice JSON into a script.
Call the Notion or QuickBooks tool first, then run the command. Run it from the
project folder, so it can find the transcript.

| Command | After calling | Tells you |
|---|---|---|
| `log-diff` | `notion-fetch` of the log page | last-edit time vs yours, new thread ids, text diff vs the baseline |
| `log-save` | `notion-fetch` (after your own edits) | refreshes the baseline, `last_edited_by_me` and thread ids |
| `threads` | page-wide `notion-get-comments`, then per-id fetches of what it lists | threads the page-wide call left out; threads whose last comment isn't yours |
| `qbo-diff` | `qbo_sales_get_invoices` for all batch invoices | every changed total, date, line, qty, rate or description |
| `qbo-save` | `qbo_sales_get_invoices` (after your updates) | rewrites the snapshot in STATE; keeps service dates; flags new lines to date |

## Scheduling

Use two cron jobs per batch, because Notion's query allowance is shared by the whole
workspace and runs out quickly:

- **Job A, every 10 minutes:** comments, the log page and QuickBooks. It makes no data
  source queries.
- **Job B, twice an hour:** the Work Log Entries query plus a full thread sweep.

When two batches are watched at once, offset them so their queries don't bunch up.
For example, batch 1 uses `3-59/10` and `22,52`, and batch 2 uses `8-59/10` and `7,37`.
That's about 4 queries an hour in all. Only drop to one combined 5-minute job if Kevin
asks for it, for instance while Andrea is actively working in the log.

Keep the cron prompts short and let the skill carry the procedure:

```
Use the invoicing skill: run watch job A (comments, log page, QuickBooks) for the
2026-10-25 batch. State: ~/.claude/invoice-watch/2026-10-25/state.json. No Work Log
Entries queries in this job. Never send an invoice.
```

```
Use the invoicing skill: run watch job B (Work Log Entries + full thread sweep) for
the 2026-10-25 batch. State: ~/.claude/invoice-watch/2026-10-25/state.json. One data
source query at most; skip it if the allowance is used up. Never send an invoice.
```

Record the job ids in the state file's `jobs` field. Recurring jobs expire after 7
days and die with the session; tell Kevin when you create them.

## Job A: comments, log page, QuickBooks

1. Read the state file.
2. In parallel, fetch the log page and run `qbo_sales_get_invoices` with every invoice
   number in the state.
3. Run `watch.py STATE log-diff` and `watch.py STATE qbo-diff`.
4. For any **new thread id**, read it with `notion-get-comments` and `discussion_id`.
   Also re-read the threads where you're waiting on Andrea, such as a question you
   asked. A cheap check catches most replies; job B's sweep catches the rest.
5. Act on everything found (see **Applying a change**). If nothing changed, note the
   quiet check in the state file and report it in a line or two.

## Job B: Work Log Entries + thread sweep

1. **Entries.** Run one rows-mode query on Work Log Entries
   (`collection://21989559-0126-8004-bde3-000beb480c07`): filter `Last edited` on or
   after the watermark's date, sort by `Last edited` descending, limit about 12. Keep the
   rows edited after `processed_through` that are in scope, meaning a batch client or a
   scope date.
   - **Settle by visit date.** Act on a date only after every entry on it has gone 10
     minutes without an edit; Andrea fills entries in over several minutes. List the
     rest under `pending`.
   - For each settled date, fetch the entry pages, plus the same-day entries for the
     same crew, which share the drive. Fetch them directly; don't run more queries.
   - A newly logged visit means adding a line to that month's invoice, or creating a new
     invoice for a client with nothing in the batch. Draft it per `drafting.md`. An
     edited visit means recomputing its line.
   - Move `processed_through` to the newest `Last edited` you handled.
2. **Thread sweep.**
   - Call `notion-get-comments` for the whole log page, then run `watch.py STATE threads`.
   - Fetch every id it lists as NOT READ YET by `discussion_id`. If more than about 10
     are missing, have a general-purpose subagent fetch them read-only and report
     verbatim any comments after your last reply.
   - Run `threads` again and answer every unanswered thread.

## Applying a change

Whatever the trigger (a comment, a log edit, an entry edit or a hand edit):

1. **Pull the latest:** the comment thread, the entry page and the invoice. Re-read the
   invoice even if you read it a minute ago.
2. **Recompute** per `drafting.md`, and show the hours the way the log does (see
   `log-and-snapshot.md`).
3. **Update the invoice.** Send every line with its id, service date and current
   description, which may be Andrea's wording. For a new invoice, create it, then update
   it straight away to restore any summarized descriptions and set
   `shipping_address: ""`.
   - Add the new invoice to the state file and to job A's invoice list.
   - If job A's prompt names invoice numbers, recreate the job.
4. **Update the log:**
   - Status table row and batch total, the client's lines table, Hours table and flags.
   - Mark answered questions "Settled: …" inside their existing span.
   - Add a dated **Revisions** bullet with old → new amounts.
   - Put open questions in that client's **Questions** list.
5. **Update the snapshot page:**
   - The invoice's lines and total, and the batch total.
   - For a hand edit, a row in **Andrea's edits** with your version and hers.
6. **Reply in the thread**, if a comment triggered it. Say what you changed, the numbers
   (old → new), and anything still open.
   - If you missed or got something wrong, say so plainly.
   - Don't promise to resolve threads; you can't.
7. **Refresh and record:**
   - Fetch the log page, run `log-save`, then `qbo-save` after a fresh QuickBooks read.
   - Fix any `UNKNOWN` service dates, and add a `handled` entry to the state file.

**Hand edits in QuickBooks** (a changed description, date, price or removed line) are
Andrea's decisions. Keep them, record them in **Andrea's edits** and Revisions, and
update the log's numbers to match. Ask only if one looks like a slip, such as a total
that no longer matches the lines. Her wording changes are also style lessons: add the
pattern to section 9 of the rules doc.

**Andrea's log edits** (a deleted line, reworded text) are kept too; don't restore what
she removed.

**New rules** from Andrea go into the rules doc (client-specific ones into the client
sheet) and the reply; see "Where things live" in `SKILL.md`. If a rule changes
amounts already billed, recompute those invoices, in every batch that's still open.

## Several batches at once

Another Claude session (often a fork) may be watching another batch. Keep them in step
with `SendMessage` to its `local_…` id:

- Pass on new rules from Andrea, and changes to the watch procedure.
- When Kevin starts, re-times or stops the watch, tell the other session.
- Ask for its job ids and a confirmation, and relay its report to Kevin in a line.
- If Kevin decides something about a rule, forward his words.

## Stopping

1. Delete this session's jobs (`CronList`, then `CronDelete`).
2. Ask any other watching session to do the same.
3. Mark the state file `jobs: "STOPPED <time> per Kevin"`, keeping the watermark,
   baseline and snapshot so a restart picks up where it left off.
4. Tell Kevin what's still waiting on Andrea.
