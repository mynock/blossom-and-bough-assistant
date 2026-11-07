# Drafting a client's invoice

This is the per-client procedure, with the billing rules as of 2026-11-07. The
Notion rules doc (40389559-0126-81e7-b0cb-d6952291951e) is authoritative and Andrea
edits it. If anything here disagrees with it, follow the doc and update this file.
Wording rules for line descriptions are in memory's `feedback_invoice_descriptions.md`;
read it before writing descriptions. Client-specific numbers and habits (design
rates, typical drive, Sluggo, debris, held work) are in the client sheet named in
`SKILL.md`; client names below are made-up examples.

## Contents

1. Sources
2. Find what to bill
3. Hours for each visit
4. Other lines
5. Flags and questions
6. Descriptions
7. Gut check
8. Create the invoice

## 1. Sources

| Source | Where | Used for |
|---|---|---|
| Work Log Entries | Notion `collection://21989559-0126-8004-bde3-000beb480c07` | Visits: Date, Team Members, Start/End Time, Travel Time, Break Minutes. Page body: Tasks, Notes, Hours Adjustments, Materials/Fees, Plant List. |
| Work 2 calendar | `03d3294def591d2c74c176798be55099aa7ddef3ec990b7ece012dd69028dc8a@group.calendar.google.com` | Design, research, comms, coaching, short visits missing from Notion. Untitled events, and titled ones with minutes ("Alder (5)", "Birch email (20)"). |
| Work calendar | `cpt5gfbgisp2h3pgu86st5pk4s@group.calendar.google.com` | Crew visit blocks: a cross-check for visits missing from Notion. |
| Employees calendar | `4b5afe050f239543b653923689454ff83ad3e448671f9d66cd4f2194bd02e560@group.calendar.google.com` | "solo" next to a name means that person worked elsewhere, so their drive isn't pooled. |
| Client sheet | Google Sheets, tab `Clients` (id in `SKILL.md`) | Per-client design rate, typical drive, Sluggo, debris and billing notes. |
| QuickBooks | qbo MCP | The client's past invoices (coverage, rates, Sluggo habit, typical totals). |
| Rules doc + comments | Notion | Current rules and open questions. |

Read the **whole entry page**, not just its properties: adjustments, owed time, "bill X"
notes, materials and plant prices live in the body. Notion's query allowance is small,
so use one query to find the client's entries in the date range, and another for all
entries on the visit dates (needed for the drive split). Fetch pages directly after
that.

## 2. Find what to bill

- **Last billed visit:** match the client's recent invoice lines to Notion visits by
  tasks and hours. An invoice's date isn't the date its work ends.
- **Range:** from the day after the last billed visit through today, or Kevin's cutoff.
- **By calendar month:** monthly maintenance clients get one invoice per month (1st to
  the last day). A later month's work goes on its own invoice, created now from the
  data on hand, unless Andrea said to hold that client (check the client sheet's notes).
  The exceptions are clients who aren't visited monthly and have short related visits
  close together (the client sheet notes which).
- **Work calendar cross-check:** list the client's Work blocks in the range and match
  them to Notion entries by date. A block with no entry, or an entry missing times or
  tasks, is flagged as a **possibly missing entry** and isn't billed from the calendar
  alone. Don't list Work blocks in the Hours tables; Notion trumps the calendar.
- **Work 2:** scan for the client's name, not just untitled events. Billable work
  missing from Notion (coaching, short irrigation visits) gets asked about. For those
  visits Andrea writes the drive minutes in the event; use them.
- **Leave out:** unchecked tasks, admin (scheduling, invoicing, to-dos), and titled
  events with no time. Flag them so they can be added by hand.
- **Plant pickup runs** naming the client: ask whether to bill the pickup time.
  Don't bill it by default.

## 3. Hours for each visit

- **Onsite** = (end − start) × crew size, then apply the Hours Adjustments table per
  person. The amount may be in the Adjustment or the Notes column ("9:10 start",
  "Til 12:35", "On site 9:50-11:50").
- **Crew size** comes from Team Members, but check it against the notes ("x2"). Trust
  clear notes, and flag the mismatch.
- **Break Minutes and Travel Time are visit totals**, never per person. Subtract the
  break once; don't multiply drive by crew size. If blank, look in the notes. Breaks
  aren't billed outright, but Andrea lets them bump the drive a little (the client
  sheet notes where she has said how much is fine).
- **Drive:** add up the day's Travel Time across that crew's visits and split it by
  each visit's share of onsite time. Pool only the same crew (see the Employees
  calendar). Make sure every same-day entry has its Travel Time logged first.
  - Bill the weighted share as calculated. **Don't cap it**: if it's high or low for the
    client, flag it (Andrea, Oct 27; this replaced Kevin's 10% cap).
  - Andrea's own notes win: "absorb the routing extra", "bill 4.5 inc 35 min drive",
    "24 min drive".
  - If no drive is logged at all, estimate from the client's typical drive and flag it.
  - **Use the pooled share even when it's above the entry's own Travel Time**
    (Andrea, 2026-11-06): it covers a bit of lunch and matches past billing. Round as
    usual.
  - **Three-person crews** (Andrea, 2026-11-06): with three people on the job the
    pooled drive goes up, and she generally doesn't want the client billed more for
    it. Trim the weighted drive a little (e.g. take the round-down at a halfway point,
    or bill nearer the client's usual drive) and flag it with both figures. If the
    share is already within the client's usual range, leave it and flag it.
  - Typical drive per client is in the client sheet (`Typical drive (min)`).
- **Owed time** from an earlier visit ("owed 25 min drive for 8/4", a mis-billed
  earlier invoice) goes into the next visit's hours as drive, not called out on the
  invoice.
- **Ranges** ("subtract 20-30 min", "-10 to 15"): use the middle and state the logic.
- **Andrea's "bill X" notes** on an entry win over the calculation. Show both.
- **Round** each visit to the quarter hour. Round up when within 2 minutes of the
  halfway point (322 min vs a 322.5 halfway → 5.5 hrs). An onsite visit bills at least
  1 hour. Maintenance minutes are never rounded: all rounding, up or down, goes into
  the drive figure, and so does a top-up to the 1-hour minimum.
- **Off-site time folded into the visit** (notes, a remote walk-through, research,
  comms, plant or supply pickup) is part of the maintenance line, but it's named
  separately in the log heading.

## 4. Other lines

- **Design** ($80/hr unless the client sheet gives the client's own rate; check past invoices for clients not in it):
  real design, planning or plant plans, roughly half an hour or more. Plant order prep
  counts as design. Use the Design item (72) unless project management is mentioned
  (contractor liaison, coordinating), then use Design and project management (68).
  Design and PM lines get **no service date** unless they were a site visit; add
  "(Sep)" to the description when useful. Design time inside a maintenance visit gets
  flagged; Andrea usually splits it out ("separate out .5 as design time").
- **Small research and comms** (pest research, maintenance emails): fold into
  maintenance at the visit rate, and name them in the description ("mole research").
  Over 30 minutes in total, they get their own Specialized garden care line
  ("garden communications"), dated the last of them.
- **Time shared between clients** ("Alder/Birch"): split it evenly.
- **Coaching** (item 125): $105 for the first hour, then $70/hr, quarter-hour rounded.
  Include some follow-up notes time. Other work in the same block (such as irrigation)
  goes on its own line, flagged.
- **Plants** (item 116): from the Plant List. Formulas like "3 x 5.76 x 2" or
  "$45 (upcharge x1.5)" are cost × markup: bill the product, unrounded. Re-read the
  Plant List right before pricing, because Andrea adjusts markups while reviewing.
  Describe plants as name (count): "Star jasmine (1)".
- **Replacement plants** for ones that died are no charge, but still get a line
  (Andrea, 2026-11-06): Plants item 116, qty 1 (or the count), rate $0, e.g.
  "Replacement heather (2), no charge.", dated the planting visit. Mentioning the
  replacement in the visit description is fine when the client already knows.
  Replacements promised but not planted yet stay in the client sheet's notes.
- **Materials** (item 19): at the listed prices. Combine small materials for one job
  on one line ("Potting soil and mycorrhizal soak for planters.").
- **Sluggo** (item 21, $8/unit): billed monthly on that month's invoice. A single
  visit in a month gets half the client's usual amount (see the client sheet). Flag a missing
  Sluggo for clients whose invoices usually have it, except Nov–Jan visits and entries
  marked "NO sluggo". An old "Aug & Sep" line is Andrea's every-other-month habit;
  leave it.
- **Debris disposal:** flag any mention of disposal; on-site disposal is no charge.
  Some clients almost always need a bag ($10, item 28) that Andrea forgets to log
  (client sheet, `Debris disposal`); flag their visits without one.
- **Credits owed to a client** (e.g. extra product used) don't go on the invoice:
  Andrea comps them on site. Leave her unchecked "Credit …" task as her reminder.

## 5. Flags and questions

Flag in the client's log section, saying what you assumed:

- **Blank key fields:** Start Time, End Time, Team Members or Travel Time. Don't flag a
  blank Break Minutes unless the notes mention a break. Don't flag a blank End Time when
  the Hours Adjustments give everyone's times.
- **Approximate times** ("4:35ish", "1:15?"). Her "drive/breaks" shorthand isn't
  approximate; don't flag it.
- **Drive** well above or below the client's norm, including owed drive.
- An unchecked **"Round up drive time"** task. Billing a bit of extra drive doesn't
  cover it; leave it for Andrea.
- **Missing entries** from the Work calendar cross-check, and missing Sluggo or debris.
- **Three-person crews:** the drive you trimmed, or why you left it.
- **Unpaid previous invoices**, named by the work they cover. Don't ask about
  reminders; Andrea sends those herself.
- **Design inside a maintenance visit**, and **mismatches** (crew size, an End Time vs
  an adjustment, an entry dated differently from its title).

**Questions** are for anything you didn't bill or chose between: wavering notes, a plant
with no price, an unclear range. Give the cost of each option.

## 6. Descriptions

Follow memory's `feedback_invoice_descriptions.md`. In short:

- **Shape:** one sentence of comma-separated tasks, usually 6–10, ending in a period.
- **Order:** routine work first (weeding, deadheading, perennial care), then notable
  jobs, then planting (in generic terms, since the Plants line names the plants), then
  clean up, with folded-in research last.
- **Leave out:** unchecked items, admin, qualifiers, names, judgment words, and anything
  that reads badly for the client ("removed dead yew").
- **Group:** deadheading into "deadheading (salvias, roses)", shrub trims into "light
  shaping", watering tasks together.

Lines over 100 characters need a `summarized_description` at create time; restore the
full text with an update.

## 7. Gut check

Compare each visit's hours and the invoice total with the client's previous invoice
and with the average over the last 6 months (state the window and exclude the new
invoice). Flag outliers with the likely reason, such as a project day or a big plant
order.

## 8. Create the invoice

1. `qbo_sales_create_invoice`, dated today, Net 30. Every line is non-taxable and
   carries its service date (design and PM lines are undated). See `tool-notes.md`
   for the call shape and ids.
2. Straight after, `qbo_sales_update_invoice` with every line (ids `<txnId>-<n>`) and
   full descriptions, plus `shipping_address: ""`.
   - Bill-to is name + street + "City, ST  ZIP", the text QuickBooks auto-puts in Ship-to.
   - Neither address shows in the read-back, so ask Kevin to check them in QuickBooks.
3. Re-read the invoice, confirm the lines and total, and save it to the state file with
   its service dates.
