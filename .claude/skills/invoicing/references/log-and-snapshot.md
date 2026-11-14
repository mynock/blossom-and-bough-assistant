# The batch's Notion pages

Each batch gets two pages under "Invoicing" (40389559-0126-8122-94b2-fee44c2c1328),
named by the date the invoices were created. Andrea reads the log to review; Kevin set
its format (Oct 25–26), and Andrea refined the Hours headings (Oct 27).

## Invoice log: "YYYY-MM-DD — Invoice log"

Keep it scannable. Current state goes in the client sections; history goes in
Revisions. Client names here are made-up examples.

**Name invoices by the work they cover** everywhere Andrea reads them (flags,
questions, Revisions, replies): "Alder's September invoice (#2272)", "the July–August
invoice (#2236)", never a bare number (Andrea, 2026-11-06).

### Header

One line linking the snapshot page and the rules doc.

### Status table

| Client | Invoice | Total | vs previous | vs 6-mo avg | Ready/Sent? |
|---|---|---|---|---|---|
| Alder | [#2272](…) | \$550.75 | +24% (\$444) | +7% (\$512.70) | Sent |
| Birch | [#2280](…) | \$260.00 | +18% (\$220) | — | Reviewed 11/14 |
| Cedar | — | — | — | No invoice: Oct 14 visit can't be priced yet | |
| **Total** | | **\$4,156.65** | | | |

- **Invoice links:** the invoice number is the QuickBooks link. Don't add a separate
  QuickBooks column (Andrea, Nov 10).
- **Ready/Sent?:** Andrea fills it in. A chat review sets it to "Reviewed <date>" when
  she approves an invoice (`review-chat.md`).
- **Client headings** end with the same status ("· ✅ Sent", "· ready, send 11/15",
  "· not sent yet") so she can skip finished clients. Update the headings when the
  column changes or QuickBooks shows an invoice paid.

Then a note: "6-month average = that client's invoices dated <from> – <to>, not
counting the new one", naming any special-project invoices left out as outliers
(rules doc section 7).

### Before sending

A checklist of decisions and actions only, such as "Check Bill-to / Ship-to in
QuickBooks", "Cedar Oct 14: fix the Notion entry", and "Answer the Questions under
each client".

### One section per client

```
## Alder — #2272 · $550.75
QuickBooks: [#2272 (Sep) ↗](link) · [#2277 (Oct) ↗](link)
Rate $55 · <mention of each visit page> · previous #2252 covered Aug 6 + Aug 25

| Line | Date | Qty | Rate | Amount |      ← the current lines; one table (with a Total row) per invoice, e.g. September and October
...
**Flags**        ⚠️ problems found, one checkbox each ("- [ ] ⚠️ …") so Andrea can tick them off: blank fields, unpaid invoices, mismatches, drive outside the norm
**Hours**        one block per visit (below)
**Assumptions**  judgment calls you made
**Questions**    things needing an answer, with the cost of each option ("None." if none)
```

**Hours block for each visit.** The bold heading gives the total, then drive and any
off-site time, then on-site maintenance:

> **Oct 1 → 7.0 hrs, including 62.5 min drive, 60 min plant pickup and 17.5 min off-site research (4:40 on-site maintenance)**
>
> **Oct 27 → 3.5 hrs, including 25 min drive (3:05 on-site maintenance), on #2277**

Below it is a table with **one row per source**, never two in one row:

| Source | What it shows | Maint. (min) | Drive (min) |
|---|---|---|---|
| Notion: @entry Oct 27 | 3:20–4:55 (Andrea, crew member B). B 95. Andrea: "Left 5:15 but also subtract 20-30 min for office work" → 115 − 25 = 90. Travel Time 12. | 185 | |
| Calculation | Day's drive 72 (12 here, Dogwood 60), split by onsite time 185:720. Below Alder's usual 30–40; a low share stands. | | 18.5 |
| Rounding | 203.5 min is past the halfway point (202.5), so it rounds up. | | +6.5 |
| **Total** | **210 min = 3.5 hrs** | **185** | **25** |

- **Rows:** each Notion entry, Work 2 event, Andrea comment, Kevin decision and
  calculation gets its own row. No Work calendar rows.
- **Same-day entries** used only for the drive split don't get rows. Name them in the
  Calculation row's parentheses after the day's drive (Andrea, Nov 10, trial rule).
- **Columns** add up to the Total row. All rounding goes in the Drive column.
- **Check line:** under the table, a "Check" line can quote Andrea's own "bill X" note
  when it agrees. If it disagrees, her note wins, and both are shown.
- **Design line:** a separate small block, e.g. "Sep 16 design → 1.0 hr ($75)".

**Held-over or not-yet-billable work** (a later month, a client Andrea is holding)
gets its own block in the client's section, marked "held for the October invoice",
with a total that isn't billed.

### Revisions (bottom of the page)

A "First draft vs now" table per client, then dated bullets with what changed and old
→ new amounts, e.g. "**Oct 28, new Notion entries:** Birch Sep 30 logged → new
invoice #2280 (\$260.00 …). Batch total \$4,156.65."

Small edits go in place, with no Revisions bullet each and no old numbers left in the
Hours or flags (rules doc section 10). A chat review adds one bullet per session
(`review-chat.md`, section 7).

### Comment anchors

Andrea's threads are anchored to text spans (`<span discussion-urls="…">…</span>`).
When you settle or reword anchored text, change the words inside the span and keep
the span: "Was the third euonymus charged? **Settled:** not billed yet; …". If a section
is rewritten, move anchored text into Revisions as "earlier calculations" rather than
deleting it.

## Invoice snapshot: "YYYY-MM-DD — Invoice snapshot"

Your latest version of every invoice, so changes made directly in QuickBooks can be
found by comparison. Linked from the log header.

```
Claude's last read of the batch's invoices… Read <date> <time> UTC. Entries checked <date> <time> UTC. Log: @log · Rules: @rules

## Snapshot
### #2272 Alder (Sep) · $550.75 · dated Oct 26
| Date | Item | Qty | Rate | Amount | Description |      ← full descriptions, service dates
...
**Total: $4,156.65** across 11 invoices (updated <date> <time> UTC). Service dates are
as Claude set them (the API doesn't return them).

## Andrea's edits
Found by comparing QuickBooks to Claude's last version. All kept.
| Invoice / line | Claude's version | Andrea's version |

## Held for later
- Cedar October (Andrea is filling in dates first): …

## Open questions
- …
```
