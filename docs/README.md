# Documentation

Technical documentation for the Blossom & Bough Scheduling Assistant.

## Reference

- [Billable Hours Calculation](./billable-hours-calculation.md) - Core formula, data flow, and troubleshooting
- [Reporting Needs](./reporting-needs.md) - Report requirements and filtering

## Setup Guides

- [Docker](./setup/docker.md) - Docker Compose setup, commands, and avoiding container rebuilds
- [CI/CD](./setup/ci-cd.md) - GitHub Actions workflows and branch protection
- [Local Admin Testing](./setup/local-admin-testing.md) - Testing the admin interface locally
- [iOS Debugging](./setup/ios-debugging.md) - Remote debugging web content on iOS devices
- [PostgreSQL Migration](./setup/postgresql-migration.md) - Migrating from SQLite to PostgreSQL

## Feature Documentation

- [Notion Integration](./features/notion-integration.md) - Smart entry creation, sync service, and task carryover
- [Notion Maintenance Cron](./features/notion-maintenance-cron.md) - Automated Notion entry creation from calendar
- [Notion iOS Fixes](./features/notion-ios-fixes.md) - iOS compatibility fixes for the Notion embed
- [Cron Setup](./features/cron-setup.md) - Internal cron job scheduling and configuration
- [Billable Hours Auto-Update](./features/billable-hours-auto-update.md) - Automatic recalculation when inputs change
- [Employee Detail](./features/employee-detail.md) - Employee detail page implementation
- [Force Sync](./features/force-sync.md) - Force sync feature for Notion integration
- [Other Charges](./features/other-charges.md) - Materials, services, and additional billing items
- [Work Activities Schema](./features/work-activities-schema.md) - Non-billable time and travel time schema updates

## Design Documents

- [POC PRD](./design/poc-prd.md) - Original proof-of-concept product requirements
- [Data Model](./design/data-model.md) - Entity definitions, relationships, and business rules
- [Notion Embed Instructions](./design/notion-embed-instructions.md) - Implementation instructions for Notion integration
- [Sample Notion Page](./design/sample-notion-page.md) - Example Notion page data format

## Other Documentation

- [Testing Suite](../server/README_TESTING.md) - Unit test architecture, coverage, and running tests
- [CI Test Setup](../server/CI_TEST_SETUP.md) - CI test configuration and database handling
- [Historical Import](../server/scripts/README-historical-import.md) - Historical data import scripts
- [Merge Duplicate Clients](../server/scripts/README-merge-duplicate-clients.md) - Client deduplication tool
