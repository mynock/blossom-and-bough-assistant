# Local Admin Interface Testing Guide

This guide explains how to test the admin interface locally in development mode.

## Prerequisites

Your local environment is already configured with:
- `NODE_ENV=development` in your `.env` file
- `DEV_BYPASS_AUTH=true` in your `.env` file

## Testing the Admin Interface

### 1. Start the Development Servers

Start both the backend and frontend servers:

```bash
# Terminal 1: Start backend server
cd server
npm run dev

# Terminal 2: Start frontend server
cd ..
npm start
```

### 2. Access the Admin Interface

1. Open your browser to `http://localhost:3000`
2. You'll be automatically logged in with a development user (no OAuth required)
3. Navigate to the Admin section using the navigation menu (Settings icon)
4. Or go directly to `http://localhost:3000/admin`

### 3. Development User

When `DEV_BYPASS_AUTH=true`, the system automatically creates a mock user:
- **ID**: `dev-user-123`
- **Email**: `dev@example.com`
- **Name**: `Development User`
- **Admin Access**: Automatically granted

### 4. Testing Features

You can safely test all admin operations in development mode:

#### Safe Operations (no confirmation required):
- **Database Status**: Check current database state
- **Import Employees**: Load employee data from Google Sheets
- **Import Clients**: Load client data from Google Sheets
- **Import All Basic Data**: Load both employees and clients
- **Run Migrations**: Apply database schema changes

#### Destructive Operations (confirmation required):
- **Clear Work Activities**: Removes work activities, assignments, and charges
- **Clear Projects & Work Data**: Removes all work data and projects
- **Clear ALL Data**: ⚠️ Removes everything from database

### 5. Database Operations

All operations work with your local PostgreSQL database. The admin interface will:
- Show real-time database status
- Display operation results with execution times
- Provide detailed error messages if operations fail
- Log all operations for debugging

### 6. Development Logging

Operations are logged to the console with detailed information:
- User information (development user details)
- Operation type and duration
- Success/failure status
- Any errors encountered

## Security Notes

### Development Mode Security
- Authentication is bypassed in development (`DEV_BYPASS_AUTH=true`)
- All users are automatically granted admin access
- Operations are logged with development user information

### Production vs Development
- In production, `DEV_BYPASS_AUTH` should be `false` or removed
- Real authentication and authorization will be enforced
- Only authorized users will have admin access

## Troubleshooting

### Admin Interface Not Loading
1. Verify environment variables:
   ```bash
   grep -E "(NODE_ENV|DEV_BYPASS_AUTH)" .env
   ```
2. Check that both servers are running
3. Verify you can access the main app at `http://localhost:3000`

### Admin Operations Failing
1. Check server console for error messages
2. Verify database connection
3. Ensure Google Sheets credentials are configured (for import operations)

### Authentication Issues
1. Confirm `DEV_BYPASS_AUTH=true` in `.env`
2. Restart the server after changing environment variables
3. Check server logs for auth bypass messages

## Next Steps

After testing locally, you can:
1. Deploy to production with proper authentication
2. Configure role-based access control
3. Set up proper admin user permissions
4. Monitor operations through production logging

## Database Safety

Remember that operations in development affect your local database:
- Use the "Clear" operations carefully
- Consider backing up important development data
- Import operations are additive (won't delete existing data)
- Status checks are read-only and completely safe 