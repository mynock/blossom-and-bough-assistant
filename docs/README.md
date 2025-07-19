# Documentation

This directory contains technical documentation for the Blossom & Bough Scheduling Assistant.

## Documents

### [Billable Hours Calculation](./billable-hours-calculation.md)
Comprehensive documentation of how billable hours are calculated, modified, and updated throughout the system. This includes the core formula, when calculations occur, and all factors that influence billable hours.

**When to Update:** Whenever billable hours calculation logic changes, new factors are added, or integration points are modified.

## Document Standards

### Format
- Use Markdown (.md) format for all documentation
- Include "Last Updated" date and version number
- Add table of contents for longer documents
- Use clear headings and consistent structure

### Maintenance
- Update documentation immediately when related code changes
- Add entries to change logs with version numbers
- Reference specific file locations and line numbers where applicable
- Include troubleshooting sections for complex systems

### Content Guidelines
- Focus on "how" and "when" rather than just "what"
- Include code examples and formulas where relevant
- Document edge cases and important gotchas
- Provide clear data flow diagrams when helpful

## Contributing

When making changes to documented systems:

1. **Update the documentation first** - ensure accuracy before code changes
2. **Review for completeness** - check if other parts of the system are affected
3. **Update version numbers** - increment version and add change log entry
4. **Test examples** - verify any code examples or formulas are correct

## Future Documentation Needs

Consider adding documentation for:
- [ ] API endpoint specifications
- [ ] Database schema and migration patterns
- [ ] External service integrations (Google Calendar, Notion, etc.)
- [ ] Authentication and authorization flow
- [ ] Error handling and logging patterns
- [ ] Performance optimization guidelines