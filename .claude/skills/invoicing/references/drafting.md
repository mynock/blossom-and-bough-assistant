# Drafting a client's invoice

This is the per-client procedure. **The billing and wording rules are not here.** They
live in the Notion rules doc, "Invoicing process — rules & checklist"
(40389559-0126-81e7-b0cb-d6952291951e), and per-client facts live in the client sheet
(see `SKILL.md`). Read both at the start of the session; the steps below say which
section of the doc applies. Client names here are made-up examples.

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
| Rules doc + comments | Notion page above | Every billing and wording rule, plus Andrea's open questions. |
| Client sheet | Google Sheets, tab `Clients` (id in `SKILL.md`) | Per-client design rate, typical drive, Sluggo, debris, held work and notes. |
| Work Log Entries | Notion `collection://21989559-0126-8004-bde3-000beb480c07` | Visits: Date, Team Members, Start/End Time, Travel Time, Break Minutes. Page body: Tasks, Notes, Hours Adjustments, Materials/Fees, Plant List. |
| Work 2 calendar | `03d3294def591d2c74c176798be55099aa7ddef3ec990b7ece012dd69028dc8a@group.calendar.google.com` | Design, research, comms, coaching, short visits missing from Notion. Untitled events, and titled ones with minutes ("Alder (5)", "Birch email (20)"). |
| Work calendar | `cpt5gfbgisp2h3pgu86st5pk4s@group.calendar.google.com` | Crew visit blocks: a cross-check for visits missing from Notion. |
| Employees calendar | `4b5afe050f239543b653923689454ff83ad3e448671f9d66cd4f2194bd02e560@group.calendar.google.com` | "solo" next to a name means that person worked elsewhere, so their drive isn't pooled. |
| QuickBooks | qbo MCP | The client's past invoices (coverage, rates, Sluggo habit, typical totals). |

Read the **whole entry page**, not just its properties: adjustments, owed time, "bill X"
notes, materials and plant prices live in the body. Notion's query allowance is small,
so use one query to find the client's entries in the date range, and another for all
entries on the visit dates (needed for the drive split). Fetch pages directly after
that.

## 2. Find what to bill

Rules: doc section 2.

1. Find the **last billed visit** by matching the client's recent invoice lines to
   Notion visits by tasks and hours.
2. Set the **range**: the day after it through today, or Kevin's cutoff. Split by
   calendar month, and check the client sheet for work Andrea asked to hold.
3. Collect the client's Notion entries, scan Work 2 for the client's name, and
   cross-check the Work calendar's blocks against the entries.
4. List what you're leaving out (unchecked tasks, admin, untimed events) for the flags.
5. Check the previous batch's snapshot page for **held for later** work.

## 3. Hours for each visit

Rules: doc sections 3 (hours and drive) and 4 (rounding and the Hours table).

1. **Onsite** from the entry and its Hours Adjustments, with the crew size checked
   against the notes.
2. **Drive:** fetch every same-day entry for the same crew, add up their Travel Time and
   split it by onsite share. Compare the result with the client's typical drive in the
   sheet, and apply the doc's adjustments (three-person crews, Andrea's notes, owed time).
3. **Round** the visit and put all rounding into drive.
4. Write the Hours block as the log layout in `log-and-snapshot.md` shows, one row per
   source.

## 4. Other lines

Rules: doc sections 5 (design, research, coaching) and 6 (materials and plants). Item
ids are in `tool-notes.md`; the design rate is $80/hr unless the client sheet gives one.

- Design and project management lines from Work 2, undated unless a site visit.
- Research and comms folded into maintenance, or their own line when over 30 minutes.
- Coaching, plants, materials, Sluggo and debris from the entry's tables, checked
  against the client sheet's habits (usual Sluggo, usual debris bag).
- Replacement plants as $0 Plants lines dated the planting visit; check the sheet for
  replacements still owed.

## 5. Flags and questions

Rules: the "flag" items throughout doc sections 2–6. Flag in the client's log section,
saying what you assumed: blank key fields, approximate times, drive outside the
client's norm (from the sheet), three-person-crew trims, missing entries, Sluggo or
debris, design inside a maintenance visit, mismatches, and unpaid previous invoices
(named by the work they cover; no reminder questions).

**Questions** are for anything you didn't bill or chose between: wavering notes, a plant
with no price, an unclear range. Give the cost of each option.

## 6. Descriptions

Rules: doc section 9, including the "More lessons from Andrea's edits" toggle. Lines
over 100 characters need a `summarized_description` at create time; restore the full
text with an update.

## 7. Gut check

Compare each visit's hours and the invoice total with the client's previous invoice
and with the average over the last 6 months (state the window and exclude the new
invoice). Flag outliers with the likely reason, such as a project day or a big plant
order.

## 8. Create the invoice

Rules: doc section 8. Call shapes and ids: `tool-notes.md`.

1. `qbo_sales_create_invoice`, dated today, Net 30. Every line is non-taxable and
   carries its service date (design and PM lines are undated).
2. Straight after, `qbo_sales_update_invoice` with every line (ids `<txnId>-<n>`) and
   full descriptions, plus `shipping_address: ""`.
   - Bill-to is name + street + "City, ST  ZIP", the text QuickBooks auto-puts in Ship-to.
   - Neither address shows in the read-back, so ask Kevin to check them in QuickBooks.
3. Re-read the invoice, confirm the lines and total, and save it to the state file with
   its service dates.
