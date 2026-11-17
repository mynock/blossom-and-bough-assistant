# Working through a batch with Andrea in chat

Andrea goes through the batch one draft at a time. For each one, Claude shows what it
gathered and computed, she revises it, and Claude creates the invoice in QuickBooks
only when she approves. Client names and amounts here are made-up examples.

She may be in her own Claude, without Kevin's machine. Don't rely on the local state
file, `watch.py` or cron jobs. The Notion log holds the drafts, and the snapshot holds
what was written to QuickBooks, including the line service dates QuickBooks doesn't
return. If a state file is there, keep it up to date as well.

## Contents

1. Before you start
2. Opening the session
3. The draft card
4. Revising a draft
5. Rule or one-off?
6. Approval: creating the invoice
7. Changing an invoice that's already created
8. Ending (or pausing) the session
9. Talking to Andrea

## 1. Before you start

- **No watch at the same time.** A watch and a chat session editing the same batch
  will overwrite each other. Treat a watch or Kevin's session as live if either of
  these happened in the last 30 minutes:
  - a "🤖 Claude:" comment appeared on the log;
  - the log was edited, and the edit isn't one Andrea describes as hers.

  A log edit doesn't count if it's covered by a Revisions bullet "Drafts prepared
  <time>; no watch running". That's how a prep session (Kevin preparing drafts ahead)
  signs off.

  If it looks live, ask her to have Kevin stop it, and don't edit anything until he
  has. Her Claude can't stop Kevin's jobs.
- **Connectors she needs:** Notion, QuickBooks, Google Sheets (the client sheet), and
  Google Calendar (the Work and Work 2 calendars). If one is missing, say which, and
  work with what you have. Without the calendars, flag every draft as "calendars not
  checked".
- Read `tool-notes.md`. The QuickBooks quirks (full line replacement, no service dates
  in read-backs, Ship-to) and the Notion query limit apply here unchanged.

## 2. Opening the session

She'll say something like "let's do the November invoices", "bill Alder and Birch",
or "pick up where we left off".

1. **New batch or existing one?**
   - **New:** set it up per `SKILL.md` section 1, then prepare the first draft.
   - **Existing:** use the log she names. Batches are named by creation date, but she'll
     usually name the month of work ("the October invoices"); match it to the batch
     that covers that month. If nothing is named, use the newest log under
     "Invoicing" (40389559-0126-8122-94b2-fee44c2c1328).

   Either way, confirm the batch with her in one line.
2. **Read, in parallel:**
   - the rules doc and its open comments;
   - the client sheet;
   - the log page;
   - the snapshot page.

   For an existing batch, the log's client sections show which invoices are still
   drafts and which are created. A client can have two (September and October).
   Read the created ones from QuickBooks (`qbo_sales_get_invoices`).
3. **Catch up on what changed since the last write.**
   - **Drafts.** Each draft has a "Prepared <time>" stamp. Run **one** rows query on
     Work Log Entries:
     - filter `Last edited` on or after the oldest stamp's date;
     - sort by `Last edited`, descending;
     - limit 50. If all 50 come back, say the check may be incomplete;
     - the filter is date-only, so compare the times yourself (`tool-notes.md`).

     Keep entries for the drafts' clients and dates. A same-day entry for another
     client can change the drive split.
     - Also re-scan the Work 2 calendar for the drafts' clients since their stamps.
     - Check the rules doc and client sheet for anything changed since then.
     - Recompute the affected drafts, and re-stamp them.
     - On `usage_limit_reached`, tell her the entries weren't re-checked and carry on.
       Don't retry.
     - A newly logged visit for a draft's client goes on that month's draft. Mention it
       on the card.
   - **Created invoices.** Compare QuickBooks with the snapshot. Hand edits are hers:
     keep them, record them under **Andrea's edits** on the snapshot, and mention them.
     QuickBooks doesn't show service dates, so a date she changed there can't be seen.
     Use hers if she mentions one.
   - **Comments.** Collect every `discussion-urls` id from the log fetch and fetch each
     thread by `discussion_id`. The page-wide call drops threads. A thread whose last
     comment doesn't start with "🤖 Claude:" may hold her answer to a draft's question,
     and that answer counts.
4. **Give the opening summary:**
   - how many drafts are waiting and how many invoices are already created;
   - which created invoices are sent or paid (skip those);
   - anything that changed since the drafts were prepared.

   Suggest starting with the first draft. Example: "5 drafts to go through (Alder
   October, Birch, Cedar, Dogwood, Elm). 2 are already created and unsent. Start with
   Alder?"

**Resuming.**
- "Pick up where we left off" means starting with the first draft, in log order, that
  isn't created or held.
- A draft marked "Creating #NNNN" was interrupted mid-create. Finish it per section 6,
  step 1, before anything else.
- List any held drafts in the opening summary, but don't show them unless she asks.

## 3. The draft card

Show one card, then stop and wait for her.

> **Alder — October · draft $612.40** · last invoice $498.00 · 6-mo avg $476.10 (Apr 25 – Oct 24)
>
> | Line | Date | Qty | Amount |
> |---|---|---|---|
> | Moved large planters onto deck and planted with evergreens, … | Oct 13 | 5.75 × $55 | $316.25 |
> | Planning planter update (Oct). | — | 0.5 × $80 | $40.00 |
> | Plants: heather (3), boxwood (1), … | Oct 13 | 1 | $237.65 |
> | Potting soil and mycorrhizal soak for planters. | Oct 13 | 1 | $18.50 |
> | **Total** | | | **$612.40** |
>
> Oct 13: 5:01 on site + 44 min drive (day's drive 62, shared with Birch) → 5.75 hrs
>
> 1. ⚠️ Oct 13 has no End Time; I used the Hours Adjustments times (crew member B to 3:06).
> 2. ❓ Potting soil: bill your 1.5× upcharge ($13.50) or cost ($9)? Default $13.50.
> 3. Wording OK, or change anything?
> 4. Create it in QuickBooks as shown?

- **Header:** the client and the work it covers, marked "draft". Give the total, the
  previous invoice, and the 6-month average with its window.
- **Lines** with service dates and full descriptions. Shorten only plant lists.
- **Hours:** one line per visit with on-site time, drive and rounding. Give the full
  per-source Hours table only when she asks ("show the math"). It's also in the log.
- **Numbered items**, at most about five plus the last two:
  - ⚠️ for a flag that's informational;
  - ❓ for a decision, with your default and what each option costs.

  Follow the rules doc's flagging rules. Don't raise what she's said not to flag, such
  as unchecked tasks and Next/later items.
- **The last two items are always there:** whether the wording is OK, and whether to
  create the invoice. Most of her past corrections were wording changes, so ask before
  the invoice exists.
- A draft with nothing to decide still gets the last two items: "Nothing to decide.
  Wording OK? Create it as shown?"

## 4. Revising a draft

She'll answer in shorthand: "1 fine 2 cost 3 say 'leaf clean up' at the end". Match
each answer to its item. Anything she didn't answer stays open. Don't assume your
default.

The draft isn't in QuickBooks yet, so revising only changes the draft:

1. **Apply her answers** to the lines, Hours and flags.
2. **Save the draft** to the log section in place, keeping only the current numbers.
3. **Show what changed** as old → new: "Alder's October draft: $612.40 → $607.90
   (potting soil at cost)." If more than a line changed, show the updated card.

How to handle particular answers:

- **"I fixed the Notion entry" / "rerun":** re-fetch that entry and the same-day
  entries for the same crew, recompute per `drafting.md`, and show the updated card.
- **A Notion fix she describes but hasn't made** ("her end time was 3:15"): offer to
  make it, quoting the exact change ("Set End Time on Alder Oct 13 to 3:15?"). Edit her
  Work Log only after she says yes, one entry at a time.
- **A vague answer** ("bill some of it?"): ask one short follow-up with numbers. "Half
  is 25 min ($23), all is 45 min ($41). Which?"
- **"Hold it" / "skip this one":** leave it as a draft marked "held: <her reason>",
  and add it to the snapshot's **Held for later** with her reason, so the next batch
  finds it. Then move on.
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
  - Then check the other drafts, and the unsent invoices in every batch that's still
    open. If the rule changes one, say how much and offer to apply it there too.
- **One-off:** apply it to this draft only. Note it in the log section as a decision
  ("Andrea, Nov 14: potting soil at cost this time").
- **A wording pattern** (she rewrites a description the same way twice, or says "I
  always call it …"): add it to section 9 of the rules doc as a description lesson.

## 6. Approval: creating the invoice

**What counts as approval:**

- **What counts:** a clear yes to "Create it in QuickBooks?" for this draft, in this
  chat ("yes", "create it", "looks good, go ahead").
- **What doesn't count:** "looks good" said before every ❓ is answered. Confirm the
  defaults first ("Default on 2 ($13.50), then create?").
- **A yes covers only the draft as you last showed it.** If it's recomputed or changed
  after that, show it again and ask again.
- **Several at once:** she can approve more than one ("create the rest as shown"), but
  only drafts she has seen as cards in this session, with every ❓ answered. Create
  them one at a time, in order.

**Then:**

1. **Check for a duplicate.**
   - Run `qbo_sales_get_invoices` with the client's `customer_id` and a
     `transaction_date` range starting at their last billed invoice's date.
   - Match invoices to this draft by line amounts and descriptions. QuickBooks doesn't
     return service dates.
   - If the match is the invoice this draft's own "Creating #NNNN" marker points to, an
     earlier create was interrupted. Finish it from step 3 on, and don't create
     another.
   - If someone else made it, stop and show it to her.
2. **Create it** per `drafting.md` section 8:
   - dated today, Net 30, every line non-taxable with its service date (design and
     project-management lines undated);
   - **right after the create**, put "Creating #NNNN <time>" on the draft's log section,
     so an interrupted session can tell the invoice exists;
   - then an update with every line's full description and `shipping_address: ""`.
3. **Re-read and check it against the approved draft.** Compare the line count, each
   quantity, rate and amount, the descriptions and the total.
   - If something differs, fix it with an update (re-read first).
   - If you can't fix it, tell her exactly what's different. Never delete, void or
     duplicate an invoice to start over.
4. **Record it before anything else:**
   - **Snapshot:** the invoice's lines with service dates, and the Read time.
   - **Log:** turn the draft section into the created invoice, replacing the "Creating"
     marker. Add the QuickBooks line
     (`[#NNNN](link) · created <date>, not sent`), update the status table row and the
     batch total, and update the client heading's status.
   - **State file,** if there is one.
5. **Tell her:** "Created Alder's October invoice (#1004), $607.90. It isn't sent.
   Check the Bill-to and Ship-to in QuickBooks before you send it." Then show the next
   draft.

## 7. Changing an invoice that's already created

When she wants to change an invoice that already exists (a new visit, a fixed entry, a
rewording):

1. **Re-read it and compare it with the snapshot.**
   - If it's sent or paid, stop and tell her; don't edit it. Offer to put the change
     on the client's next invoice instead.
   - If anything differs that you didn't write, it's her hand edit. Build the update
     from the fresh read and mention the edit.
2. **Update it with every line.** Use the line ids from the re-read and her current
   wording. Take each line's service date from the snapshot (`null` only for design
   and project-management lines). A line update replaces every line, so a missing date
   or line gets wiped.
3. **Re-read it, then record it.** Rewrite that invoice on the snapshot and update its
   Read time first, so the next catch-up doesn't mistake your change for hers. Then
   update the log in place, with no old numbers left behind.
4. **Show the result** as old → new.

## 8. Ending (or pausing) the session

When the batch is done, or she stops:

1. **Summary in chat:**
   - invoices created (with totals) and the batch total so far;
   - drafts still waiting, and drafts held (with her reason);
   - rules added (one line each) and client facts added;
   - what's still open, and on whom.
2. **Log:** one dated Revisions bullet for the whole session ("Nov 14, with Andrea:
   created Alder October $607.90 and Birch $250.00; Cedar held; 2 new rules"), so
   Kevin can see what happened. If any invoices were created or changed, add "Kevin:
   rebuild the state file from the snapshot before starting a watch on this batch."
3. **Always end with:** "Nothing was sent. Send them from QuickBooks when you're
   ready."

## 9. Talking to Andrea

- **She owns the business**, and her word is final. Kevin's rules give way to hers.
  Don't ask Kevin to confirm her decisions.
- **Plain words, short messages.** One draft per message.
- **Name invoices by the work they cover.** Once an invoice exists, add its number in
  brackets so she can find it in QuickBooks ("Birch's October invoice (#1003)").
- **Give money as dollars and old → new**, and minutes as minutes. Don't show
  QuickBooks ids or tool names.
- **Never send, even if she asks.** Explain that she sends from QuickBooks. You can
  mark the log's Ready/Sent? column when she says she has sent one.
- **No "🤖 Claude:" prefix in chat.** The prefix is only for Notion comments. If you
  do post a Notion comment, still start it with the prefix.
