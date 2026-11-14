# Reviewing a batch with Andrea in chat

Andrea opens a chat and goes through a drafted batch invoice by invoice. She answers
questions, fixes things and approves each invoice as she goes. Claude updates
QuickBooks and the Notion pages right away. This replaces the comment-and-watch loop in
`watch.md`. Client names here are made-up examples.

She may be in her own Claude, without Kevin's machine. Don't rely on the local state
file, `watch.py` or cron jobs. The Notion log and snapshot pages hold everything you
need, including the line service dates QuickBooks doesn't return. If a state file is
there, keep it up to date as well.

## Contents

1. Before you start
2. Opening the session
3. One invoice at a time
4. Handling her answers
5. Rule or one-off?
6. Finishing an invoice
7. Ending (or pausing) the session
8. Talking to Andrea

## 1. Before you start

- **No watch at the same time.** A watch and a chat review editing the same batch
  will overwrite each other. Treat a watch or Kevin's session as live if either of
  these happened in the last 30 minutes:
  - a "🤖 Claude:" comment appeared on the log;
  - the log was edited, and the edit isn't one Andrea describes as hers.

  If it looks live, ask her to have Kevin stop it, and don't edit anything until he
  has. Her Claude can't stop Kevin's jobs.
- **Connectors she needs:** Notion, QuickBooks and Google Sheets (the client sheet).
  Google Calendar is needed only to recompute visits from the Work 2 calendar. If one
  is missing, say which, and work with what you have.
- Read `tool-notes.md`. The QuickBooks quirks (full line replacement, no service dates
  in read-backs, Ship-to) and the Notion query limit apply here unchanged.

## 2. Opening the session

She'll say something like "let's review the November invoices" or "go through
Birch's invoice".

1. **Find the batch.** Use the log she names. Batches are named by the date the
   invoices were created, but she'll usually name the month of work ("the October
   invoices"); match it to the batch whose invoices cover that month. If nothing is
   named, use the newest "YYYY-MM-DD — Invoice log" under "Invoicing"
   (40389559-0126-8122-94b2-fee44c2c1328). Either way, confirm it with her in one line.
2. **Read, in parallel:**
   - the rules doc and its open comments;
   - the client sheet;
   - the log page;
   - the snapshot page.

   Take the batch's invoice list from the snapshot's `### #NNNN Client (Mon)`
   headings. A client can have two invoices (September and October), and the status
   table has one row per client. Then run `qbo_sales_get_invoices` for every invoice
   on that list.
3. **Catch up on what changed since the last write.**
   - **Hand edits.** Compare QuickBooks with the snapshot. Hand edits are hers: keep
     them, record them under **Andrea's edits** on the snapshot, and mention them in
     the opening summary. QuickBooks doesn't show service dates, so a date she changed
     there can't be seen. Use hers if she mentions one.
   - **Work Log entries.** Run **one** rows query on Work Log Entries:
     - filter `Last edited` on or after the snapshot's "Entries checked" date (or its
       "Read" date if there's no "Entries checked" line yet);
     - limit 50;
     - the filter is date-only, so compare the times yourself (`tool-notes.md`).

     Keep entries for the batch's clients and for every service date in the
     snapshot; a same-day entry for another client can change the drive split.
     Recompute anything that changed before you show that invoice.
     - On `usage_limit_reached`, tell her entries weren't re-checked and carry on.
       Don't retry.
     - **A new visit for a batch client:** offer to add it to that month's invoice,
       or to draft a new invoice per `drafting.md` section 8. With a new invoice,
       leave Ship-to blank and ask her to check the addresses. Don't add either one
       without her yes.
     - When the check is done, write "Entries checked <time> UTC" on the snapshot.
   - **Comments.** The page-wide `get_comments` call drops threads, and `watch.py` isn't
     available. Collect every `discussion-urls` id from the log fetch yourself, and
     fetch each thread by `discussion_id`. A thread whose last comment doesn't start
     with "🤖 Claude:" is waiting on her answer, or she already answered in it. An
     answer she gave there counts.
4. **Give the opening summary:**
   - how many invoices there are and the batch total;
   - which are already sent or paid (skip those, and never edit them);
   - which have questions;
   - anything that changed since the draft.

   Then suggest an order: invoices with questions first, clean ones last.
   Example: "12 invoices, $3,912.60. 9 are sent, so 3 to review: Alder's October
   (2 questions), Birch's October (1), Cedar's October (clean). Start with Alder?"

**Resuming.** "Pick up where we left off" means starting with the first invoice, in
the snapshot's order, whose Ready/Sent? status is still empty. When a client has two
invoices, the status is kept per invoice ("Sep: Sent · Oct: Reviewed 11/14").

## 3. One invoice at a time

Show one card, then stop and wait for her.

> **Alder — October (#2277) · $612.40** · last invoice $498.00 · 6-mo avg $476.10 (Apr 25 – Oct 24)
>
> | Line | Qty | Amount |
> |---|---|---|
> | Moved large planters onto deck and planted with evergreens, … | 5.75 × $55 | $316.25 |
> | Planning planter update (Oct). | 0.5 × $80 | $40.00 |
> | Plants: heather (3), boxwood (1), … | 1 | $237.65 |
> | Potting soil and mycorrhizal soak for planters. | 1 | $18.50 |
> | **Total** | | **$612.40** |
>
> Oct 13: 5:01 on site + 44 min drive (day's drive 62, shared with Birch) → 5.75 hrs
>
> 1. ⚠️ Oct 13 has no End Time; I used the Hours Adjustments times (crew member B to 3:06).
> 2. ❓ Potting soil: bill your 1.5× upcharge ($13.50) or cost ($9)? Default $13.50.
> 3. Wording OK, or change anything?

- **Header:** the client, the work it covers, and the invoice number in brackets. Give
  the total, the previous invoice, and the 6-month average with its window.
- **Lines** with full descriptions. Shorten only plant lists.
- **Hours:** one line per visit with on-site time, drive and rounding. Give the full
  per-source Hours table only when she asks ("show the math"). It's also in the log.
- **Numbered items**, at most about five:
  - ⚠️ for a flag that's informational;
  - ❓ for a decision, with your default and what each option costs.

  Follow the rules doc's flagging rules. Don't raise what she's said not to flag, such
  as unchecked tasks and Next/later items.
- **Last item:** always ask whether the wording is OK. Most of her past corrections
  were wording changes made by hand in QuickBooks, so fixing it here saves a step.
- For an invoice with no questions, say so: "Nothing to decide. Approve as is?"

## 4. Handling her answers

She'll answer in shorthand: "1 fine 2 cost 3 say 'leaf clean up' at the end". Match
each answer to its item. Anything she didn't answer stays open. Don't assume your
default. If she approves ("looks good") while a ❓ is still unanswered, confirm in one
line: "Default on 2 ($13.50)?"

- **A decision or rewording:**
  1. **Re-read the invoice and compare it with the snapshot.**
     - If it's now sent or paid, stop and tell her; don't edit it.
     - If anything differs that you didn't write, it's her hand edit. Build the
       update from the fresh read, not from the card, and mention the edit.
  2. **Update it with every line.** Use the line ids from the re-read and her current
     wording. Take each line's service date from the snapshot page (`null` only for
     design and project-management lines). A line update replaces every line, so a
     missing date or line gets wiped.
  3. **Re-read it, then record it.** Rewrite that invoice on the snapshot page, and
     update its Read time, before doing anything else. Otherwise the next catch-up
     would mistake your change for her hand edit.
  4. **Show the result** as old → new: "Alder's October invoice: $612.40 → $607.90
     (potting soil at cost)." Answer anything else on the card in the same message.
- **"I fixed the Notion entry" / "rerun":** re-fetch that entry and the same-day
  entries for the same crew. Recompute per `drafting.md`, then show the updated card.
- **A Notion fix she describes but hasn't made** ("her end time was 3:15"):
  - Offer to make it, quoting the exact change ("Set End Time on Alder Oct 13 to
    3:15?").
  - Edit her Work Log only after she says yes, one entry at a time.
- **A hand edit she's about to make in QuickBooks:** let her. Re-read the invoice
  afterwards before you change anything else on it.
- **A vague answer** ("bill some of it?"): ask one short follow-up with numbers. "Half
  is 25 min ($23), all is 45 min ($41). Which?"
- **A question or audit** ("was this billed before?"): answer it from QuickBooks and
  Notion, then come back to the card.
- **If you got something wrong, say so plainly**, fix it, and show the new numbers.

## 5. Rule or one-off?

Over 40% of her past feedback set a standing rule, so check every time she says how to
bill something. Ask when her answer:

- generalizes ("I always…", "in general", "from now on", "usually");
- or could plausibly apply to another client or visit.

Ask once and briefly: "Rule going forward, or just this time?" Skip the question when
she's already said which.

- **Rule:**
  - Write it to the rules doc **right away** (a session can end at any time). Put it in
    the right section with "(Andrea, <date>)". If it replaces an older rule, change
    that rule rather than adding a second one.
  - A client-specific fact goes in the client sheet instead, with who and when in
    `Source`.
  - Then check the unsent invoices in every batch that's still open. If the rule
    changes one, say how much and offer to apply it there too.
- **One-off:** apply it to this invoice only. Note it in the log section as a decision
  ("Andrea, Nov 14: potting soil at cost this time").
- **A wording pattern** (she rewrites a description the same way twice, or says "I
  always call it …"): add it to section 9 of the rules doc as a description lesson.

## 6. Finishing an invoice

When she approves ("looks good", "next"), do these before you show the next card. The
snapshot is already current from section 4.

1. **Log, in place:**
   - Update the client's section: the lines table, Hours, ticked flags and settled
     questions.
   - Show only the current numbers. Don't leave old figures, and don't add a
     Revisions entry per change.
2. **Status:**
   - Update the status table row and set Ready/Sent? to "Reviewed <date>", or to what
     she tells you ("ready, send 11/15").
   - When the client has two invoices, give each one its own status ("Sep: Sent · Oct:
     Reviewed 11/14").
   - Update the client heading's status suffix to match.
3. **Batch total,** if it changed, in the status table and on the snapshot.

This is the checkpoint. If the chat ends now, nothing is lost, and the next session
resumes at the next invoice with no status.

## 7. Ending (or pausing) the session

When the batch is done, or she stops:

1. **Summary in chat:**
   - invoices changed (old → new) and the new batch total;
   - rules added (one line each) and client facts added;
   - what's still open, and on whom;
   - which invoices are reviewed and ready to send.
2. **Log:** one dated Revisions bullet for the whole session ("Nov 14, review with
   Andrea: Alder's October invoice $612.40 → $607.90; 2 new rules; Birch still open"),
   so Kevin can see what happened. Add: "Kevin: rebuild the state file from the
   snapshot before restarting a watch on this batch."
3. **Always end with:** "Nothing was sent. Send them from QuickBooks when you're
   ready."

## 8. Talking to Andrea

- **She owns the business**, and her word is final. Kevin's rules give way to hers.
  Don't ask Kevin to confirm her decisions.
- **Plain words, short messages.** One invoice per message.
- **Name invoices by the work they cover,** with the number in brackets so she can
  find it in QuickBooks ("Birch's October invoice (#2280)").
- **Give money as dollars and old → new**, and minutes as minutes. Don't show
  QuickBooks ids or tool names.
- **Never send, even if she asks.** Explain that she sends from QuickBooks. You can
  mark the log's Ready/Sent? column when she says she has sent one.
- **No "🤖 Claude:" prefix in chat.** The prefix is only for Notion comments. If you
  do post a Notion comment, still start it with the prefix.
