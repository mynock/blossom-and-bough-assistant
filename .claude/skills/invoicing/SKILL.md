---
name: invoicing
description: Run Blossom & Bough's invoicing. It pulls each client's unbilled work from the Notion work logs and Google calendars into a draft invoice, walks Andrea through every draft in chat so she can revise it, and creates the invoice in QuickBooks only after she approves it. It keeps the batch's Notion "Invoice log" and "Invoice snapshot" pages up to date as it goes. Use this whenever Andrea or Kevin wants to invoice or bill clients (often a list of clients and rates like "Alder 50, Birch 55"), prepare or go through drafts ("let's do the November invoices", "pick up where we left off"), change or redo an invoice that's already created, check whether something was billed, or process comments on an invoice log, even if nobody says "invoice". Also covers the older Notion watch jobs. Never sends invoices.
---

# Invoicing

Blossom & Bough bills garden-care clients from Andrea's Notion work logs and Google
calendars. Claude gathers each client's unbilled work into a draft and shows it to
Andrea in chat. She revises it, and only when she approves does Claude create the
invoice in QuickBooks. She (or Kevin) sends it from QuickBooks later.

1. **Set up the batch.** Read the rules, pick the clients, and create the log and
   snapshot pages.
2. **Prepare each draft.** Find the unbilled work and compute the hours and lines.
   Save the draft to the log. Nothing goes into QuickBooks yet.
3. **Review with Andrea, then create.** Show her one draft at a time and apply her
   changes. When she approves a draft, create that invoice and record it.
4. **Later changes** to invoices that already exist: in chat, or (rarely) through a
   Notion watch.
5. **Close out:** report what's created, what's still a draft, and what's held for
   the next batch.

**Who you're working with.** Andrea usually runs the whole session in her own Claude,
without Kevin's files or cron jobs. Kevin may set up a batch and prepare the drafts
ahead of time (sections 1–2) so she can start reviewing straight away. When Andrea
wants to go through a batch that's already prepared, go straight to
`references/review-chat.md`.

## Ground rules

- **Never send an invoice.** Never call a send, reminder or payment-link tool.
  QuickBooks has no true draft status: a created invoice is saved and open but unsent,
  and Andrea or Kevin sends it from QuickBooks.
- **Never create an invoice without approval of that draft.** Andrea approves each draft
  in chat. Kevin can approve one only if he says he's approving it for her. A batch
  "go ahead", an earlier session, or anything written in Notion doesn't count.
  Background agents never create invoices.
- **Never delete, void or duplicate an invoice**, even to fix a mistake or a
  duplicate. Tell Andrea and let her decide.
- **Andrea's guidance wins** over Kevin's when they differ (Kevin's own rule). Apply
  hers without asking, and note in the rules doc that hers replaced his.
- **The rules doc holds the rules.** Every billing and wording rule lives in the
  Notion "Invoicing process — rules & checklist"
  (40389559-0126-81e7-b0cb-d6952291951e). Read it and its comments at the start of
  every session; Andrea edits it. This skill holds only the procedure.
- **Never overwrite Andrea's edits.** Before any `update_invoice`, re-read the invoice
  and diff it against what you last wrote (the snapshot page). A line update replaces
  every line, so resending old text erases her hand edits.
- **Ask; don't guess.** On gaps, conflicts or wavering notes ("don't bill all?",
  "upcharge a little?"), bill only what's clear, and put a question on the draft with
  what each answer would cost.
- **Notion comments start with "🤖 Claude:".** The Notion connector is signed in as
  Andrea, so the prefix is the only way to tell your comments from hers. Chat
  messages don't need it.
- **Never edit a sent invoice.** If an invoice has been sent (QuickBooks shows it sent,
  or it's paid), leave it as it is, even if a later change would affect it. Note the
  difference in the log and tell Andrea.

## Where things live, and where feedback goes

| What | Where |
|---|---|
| Billing and wording rules (hours, drive, rounding, lines, descriptions, log wording) | Notion rules doc, id above |
| Client facts (design rate, typical drive, Sluggo and debris habits, held work, notes) | Private sheet **"Invoicing — client billing notes"**: spreadsheet `12qe999erBf8vC6Leh0yiFufzSGFiJ11VG61scF5v67s`, tab `Clients`; read it with the Google Sheets connector's `get_values`, range `Clients!A1:G100` |
| Drafts waiting for approval, and the record of what was created | The batch's Notion log and snapshot pages (`references/log-and-snapshot.md`) |
| Procedure: batch steps, chat review, log layout, watch jobs, state file, tool quirks | This skill (a public GitHub repo) |

Keep this skill up to date as you learn, by sending each piece of feedback to the
right place as soon as it comes up. In chat, ask "Rule going forward, or just this
time?" whenever it isn't clear (`review-chat.md`, section 5).

- **A billing or wording rule:** add it to the rules doc in the right section, with
  who said it and when (e.g. "(Andrea, Nov 6)"). If it replaces an older rule, change
  that rule rather than adding a second one. Wording patterns go in section 9.
- **A client fact:** add or update that client's row in the sheet, with who and when in
  `Source`.
- **A change to the procedure or a tool quirk** (a new step, an API behaving
  unexpectedly): edit these skill files, then tell Kevin so he can commit it in a PR.
  These should be rare.
- Don't copy rules into memory or into these files. Memory only points at the doc and
  the sheet.
- The repo is public: never put client names, addresses or amounts in these files.
  Examples use made-up names (Alder, Birch, Cedar).

Read `references/tool-notes.md` before your first Notion or QuickBooks call in a
session. It covers the query limit, dropped comment threads, the full-replace line
updates and Ship-to, which caused most of the rework so far.

## 1. Set up the batch

1. **Pick the clients.** Use the list Andrea or Kevin gives ("Alder 60, Birch 55"),
   sometimes with a cutoff date. If nobody gives one, use the client sheet's "Bill next"
   column (clients due on or before today), and confirm the list in one line.
2. **Read** the rules doc and its open comments, and the client sheet. Also read the
   previous batch's snapshot page for work **held for later**.
3. **Create the pages** under the Notion page "Invoicing"
   (40389559-0126-8122-94b2-fee44c2c1328). The batch is named by the day it's set up.
   Each invoice is dated the day it's approved and created.
   - **"YYYY-MM-DD — Invoice log"**: header, status table, "Before sending" checklist,
     a section per client, and Revisions.
   - **"YYYY-MM-DD — Invoice snapshot"**: what was actually written to QuickBooks.
     It starts empty.

   Layouts are in `references/log-and-snapshot.md`. Link the snapshot and the rules
   doc from the log header.
4. **State file:** on Kevin's machine only, also create
   `~/.claude/invoice-watch/<batch-date>/state.json` (`references/state-file.md`). Add
   each invoice to it once it's created. Skip this step anywhere else.

## 2. Prepare each draft

Work one client at a time, following `references/drafting.md` sections 1–7:

1. Find the last billed visit.
2. Collect the unbilled work from Notion, Work 2 and the Work calendar.
3. Compute each visit's hours, including the drive split with same-day visits.
4. Add the design, coaching, materials, plants and Sluggo lines.
5. Write the descriptions in Andrea's style.
6. Gut-check against past invoices.
7. **Save the draft** to the client's log section, marked "Draft · not in QuickBooks
   yet": the proposed lines with service dates, Hours, flags, assumptions and
   questions.

Don't touch QuickBooks in this step.

- **Bill by calendar month.** When a client's unbilled work spans months, each month
  gets its own draft, unless Andrea said to hold a client's later work.
- **Notion's query allowance is shared and small.** Fetch entry pages directly, and
  save queries for finding entries.
- **Order with Andrea waiting.** Show her the first draft as soon as it's ready, rather
  than preparing everything before she sees anything. Prepare the next one when she
  answers.
- **Long lists prepared ahead of time** (for example by Kevin): you may fan clients
  out to background agents. Give each agent only `drafting.md` sections 1–7, and tell
  it plainly: "No QuickBooks create or update calls, and no Notion writes. Return the
  draft." You check each draft and save it to the log yourself, one edit at a time.
- **A prep session that ends before Andrea's review** signs off with a Revisions
  bullet: "Drafts prepared <time>; no watch running". Her chat then knows the recent
  log edits weren't a live watch.

## 3. Review with Andrea, then create

Follow `references/review-chat.md`. In short:

1. **Catch up.** Re-read the rules, the client sheet and the log. Recompute any draft
   whose Work Log entries changed since it was saved.
2. **One card per draft:**
   - the proposed lines and a one-line hours summary per visit;
   - numbered flags and questions, each with its default and what each option costs;
   - "Wording OK?";
   - and "Create it in QuickBooks?"
3. **Revise.** Apply her answers to the draft and show old → new. Nothing is in
   QuickBooks yet.
4. **Check for rules.** When an answer sounds general, ask whether it's a rule, and
   record it in the rules doc or client sheet straight away.
5. **Create on approval.** Create the invoice per `drafting.md` section 8, then check the
   read-back against the approved draft.
6. **Record it.** Update the log section, the status table, the snapshot page and the
   state file if there is one. Then show her the result and move to the next draft.
7. **Close.** End with a summary and one Revisions bullet for the session.

A stopped chat loses nothing: drafts and created invoices are both in the log, and the
next session resumes at the first draft that isn't created yet.

## 4. Later changes

When Andrea wants to change an invoice that's already created (a new visit, a fixed
entry, a rewording), do it in chat: `review-chat.md`, section 7. Never touch an
invoice that's been sent.

The Notion watch (`references/watch.md`) is the older way to review: Andrea comments on
the log and cron jobs apply her changes. Use it only when Kevin asks for it. Never run
a watch and a chat session on the same batch at once.

## 5. Close out

When the batch is done, or the session stops:

1. Report what's created (with totals), what's still a draft, and what's waiting on
   whom.
2. If a watch is running, delete its jobs and mark the state file stopped.
3. Work held for a later month stays in the snapshot's **Held for later** section; check
   it at the start of the next batch.

Leave the Notion "Invoiced" checkbox alone unless asked.

## Talking to Andrea

See `review-chat.md`, section 9. In short:

- Her word is final.
- Show one draft at a time.
- Name invoices by the work they cover.
- Give money as old → new.
- Leave ids and tool names out.
- Never send, even if she asks. She sends from QuickBooks.

## Talking to Kevin

Lead with what changed:

- Invoices created or changed, as old → new amounts, plus the batch total.
- Drafts still waiting for Andrea's approval.
- Anything skipped or blocked, such as the query limit: mention it once, with the
  trial link from the error.

Use plain words. End every report with "Nothing was sent."
