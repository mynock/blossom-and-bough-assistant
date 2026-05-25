---
layout: default
title: Privacy Policy
---

# Privacy Policy

**Effective date:** May 25, 2026

This Privacy Policy describes how Blossom and Bough ("we", "us", "our") collects, uses, and protects information in connection with the Blossom and Bough business management application (the "App").

## 1. Who this applies to

The App is an internal business management tool used by Blossom and Bough to operate its landscaping business. Authorized users are limited to the business owner and staff via an email allowlist. The App is not offered to the general public.

## 2. Information we collect

We collect and store the following categories of information in our own database to operate the App:

- **Business records you enter:** client profiles, employee profiles, work activities, projects, scheduling notes, and billing data.
- **Authentication data:** the Google account email of authorized users (via Google OAuth).
- **Data from connected services that you authorize:**
  - **Intuit QuickBooks Online** — customers, items, invoices, line items, and related accounting metadata necessary to create and reconcile invoices for work performed.
  - **Google Workspace** — calendar events, spreadsheet rows you import, and travel-time results from Google Maps.
  - **Notion** — pages and content you sync to or from Notion.
  - **Anthropic** — message content sent to the Claude API for AI-assisted scheduling and invoice drafting (see Section 6 for details, including which QuickBooks data may appear in prompts).
- **Operational data held by our sub-processors:** the App and its database are hosted on Railway (United States). All persistent data described above is stored on Railway's infrastructure.

## 3. How we use information

We use the information we collect only to operate the App for the business: scheduling work, tracking time and billing, drafting and syncing invoices to QuickBooks Online, syncing notes to and from Notion, and producing internal reports.

## 4. How we share information

We do not sell information. We share information only with the sub-processors and third-party services listed below, and only as necessary to deliver the features you use:

- **Intuit QuickBooks Online** — to read accounting data you authorize and to create or update invoices on your behalf.
- **Google** — for authentication (OAuth), calendar sync, and Maps/Sheets features.
- **Notion** — to read and write pages on your behalf.
- **Anthropic** — when AI features are used, the relevant prompt content is sent to the Claude API. Per Anthropic's commercial API terms, inputs and outputs are not used to train Anthropic's models.
- **Railway** — hosts the App's servers and PostgreSQL database (United States).

We may also disclose information if required by law or to protect the rights, property, or safety of Blossom and Bough or others.

## 5. QuickBooks Online data

When you connect the App to QuickBooks Online, we store the OAuth tokens necessary to call the QuickBooks Online API and a local copy of the accounting records you choose to sync (customers, items, invoices, line items) so the App can present and reconcile that data.

**Permitted uses.** We use QuickBooks Online data solely to provide the invoicing and reporting features described in Section 3, including drafting invoices, syncing line items, and reconciling local work activity records against QuickBooks invoices.

**Prohibited uses.** We do not use QuickBooks Online data for advertising, marketing, profiling, resale, training artificial intelligence or machine-learning models, or any purpose other than the features described in Section 3.

**Disclosure to Anthropic for AI-assisted features.** When you use AI-assisted invoice drafting, the App may include QuickBooks-derived content — specifically customer names, item names, and draft line-item descriptions and amounts — in the prompt sent to Anthropic's Claude API. Anthropic's commercial API terms prohibit using API inputs or outputs to train their models. No bulk export of QuickBooks data is sent to Anthropic; only the specific records relevant to the invoice being drafted.

**Retention and deletion.** Cached QuickBooks records are retained while the integration is active. Disconnecting the QuickBooks integration in the App's settings removes the stored OAuth tokens. Cached QuickBooks records will be deleted upon written request to the contact address below.

## 6. AI features and Anthropic

The App uses Anthropic's Claude API for two features: AI-assisted scheduling suggestions and AI-assisted invoice line-item drafting. When these features are used, the App sends the relevant business records — which may include client names, work activity descriptions, scheduling context, and (for invoice drafting) QuickBooks line-item content — to the Claude API. Per Anthropic's commercial API terms, API inputs and outputs are not used to train Anthropic's models. The App does not send QuickBooks data to Anthropic outside of these explicitly invoked features.

## 7. Data retention

We retain business records you enter for as long as the App is in use by the business. Cached records pulled from third-party integrations (QuickBooks Online, Google, Notion) are retained while the corresponding integration is active. Disconnecting an integration in the App's settings removes the stored OAuth tokens for that integration. You may request deletion of specific records, your OAuth connection, or your entire dataset by contacting us at the address below.

## 8. Data location

The App and its database are hosted on Railway in the United States. Data may be transmitted to the third-party services listed in Section 4, which may process it in other jurisdictions in accordance with their own terms.

## 9. Security

We use commercially reasonable measures to protect information, including encrypted transport (HTTPS), authentication-gated access via Google OAuth with an email allowlist, and access controls on the underlying database. OAuth tokens for connected services (such as QuickBooks Online) are encrypted at rest using AES-256-GCM. No system is completely secure; we cannot guarantee absolute security.

## 10. Intended users

The App is a business-to-business tool intended for use only by authorized adult employees and contractors of Blossom and Bough. The App is not directed to children, and we do not knowingly collect personal information from children.

## 11. Changes to this Policy

We may update this Policy from time to time. The "Effective date" above will reflect the most recent revision.

## 12. Contact

Questions about this Policy or requests to access or delete your information should be sent to **mynock51@gmail.com**.
