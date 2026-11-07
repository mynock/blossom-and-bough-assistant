---
name: invoicing
description: Run Blossom & Bough's invoicing end to end. It turns the Notion work logs and Google calendars into draft QuickBooks invoices, one client at a time; writes the batch's Notion "Invoice log" and "Invoice snapshot" pages; then watches the batch and applies Andrea's comments, log edits, Work Log changes and QuickBooks hand edits until Kevin sends the invoices. Use this whenever Kevin asks to invoice or bill clients (often a list of clients and rates like "Alder 50, Birch 55"), draft or redo an invoice, start a new batch, process Andrea's comments or updates on an invoice log, watch or loop on a batch, check whether something was billed, or start or stop the invoice watch jobs, even if he doesn't say "invoice". Never sends invoices.
---

# Invoicing

Blossom & Bough bills garden-care clients from Andrea's Notion work logs and Google
calendars. Claude drafts the invoices in QuickBooks; Andrea reviews them over a day or
two; Kevin sends them. This skill runs that whole loop.

1. **Set up the batch.** Read the rules, then create the log page, snapshot page and
   state file.
2. **Draft each client:** find the unbilled work, compute the hours and lines, and
   create the invoice.
3. **Write it up:** the client's log section, snapshot page and a chat summary.
4. **Watch:** apply Andrea's comments and edits as they arrive.
5. **Close out:** stop the jobs and carry anything held into the next batch.

## Ground rules

- **Never send an invoice.** Create and update drafts only, and never call a send,
  reminder or payment-link tool. QuickBooks has no true draft status: a created
  invoice is saved and open but unsent, and Kevin sends it himself.
- **Andrea's guidance wins** over Kevin's when they differ (Kevin's own rule). Apply
  hers without asking, and note in the rules doc that hers replaced his.
- **The rules doc is authoritative.** Read the Notion "Invoicing process — rules &
  checklist" (40389559-0126-81e7-b0cb-d6952291951e) and its comments at the start of
  every session; Andrea edits it. `references/drafting.md` summarizes it. If the two
  disagree, follow the doc and fix the summary. When a new rule comes out of a comment
  or a chat, add it to the doc (right section, who and when), and to memory
  (`feedback_invoice_drafting.md`, or `feedback_invoice_descriptions.md` for wording).
- **Never overwrite Andrea's edits.** Before any `update_invoice`, re-read the invoice
  and diff it against what you last wrote. A line update replaces every line, so
  resending old text erases her hand edits.
- **Ask; don't guess.** On gaps, conflicts or wavering notes ("don't bill all?",
  "upcharge a little?"), bill only what's clear, and put the question in that client's
  **Questions** list with what each answer would cost. In an interactive session,
  stop and ask Kevin instead. If he said he'll be away, record it and keep going.
- **Replies start with "🤖 Claude:".** The Notion connector is signed in as Andrea,
  so the prefix is the only way to tell your comments from hers.
- **Never edit a sent invoice.** If Kevin or Andrea has sent an invoice (QuickBooks
  shows it sent, or it's paid), leave it as it is, even if a later change would affect
  it. Note the difference in the log and flag it for Andrea.
- **Name invoices by the work they cover** (Andrea, 2026-11-06). She doesn't know what
  the numbers mean, so in logs, questions and replies write "the July–August invoice
  (#2236)", never just "#2236".
- **Payment reminders are Andrea's.** Flag an unpaid previous invoice in the log, but
  don't ask whether to send a reminder.

## Client data lives in a Google Sheet

This skill is checked into a public repo, so it holds no client-specific data.
Per-client rates, typical drive, Sluggo habits, debris habits and one-off billing notes
are in the private sheet **"Invoicing — client billing notes"**
(spreadsheet `12qe999erBf8vC6Leh0yiFufzSGFiJ11VG61scF5v67s`, tab `Clients`; read it with the
Google Sheets connector's `get_values`, range `Clients!A1:G100`). Client names in
these files (Alder, Birch, Cedar…) are made-up examples.

- Read the sheet at the start of every session, alongside the rules doc.
- When Andrea or Kevin gives a client-specific rule or fact (a rate, a usual drive, a
  habit, held work), add or update that client's row with who and when in `Source`,
  instead of writing it here. General rules go in the rules doc and `drafting.md`.
- Never put client names, addresses or amounts into this skill's files.

Read `references/tool-notes.md` before your first Notion or QuickBooks call in a
session. It covers the query limit, dropped comment threads, the full-replace line
updates and Ship-to, which caused most of the rework so far.

## 1. Set up the batch

Kevin gives clients and rates ("Alder 60, Birch 55, …"), sometimes with a
cutoff date. The batch is named by the date the invoices are created.

1. Read the rules doc and its open comments, the client sheet, then memory's invoicing files
   (`feedback_invoice_drafting.md`, `feedback_invoice_descriptions.md` and
   `feedback_andrea_precedence.md`, in
   `~/.claude/projects/-Users-kevinmehlbrech-Development-blossom-and-bough-assistant/memory/`).
   Also read the previous batch's snapshot page for work **held for later**.
2. Under the Notion page "Invoicing" (40389559-0126-8122-94b2-fee44c2c1328), create:
   - **"YYYY-MM-DD — Invoice log"**: status table, "Before sending" checklist, a section
     per client and Revisions.
   - **"YYYY-MM-DD — Invoice snapshot"**: your latest version of every invoice line.
   - Layouts are in `references/log-and-snapshot.md`. Link the snapshot and the rules doc
     from the log header.
3. Create the state file at `~/.claude/invoice-watch/<batch-date>/state.json`
   (`references/state-file.md`). Fill it in as each invoice is created.

## 2. Draft each client

Work one client at a time, following `references/drafting.md`:

1. Find the last billed visit.
2. Collect the unbilled work from Notion, Work 2 and the Work calendar.
3. Compute each visit's hours, including the drive split with same-day visits.
4. Add the design, coaching, materials, plants and Sluggo lines.
5. Write the descriptions in Andrea's style.
6. Gut-check against past invoices, then create the invoice in QuickBooks.

Bill by calendar month. When a client's unbilled work spans months, each month gets its
own invoice, unless Andrea said to hold a client's later work.

Notion's query allowance is shared and small. Fetch entry pages directly, and save
queries for finding entries. When Kevin hands over a long list and says he'll be away,
you may fan clients out to background agents. Each one computes and drafts its client;
you verify every invoice, then write the log and snapshot yourself, one edit at a time.

## 3. Write it up

After each client's invoice exists:

- **Log:** its section (QuickBooks link line, lines table, Flags, Hours, Assumptions,
  Questions), plus its row in the status table, which also shows the change vs the
  previous invoice and vs the 6-month average.
- **Snapshot:** its lines, with full descriptions and service dates.
- **State file:** its lines, including `service_date`. Use `watch.py STATE qbo-save`
  after a QuickBooks read, then fill in the dates.
- **Chat:** a short summary with the QuickBooks link, the hours math in brief, flags,
  and the total vs the previous invoice and the 6-month average (state the window and
  exclude the new invoice).

When every client is done, finish the "Before sending" checklist and ask Kevin
whether to start the watch.

## 4. Watch

Start the watch only when Kevin asks. Follow `references/watch.md`:

- **Job A, every 10 minutes:** comments, log page and QuickBooks hand edits.
- **Job B, twice an hour:** the Work Log Entries query plus a full comment-thread sweep.
- **Applying each change:** recompute, re-read and update the invoice, then the log,
  snapshot, reply and state.

`scripts/watch.py` does the comparisons. It reads the latest tool results straight
from this session's transcript, so nothing gets retyped.

## 5. Close out

When Kevin says to stop, or the invoices have gone out:

1. Delete the watch jobs, and ask any other session watching a batch to do the same.
2. Mark the state file stopped.
3. Tell Kevin what's still waiting on Andrea.

Leave the Notion "Invoiced" checkbox alone unless he asks. Work held for a later month
(for example, a client Andrea said to hold) stays in the snapshot's **Held for later**
section; check it at the start of the next batch.

## Talking to Kevin

Lead with what changed:

- Invoices created or changed, as old → new amounts, plus the batch total.
- Andrea's comments and what you did about each.
- Anything skipped or blocked, such as the query limit: mention it once, with the
  trial link from the error.
- What's waiting on Andrea or on him.

Use plain words. A quiet watch check is two sentences. End every report with
"Nothing was sent."
