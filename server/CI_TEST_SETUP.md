# CI Test Setup Guide

## Overview

This document explains how to handle test execution in CI environments where parallel execution can cause database conflicts.

## The Problem

When tests run in parallel in CI environments, they can interfere with each other's database state, leading to:

- **Foreign Key Constraint Violations**: Tests trying to reference records that were deleted by other tests
- **Race Conditions**: Multiple tests creating/updating the same data simultaneously
- **Inconsistent Test Results**: Tests passing locally but failing in CI

## The Solution

We use **sequential execution** for database tests to ensure test isolation and prevent conflicts.

### Configuration Files

1. **`jest.config.js`** - Local development (allows parallel execution)
2. **`jest.config.ci.js`** - CI environment (forces sequential execution)

### Key Differences

| Setting | Local | CI |
|---------|-------|----|
| `maxWorkers` | `1` | `1` |
| `maxConcurrency` | `1` | `1` |
| `testTimeout` | `10000ms` | `30000ms` |

## Usage

### Local Development
```bash
npm test                    # Uses jest.config.js
npm run test:billable-hours # Run specific test suite
```

### CI Environment
```bash
npm run test:ci            # Uses jest.config.ci.js
```

## CI Configuration

### GitHub Actions Example
```yaml
- name: Run tests
  run: npm run test:ci
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### Railway Example
```json
{
  "scripts": {
    "test": "npm run test:ci"
  }
}
```

## Test Isolation Strategy

### 1. Unique Test Data
Each test creates unique data using:
```typescript
const testId = `${Date.now()}_${testCounter}`;
const employeeId = `TEST_EMP_${testId}`;
```

### 2. Proper Cleanup Order
Tests clean up data in dependency order:
```typescript
// Foreign key tables first
await db.db.delete(workActivityEmployees);
await db.db.delete(workActivities);
// Base tables last
await db.db.delete(employees);
await db.db.delete(clients);
```

### 3. Sequential Execution
All tests run in sequence to prevent interference.

## Troubleshooting

### Common Issues

1. **Foreign Key Violations**
   - **Cause**: Tests running in parallel
   - **Solution**: Use `npm run test:ci`

2. **Timeout Errors**
   - **Cause**: Database operations taking too long
   - **Solution**: CI config has longer timeout (30s vs 10s)

3. **Inconsistent Results**
   - **Cause**: Race conditions between tests
   - **Solution**: Sequential execution prevents this

### Debug Commands

```bash
# Run with verbose output
npm run test:ci -- --verbose

# Run specific test file
npm run test:ci -- --testPathPattern="billableHours"

# Run with coverage
npm run test:ci -- --coverage
```

## Best Practices

1. **Always use `test:ci` in CI environments**
2. **Keep test data unique** using timestamps and counters
3. **Clean up in dependency order** (foreign keys first)
4. **Use explicit settings** in tests (e.g., disable rounding)
5. **Mock external services** to prevent API calls

## Migration from Parallel to Sequential

If you need to migrate existing CI configurations:

1. **Update test script**: Change `npm test` to `npm run test:ci`
2. **Update timeout**: Increase if needed (CI config has 30s)
3. **Verify isolation**: Ensure tests don't depend on each other

## Performance Considerations

- **Sequential execution is slower** but more reliable
- **CI tests take longer** but are more stable
- **Local development** can still use parallel execution for speed
- **Consider test splitting** for very large test suites

## Future Improvements

1. **Database Schema Isolation**: Use unique schemas per test worker
2. **Test Containers**: Isolate each test in its own database container
3. **Parallel Test Groups**: Group independent tests for parallel execution 