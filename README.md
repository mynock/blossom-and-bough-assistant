# Blossom & Bough Scheduling Assistant

## Billable Hours Regression Test Suite

**Requirements:** Node.js 22+ (due to `connect-session-sequelize` dependency)

This project now includes a focused regression test suite specifically for billable hours calculation - the core value proposition of the platform. These tests ensure that:

- **Core billable hours formula** works correctly with all input components
- **Auto-recalculation** triggers when any input field changes  
- **Rounding functionality** integrates properly with calculations
- **Cross-service consistency** ensures all services use the same formula

### Running Billable Hours Tests

```bash
# Run only the billable hours tests
cd server
npm run test:billable-hours

# Run tests with watch mode for development
npm run test:watch -- src/__tests__/billableHours

# Run all tests (requires database setup)
npm test
```

### CI/CD Integration

The billable hours test suite is integrated into GitHub Actions:

- **Main CI** (`ci.yml`) - Runs full test suite with PostgreSQL database on PR/push to main
- **Quick Tests** (`quick-test.yml`) - Fast compilation checks only (no database tests)
- **Billable Hours Tests** (`billable-hours-tests.yml`) - Dedicated workflow for regression testing

The tests automatically run when billable hours-related files are modified:
- `WorkActivityService.ts`, `NotionSyncService.ts`, `SettingsService.ts`
- Billable hours test files
- Documentation (`billable-hours-calculation.md`)

### Test Coverage

The billable hours test suite covers:

1. **`billableHours.test.ts`** - Core calculation logic and auto-recalculation
2. **`billableHours.crossService.test.ts`** - Cross-service consistency
3. **`billableHours.rounding.test.ts`** - Rounding functionality and integration

These tests focus specifically on the business logic without testing third-party integrations or data parsing, ensuring reliable detection of regressions in the core billable hours calculation system.

### Billable Hours Formula

The tests validate this core formula:
```
adjustedTotalHours = totalHours + hoursAdjustments
billableHours = adjustedTotalHours 
                - (breakTimeMinutes / 60)
                + (adjustedBreakTimeMinutes / 60)
                - (nonBillableTimeMinutes / 60) 
                + (adjustedTravelTimeMinutes / 60)
```

For detailed documentation of the billable hours system, see `docs/billable-hours-calculation.md`.

![CI Status](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/workflows/Continuous%20Integration/badge.svg)
![Tests](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/workflows/Quick%20Tests/badge.svg)
![Coverage](https://codecov.io/gh/YOUR_USERNAME/YOUR_REPO_NAME/branch/main/graph/badge.svg)

A comprehensive scheduling assistant application for managing client maintenance, employee scheduling, and work activities.

## 🌿 Features

- **Dashboard**: Overview of helpers, clients, and upcoming schedule
- **AI Chat Assistant**: Natural language scheduling recommendations using Claude
- **Schedule View**: Visual calendar of upcoming appointments and tasks  
- **Google Integration**: Connects to Google Calendar and Google Sheets for data
- **Travel Optimization**: Calculates travel times between client locations
- **Mobile-Responsive**: Works on desktop, tablet, and mobile devices

## 🚀 Quick Start

### Backend Development
```bash
cd server
npm install
npm run dev
```

### Frontend Development
```bash
npm install
npm start
```

## 🧪 Testing

### Automated Testing (CI/CD)
- **Quick Tests**: Run automatically on every push to server code
- **Full CI Pipeline**: Runs on main/develop branch pushes and pull requests
- **Coverage Reports**: Automatically uploaded to Codecov

### Manual Testing
```bash
# Run all backend tests
cd server && npm test

# Run tests with coverage
cd server && npm run test:coverage

# Run tests in watch mode (development)
cd server && npm run test:watch
```

## 📊 Test Coverage

Our test suite focuses on core CRM functionality:
- ✅ **92+ Unit Tests** covering critical business logic
- ✅ **4 Core Services** comprehensively tested
- ✅ **100% Test Success Rate** for CRM workflows
- ✅ **Automated CI/CD** with GitHub Actions

See [Testing Documentation](server/README_TESTING.md) for detailed information.

## 🔧 GitHub Actions Workflows

### 1. **Quick Tests** (`.github/workflows/quick-test.yml`)
- Runs on every push to `server/` directory
- Fast feedback (~2 minutes)
- Essential for development workflow

### 2. **Continuous Integration** (`.github/workflows/ci.yml`)
- Runs on main/develop branches and PRs
- Comprehensive testing across Node.js versions
- Includes frontend build verification
- Generates coverage reports

### ~~3. Test Suite Matrix~~ (Removed)
- Multi-version testing not needed for this project
- Comprehensive CI workflow covers all necessary testing

## 📈 CI/CD Pipeline Features

- **🚀 Fast Feedback**: Quick tests complete in ~2 minutes
- **🔍 Consistent Environment**: Single Node.js LTS version (20.x)
- **📊 Coverage Tracking**: Automatic coverage reporting
- **🛡️ Security Audits**: Dependency vulnerability scanning
- **✅ Quality Gates**: TypeScript compilation validation
- **📝 Status Reporting**: Real-time status in GitHub UI

## 🏗️ Development Workflow

1. **Make Changes**: Edit code in your feature branch
2. **Auto-Validation**: Quick tests run automatically on push
3. **Create PR**: Full CI pipeline validates your changes
4. **Review**: Coverage reports and test results available in PR
5. **Merge**: All checks must pass before merge to main

## 📁 Project Structure

```
├── .github/workflows/     # CI/CD configurations
├── server/               # Backend API and services
│   ├── src/__tests__/   # Comprehensive test suite
│   └── README_TESTING.md # Testing documentation
├── src/                 # Frontend React application
└── README.md           # This file
```

## 🔧 Environment Setup

### Prerequisites
- Node.js 22.x (what CI uses; the frontend's Vitest suite needs 20+)
- npm 8+
- PostgreSQL (for production)

### Local Development
```bash
# Backend setup
cd server
cp env.example .env
npm install
npm run dev

# Frontend setup (separate terminal)
npm install
npm start
```

---

**Ready to develop with confidence!** The automated test suite and CI/CD pipeline ensure code quality and catch regressions early.

## 📊 Data Sources

The prototype can work with:

1. **Mock Data** (default) - Includes sample helpers, clients, and events
2. **Google Sheets** - Your actual business data
3. **Google Calendar** - Your real calendar events

### Setting Up Google Sheets Integration

1. Create a Google Sheets spreadsheet with tabs: `Helpers`, `Clients`, `Projects`
2. Set up a Google Service Account and download the JSON key
3. Share your spreadsheet with the service account email
4. Add the spreadsheet ID and key file path to your `.env`

**Sample Google Sheets Structure:**

**Helpers Tab:**
| ID | Name | Workdays | Home Address | Min Hours | Max Hours | Capability | Skills | Rate | Status |
|----|------|----------|--------------|-----------|-----------|------------|---------|------|--------|
| helper_001 | Sarah | Mon,Wed,Fri | 789 Elm St... | 7 | 8 | Advanced | pruning,maintenance | 25 | active |

**Clients Tab:**
| ID | Name | Address | Zone | Email | Phone | Is Maintenance | Interval | Hours | Preferred Days | Priority | Status |
|----|------|---------|------|-------|-------|----------------|----------|--------|----------------|----------|--------|
| client_001 | Smith Property | 123 Oak St... | Downtown | ... | ... | TRUE | 2 | 4 | Mon,Tue,Wed | High | active |

## 🤖 AI Assistant Usage

The AI assistant can help with:

- **Scheduling requests**: "Where can I fit a 4-hour maintenance visit next week?"
- **Emergency rescheduling**: "Sarah called in sick today - help me reschedule"
- **Optimization**: "Show me this week's schedule efficiency"
- **Planning**: "Help me plan around Mike's vacation next month"

## 🛠 Technical Architecture

### Frontend (React + TypeScript)
- **Material-UI**: Modern, accessible UI components
- **React Router**: Navigation between pages
- **Axios**: API communication with backend
- **Date-fns**: Date manipulation and formatting

### Backend (Node.js + TypeScript)
- **Express**: Web server and API routes
- **Google APIs**: Calendar, Sheets, and Maps integration
- **Anthropic SDK**: Claude AI integration
- **CORS & Helmet**: Security middleware

### Key Components

```
src/
├── components/
│   ├── Dashboard.tsx    # Business overview
│   ├── Chat.tsx         # AI assistant interface
│   ├── Schedule.tsx     # Calendar view
│   └── Navigation.tsx   # App navigation
├── services/
│   └── api.ts          # Backend API client
└── App.tsx             # Main app component

server/src/
├── services/
│   ├── SchedulingService.ts     # Main orchestration
│   ├── GoogleSheetsService.ts   # Data retrieval
│   ├── GoogleCalendarService.ts # Calendar integration
│   ├── AnthropicService.ts      # AI recommendations
│   └── TravelTimeService.ts     # Distance calculations
├── types/
│   └── index.ts        # TypeScript interfaces
└── server.ts           # Express server
```

## 📱 Screenshots

### Dashboard
- Business metrics (helpers, clients, events)
- Helper overview with skills and availability
- Upcoming schedule preview

### AI Chat Assistant
- Natural language scheduling queries
- Quick action buttons for common requests
- Real-time AI responses with reasoning

### Schedule View
- Calendar events grouped by date
- Event type indicators (maintenance, installs, office work)
- Location and timing details

## 🔧 Development

### Running Tests
```bash
npm test
```

### Building for Production
```bash
npm run build
cd server && npm run build
```

### Adding New Features

1. **New API Endpoint**: Add route in `server/src/server.ts`
2. **New Component**: Create in `src/components/`
3. **Data Types**: Update `server/src/types/index.ts`
4. **API Client**: Add function to `src/services/api.ts`

## 🚀 Deployment

### Backend Deployment
1. Build: `cd server && npm run build`
2. Deploy `dist/` folder to your hosting service
3. Set environment variables in production
4. Start with: `node dist/server.js`

### Frontend Deployment
1. Build: `npm run build`
2. Deploy `build/` folder to static hosting (Netlify, Vercel, etc.)
3. Set `VITE_API_URL` to your backend URL at build time (Vite inlines it into the bundle)

## 🤝 Usage with Your Data

To use this with your actual landscaping business:

1. **Set up Google Calendar** - Connect your existing calendar
2. **Create Google Sheets** - Migrate your client/helper data
3. **Configure APIs** - Add your Google and Anthropic API keys
4. **Customize prompts** - Modify AI system prompts for your business rules
5. **Add business logic** - Customize scheduling constraints and preferences

## 📝 License

This is a prototype built for Andrea's landscaping business. Feel free to adapt for your own use.

## 🆘 Troubleshooting

**Backend won't start:**
- Check that all dependencies are installed: `cd server && npm install`
- Verify your `.env` file has the required variables
- Check port 3001 isn't already in use

**Frontend shows API errors:**
- Ensure the backend is running on port 3001
- Check browser console for specific error messages
- The app will show mock data if backend is unavailable

**Google API issues:**
- Verify your service account key file path is correct
- Check that the spreadsheet is shared with the service account email
- Ensure the Google Sheets ID is correct in your `.env`

## 🔮 Future Enhancements

- Calendar event creation/modification
- SMS/email notifications to helpers and clients
- Weather integration for outdoor work planning
- Mobile app version
- Advanced reporting and analytics
- Integration with invoicing systems 

## 📝 Database Management

### Seed/Reset Database from Google Sheets

The application includes functionality to reset the database and import fresh data from Google Sheets:

#### Via Web Interface (Recommended)
1. Navigate to **Reports** in the main navigation
2. Scroll to the **Database Management** section
3. Click **Seed/Reset from Sheets** button
4. Confirm the operation in the dialog

#### Via API Endpoint
```bash
# Reset database and import fresh data
curl -X POST http://localhost:3001/api/migration/seed-reset \
  -H "Content-Type: application/json" \
  -d '{"confirm": "RESET_AND_SEED"}'

# Check migration status
curl http://localhost:3001/api/migration/status
```

#### Available Migration Endpoints
- `GET /api/migration/status` - Check current database status
- `POST /api/migration/seed-reset` - Clear database and import fresh data
- `POST /api/migration/migrate` - Import data without clearing (append mode)
- `POST /api/migration/employees` - Import only employees
- `POST /api/migration/clients` - Import only clients
- `POST /api/migration/clear` - Clear all data (requires confirmation)

### Google Sheets Setup

Ensure your `.env` file contains:
```env
GOOGLE_SHEETS_ID=your_google_sheets_id
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=path/to/service-account-key.json
```

Expected sheet structure:
- **Employees** sheet: Employee data with columns for ID, Name, Workdays, etc.
- **Clients** sheet: Client data with maintenance schedules and preferences
- **Settings** sheet: Business configuration settings 

## 🔐 Authentication & Security

The application now includes Google SSO (Single Sign-On) authentication with an email allowlist for access control.

### Setting Up Google OAuth

1. **Create Google OAuth Application**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable the Google+ API
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
   - Set application type to "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:3001/api/auth/google/callback` (development)
     - `https://yourdomain.com/api/auth/google/callback` (production)

2. **Configure Environment Variables**:
   ```bash
   # Google OAuth Configuration
   GOOGLE_OAUTH_CLIENT_ID=your_client_id.apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
   GOOGLE_OAUTH_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
   
   # Authentication Configuration
   SESSION_SECRET=your_secure_random_session_secret
   AUTH_ALLOWLIST=user1@example.com,user2@example.com,admin@yourcompany.com
   ```

3. **User Access Control**:
   - Only emails listed in `AUTH_ALLOWLIST` can log in
   - Separate multiple emails with commas
   - Email addresses are case-insensitive
   - Unauthorized users will see an access denied message

### Authentication Flow

1. **Login**: Users click "Sign in with Google" → redirected to Google OAuth
2. **Authorization**: Google verifies user identity and permissions
3. **Callback**: User redirected back with authorization code
4. **Validation**: Server validates user email against allowlist
5. **Session**: Authenticated users get a secure session cookie
6. **Access**: All API endpoints require authentication except `/api/auth/*`

### API Endpoints

- `GET /api/auth/google` - Initiate Google OAuth login
- `GET /api/auth/google/callback` - Handle OAuth callback
- `GET /api/auth/status` - Check authentication status
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout current user

### Frontend Integration

The React app includes:
- **Login Page**: Clean Google SSO interface
- **Auth Context**: Manages user state across the app
- **Protected Routes**: Automatically redirects unauthenticated users
- **User Menu**: Shows user avatar, name, and logout option in navigation 

## API Documentation

### Notion Sync Endpoints

The application provides several endpoints for syncing with Notion:

#### Sync All Pages
- **POST** `/api/notion-sync/sync` - Sync all Notion pages
- **GET** `/api/notion-sync/sync-stream` - Sync all pages with real-time progress

#### Sync Specific Page
- **POST** `/api/notion-sync/sync-page/:pageId` - Sync a specific Notion page by ID
- **POST** `/api/notion-sync/sync-page-stream/:pageId` - Sync a specific page with real-time progress

#### Usage Examples

**Sync a specific page:**
```bash
curl -X POST http://localhost:3001/api/notion-sync/sync-page/YOUR_PAGE_ID
```

**Sync a specific page with streaming progress:**
```bash
curl -X POST http://localhost:3001/api/notion-sync/sync-page-stream/YOUR_PAGE_ID
```

**Get Notion page ID:**
- In Notion, click on a page and copy the URL
- The page ID is the part after the last `/` in the URL (without hyphens)
- Example: `https://notion.so/workspace/Page-Name-123abc456def` → page ID is `123abc456def`

## Features 