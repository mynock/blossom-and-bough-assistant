# Andrea's AI Scheduling Assistant - Prototype

A React/TypeScript application with Node.js backend that provides AI-powered scheduling assistance for Andrea's landscaping business.

## 🌿 Features

- **Dashboard**: Overview of helpers, clients, and upcoming schedule
- **AI Chat Assistant**: Natural language scheduling recommendations using Claude
- **Schedule View**: Visual calendar of upcoming appointments and tasks  
- **Google Integration**: Connects to Google Calendar and Google Sheets for data
- **Travel Optimization**: Calculates travel times between client locations
- **Mobile-Responsive**: Works on desktop, tablet, and mobile devices

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Google Cloud Project (for Calendar/Sheets/Maps APIs)
- Anthropic API key (for Claude AI)

### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install
```

### 2. Environment Setup

Create `server/.env` with your API keys:

```bash
# Server Configuration
PORT=3001

# API Keys
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Google Sheets Integration (optional for demo)
GOOGLE_SHEETS_ID=your_google_sheets_spreadsheet_id_here
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=path/to/your/service-account-key.json
```

### 3. Run the Application

```bash
# Start both frontend and backend (from root directory)
npm run dev

# Or run them separately:
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend  
npm start
```

The app will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

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
3. Set `REACT_APP_API_URL` to your backend URL

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