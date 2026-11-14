# Reviewing a batch with Andrea in chat

Andrea opens a chat and goes through a drafted batch invoice by invoice. She answers
questions, fixes things and approves each invoice as she goes. Claude updates
QuickBooks and the Notion pages right away. This replaces the comment-and-watch loop in
`watch.md`. Client names here are made-up examples.

She may be in her own Claude, without Kevin's machine. Don't rely on the local state
file, `watch.py` or cron jobs. The Notion log and snapshot pages hold everything you
need. If a state file is there, keep it up to date as well.

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

- **No watch at the same time.** If a watch is running on this batch, it has to be
  stopped first, or two Claudes will edit the same invoices. If you can't tell, ask
  her whether Kevin has stopped it.
- **Connectors she needs:** Notion, QuickBooks and Google Sheets (the client sheet).
  Google Calendar is needed only to recompute visits from the Work 2 calendar. If one
  is missing, say which, and work with what you have.
- Read `tool-notes.md`. The QuickBooks quirks (full line replacement, Ship-to) apply
  here unchanged.

## 2. Opening the session

She'll say something like "let's review the November invoices" or "go through
Birch's invoice".

1. **Find the batch.** Use the log she names. Otherwise, use the newest
   "YYYY-MM-DD — Invoice log" under "Invoicing"
   (40389559-0126-8122-94b2-fee44c2c1328), and confirm it with her in one line.
2. **Read, in parallel:**
   - the rules doc and its open comments;
   - the client sheet;
   - the log page;
   - the snapshot page;
   - `qbo_sales_get_invoices` for every invoice in the log's status table.
3. **Catch up on what changed since the last write.**
   - Compare QuickBooks with the snapshot. Hand edits are hers, so keep them, record
     them on the snapshot page, and mention them in the opening summary.
   - Run one Work Log Entries query for entries edited since the snapshot's "Read"
     time, and keep the batch's clients and dates. Recompute anything that changed
     before you show that invoice.
   - Pick up any comment threads still waiting on her. An answer she gave in a comment
     counts.
4. **Give the opening summary:**
   - how many invoices there are and the batch total;
   - which are already sent (skip those, and never edit them);
   - which have questions;
   - anything that changed since the draft.

   Then suggest an order: invoices with questions first, clean ones last.
   Example: "12 invoices, $3,912.60. 9 are sent, so 3 to review: Alder's October
   (2 questions), Birch's October (1), Cedar's October (clean). Start with Alder?"

**Resuming.** "Pick up where we left off" means starting with the first invoice whose
status isn't "Reviewed" yet (see section 6).

## 3. One invoice at a time

Show one card, then stop and wait for her.

> **Alder — October · $612.40** · last invoice $498.00 · 6-mo avg $476.10 (Apr 25 – Oct 24)
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

- **Header:** the client and the work it covers, never the invoice number alone. Give
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
default.

- **A decision or rewording:**
  1. Re-read the invoice.
  2. Update it with every line, keeping her wording.
  3. Re-read it and show the result as old → new: "Alder's October invoice: $612.40 →
     $607.90 (potting soil at cost)."
  4. Answer anything else on the card in the same message.
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
  - Then check the other unsent invoices in the batch. If the rule changes one, say how
    much and offer to apply it there too.
- **One-off:** apply it to this invoice only. Note it in the log section as a decision
  ("Andrea, Nov 14: potting soil at cost this time").
- **A wording pattern** (she rewrites a description the same way twice, or says "I
  always call it …"): add it to section 9 of the rules doc as a description lesson.

## 6. Finishing an invoice

When she approves ("looks good", "next"), do these before you show the next card:

1. **Log:**
   - Update the client's section in place: lines table, Hours, flags (ticked), and
     settled questions. Show only the current numbers. Don't leave old figures or add a
     Revisions entry per change.
   - Update the status table row.
   - Set **Ready/Sent?** to "Reviewed <date>", or to what she tells you ("ready, send
     11/15").
2. **Snapshot:** her approved lines and total, plus any hand edits under **Andrea's
   edits**.
3. **Batch total**, if it changed.

This is the checkpoint. If the chat ends now, nothing is lost, and the next session
resumes at the next unreviewed invoice.

## 7. Ending (or pausing) the session

When the batch is done, or she stops:

1. **Summary in chat:**
   - invoices changed (old → new) and the new batch total;
   - rules added (one line each) and client facts added;
   - what's still open, and on whom;
   - which invoices are reviewed and ready to send.
2. **Log:** one dated Revisions bullet for the whole session ("Nov 14, review with
   Andrea: Alder's October invoice $612.40 → $607.90; 2 new rules; Birch still open"),
   so Kevin can see what happened.
3. **Always end with:** "Nothing was sent. Send them from QuickBooks when you're
   ready."

## 8. Talking to Andrea

- **She owns the business**, and her word is final. Kevin's rules give way to hers.
  Don't ask Kevin to confirm her decisions.
- **Plain words, short messages.** One invoice per message.
- **Name invoices by the work they cover** ("Birch's October invoice").
- **Give money as dollars and old → new**, and minutes as minutes. Don't use ids,
  transaction numbers or tool names.
- **Never send, even if she asks.** Explain that she sends from QuickBooks. You can
  mark the log's Ready/Sent? column when she says she has sent one.
- **No "🤖 Claude:" prefix in chat.** The prefix is only for Notion comments. If you
  do post a Notion comment, still start it with the prefix.
