# Notion and QuickBooks gotchas

Learned the hard way while watching the 10-24 and 10-25 batches.

## Notion

- **Query Data Source allowance.** `notion-query-data-sources` in rows or SQL mode is
  metered per workspace. Two 5-minute watches polling entries exhausted it within an
  hour, and it then stayed out for the better part of an hour. View mode (a database
  view URL) is unmetered but can't filter. Run **one** rows query per entries check,
  and on `usage_limit_reached` skip the step, keep the watermark, and mention it once
  with the `[Try it free](...)` link from the error. Never retry in the same run.
- **Date filters:** `Last edited` (last_edited_time) only filters by DATE
  (`date_is_on_or_after` + `{"type":"exact","value":"2026-10-28"}`); a datetime value
  returns nothing. Compare the timestamps yourself. Params go inside `data`.
- **get_comments drops whole threads**, silently, including Andrea's replies to
  your questions (three were missed this way on 10-27). The page-wide call can even
  return nothing at all. Always reconcile against the discussion ids anchored in the
  page fetch (`watch.py threads`) and fetch the missing ones by `discussion_id`.
- **Comment authorship:** the connector is signed in as Andrea, so every comment
  shows as hers (`by-you="true"`). Yours are told apart only by the `🤖 Claude:`
  prefix. Start every reply with it.
- **Can't resolve or edit comments.** `notion-set-discussion-resolved` and
  `notion-update-comment` need a Business plan. Don't promise to resolve a thread;
  ask Andrea to click Resolve. To correct a reply, post a short follow-up.
- **Large pages:** the log page fetch (~60k chars) is saved to a tool-results file
  instead of returned. `watch.py` reads that file automatically.
- **notion-update-page:** `page_id`, `command: "update_content"` and
  `content_updates` are top-level params (not inside `data`). `old_str` must match
  the page's markdown exactly: dollar signs are `\$`, quotes inside spans are plain
  `"`, and a `\~` stays `\~`. A batch with one non-matching `old_str` returns a
  `no_match` warning for that one; check whether the others landed (grep the next
  fetch) before retrying.
- **Keep comment anchors.** Text wrapped in `<span discussion-urls="...">` carries
  Andrea's threads. When you rewrite it, change the words inside the span and leave
  the span tag, or the thread loses its anchor.
- **page_last_edited_at doesn't move for comments**, only for content edits.

## QuickBooks (qbo MCP)

- `qbo_sales_get_invoices` takes `doc_numbers` and returns lines with descriptions,
  qty, rate and amount. It does **not** return line service dates or addresses.
  Without `transaction_date` it only covers the last 180 days; for history use
  `customer_id` + `transaction_date: {"from_date", "to_date"}`.
- `qbo_sales_update_invoice` with `line_items` **replaces every line**. Send every
  line: existing ones with `"id": "<txnId>-<n>"`, new ones without an id, each with
  `product_id`, `quantity`, `amount` (= the rate), `description`, `service_date`
  (`null` for undated) and `taxable: false`. A line you leave out is deleted.
- `qbo_sales_create_invoice` shape:
  `customer_data: {customer_id, customer_email}`, `invoice_dates: {transaction_date}`,
  `line_items: {line_items: [...]}`. Descriptions over 100 chars need a
  `summarized_description`; the created invoice gets the short text, so follow up
  with an update that restores the full description.
- **Ship-to:** create auto-fills it from the customer. In the follow-up update send
  `shipping_address: ""`. The read-back can't confirm addresses, so ask Kevin to
  eyeball Ship-to on new invoices.
- Ids: invoice `djQuMToxOTM1MTQ4ODQ1NDM5NTk6ODAyNzFlZGQ4YQ:<txnId>`, product
  `djQuMToxOTM1MTQ4ODQ1NDM5NTk6MTEyZGU3NDY5OQ:<item>`, customer
  `djQuMToxOTM1MTQ4ODQ1NDM5NTk6OWQ2OTllOTYwOA:<n>`. Items: Specialized garden care 55,
  Design 72, Design and project management 68, Materials 19, Plants 116, Sluggo 21,
  Fertilizer 18, Debris disposal per bag 28, Irrigation service 119, Garden coaching 125.
- `qbo_contact_search_customer` takes `customer_name`.
- Never call `qbo_sales_get_transaction_document`, and never call anything that
  sends (send_invoice_reminder, send_payment_link, create_payment_link, ...).
