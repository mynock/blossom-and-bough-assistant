# Test Setup

The tests in this project are **integration tests** that require a real PostgreSQL database connection.

## Running Tests Locally

### Option 1: Using Docker (Recommended)
```bash
# Start test database, run tests, and clean up
npm run test:with-db

# Or manually:
npm run test:db:up    # Start PostgreSQL in Docker
npm test              # Run tests
npm run test:db:down  # Stop PostgreSQL
```

### Option 2: Using Local PostgreSQL
1. Install and start PostgreSQL locally
2. Create a test database with credentials:
   - User: `test_user`
   - Password: `test_password`
   - Database: `billable_hours_test`
3. Run tests: `npm test`

## CI/CD
Tests automatically run in GitHub Actions with a PostgreSQL service container.

## Test Structure
- **Integration tests**: Use real database connections
- **Mocked services**: External APIs (Google, Notion, Anthropic) are mocked
- **Database**: Real PostgreSQL database for testing business logic

## Environment Variables
Tests use:
- `DATABASE_URL=postgresql://test_user:test_password@localhost:5432/billable_hours_test`
- `NODE_ENV=test`