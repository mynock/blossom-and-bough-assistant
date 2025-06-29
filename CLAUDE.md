# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (React/TypeScript)
```bash
# Development server (port 3000)
npm start

# Build for production
npm run build
npm run build:production  # CI=false version

# Type checking
npm run type-check

# Testing
npm test
```

### Backend (Node.js/TypeScript)
```bash
# Development server with hot reload (port 3001)
cd server && npm run dev

# Build TypeScript to dist/
cd server && npm run build

# Production start
cd server && npm run start:prod

# Type checking
cd server && npm run type-check
```

### Database Operations (Drizzle ORM + PostgreSQL)
```bash
# Generate migrations from schema changes
cd server && npm run db:generate

# Run pending migrations
cd server && npm run db:migrate

# Production migration (exits after completion)
cd server && npm run db:migrate:prod

# Push schema to database (dev only)
cd server && npm run db:push

# Launch Drizzle Studio
cd server && npm run db:studio

# Data import/management scripts
cd server && npm run import           # Import from Google Sheets
cd server && npm run import:historical # Historical data import
cd server && npm run clear-db         # Clear work activities
```

### Development Shortcuts
```bash
# Start both frontend and backend together
npm run dev

# Start backend only
npm run server
```

### Docker Development
```bash
# Start all services (frontend, backend, postgres)
docker-compose up

# View logs
docker-compose logs backend
docker-compose logs frontend

# Database migrations in Docker
docker-compose exec backend npm run db:migrate

# Drizzle Studio in Docker
docker-compose exec backend npm run db:studio
```

## Architecture Overview

### Project Structure
- **Full-stack TypeScript application** for landscaping business management
- **Frontend**: React SPA with Material-UI using Create React App
- **Backend**: Express API server with comprehensive business services
- **Database**: PostgreSQL with Drizzle ORM for type-safe queries
- **Authentication**: Google OAuth with allowlist-based access control

### Core Business Domain
The application manages landscaping operations including:
- **Employee scheduling** and availability tracking
- **Client management** with maintenance schedules and preferences  
- **Work activity tracking** with time, billing, and task management
- **Project management** for installations and one-time work
- **AI-powered scheduling assistance** using Anthropic Claude
- **Google integrations** (Calendar, Sheets, Maps) for real-world data sync
- **Notion integration** for work notes and task carryover

### Database Schema (PostgreSQL)
Key tables defined in `server/src/db/schema.ts`:
- `clients` - Client information, maintenance schedules, preferences
- `employees` - Worker details, availability, capabilities, rates
- `projects` - Installation projects and one-time work
- `work_activities` - Daily work entries with time tracking and billing
- `work_activity_employees` - Many-to-many relationship for work assignments
- `other_charges` - Materials, services, and additional billing items
- `client_notes` - Meeting notes and client interaction history

### Service Layer Architecture
Located in `server/src/services/`, each service handles specific business logic:

**Core Services:**
- `SchedulingService.ts` - Main orchestration for AI-powered scheduling
- `AnthropicService.ts` - Claude AI integration for scheduling recommendations
- `DatabaseService.ts` - Database operations and queries

**External Integrations:**
- `GoogleCalendarService.ts` - Calendar event management and sync
- `GoogleSheetsService.ts` - Data import/export with Google Sheets
- `TravelTimeService.ts` - Google Maps integration for travel calculations
- `NotionService.ts` - Notion API for work entry creation
- `NotionSyncService.ts` - Bi-directional sync between database and Notion

**Business Logic:**
- `ClientService.ts` - Client management and maintenance scheduling
- `EmployeeService.ts` - Employee management and availability
- `WorkActivityService.ts` - Work tracking, time entry, billing
- `ProjectService.ts` - Project management and status tracking
- `AuthService.ts` - Google OAuth authentication
- `WorkNotesParserService.ts` - Parse and import work notes from various formats

### Frontend Component Structure
React components in `src/components/`:
- `Dashboard.tsx` - Business overview with metrics and summaries
- `Chat.tsx` - AI assistant interface for scheduling queries
- `Schedule.tsx` - Calendar view of work activities and appointments
- `ClientManagement.tsx` / `ClientDetail.tsx` - Client CRUD and detail views
- `EmployeeManagement.tsx` / `EmployeeDetail.tsx` - Employee management
- `WorkActivityManagement.tsx` - Work entry tracking and time management
- `NotionSync.tsx` - Notion integration interface
- `Admin.tsx` - Database management and system administration

### Authentication Flow
- Google OAuth 2.0 with allowlist-based access control
- Session-based authentication using Express sessions
- Email allowlist configured via `AUTH_ALLOWLIST` environment variable
- All API routes protected except `/api/auth/*` endpoints

### Key Environment Variables
Required in `server/.env`:
```
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Authentication  
GOOGLE_OAUTH_CLIENT_ID=your_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_secret
SESSION_SECRET=secure_random_string
AUTH_ALLOWLIST=email1@domain.com,email2@domain.com

# External APIs
ANTHROPIC_API_KEY=sk-ant-your_key
GOOGLE_MAPS_API_KEY=your_maps_key
GOOGLE_SHEETS_ID=your_sheets_id

# Notion Integration
NOTION_TOKEN=secret_your_notion_token
NOTION_DATABASE_ID=your_database_id
```

## Development Patterns

### Service Integration
Services follow dependency injection patterns and are designed to be composed:
- `SchedulingService` orchestrates multiple services for complex scheduling decisions
- Services communicate via well-defined TypeScript interfaces
- Database operations are centralized through `DatabaseService`

### Type Safety
- Strict TypeScript configuration with comprehensive type checking
- Database schema types auto-generated by Drizzle ORM
- Shared type definitions in `server/src/types/index.ts`
- Frontend API client with typed requests/responses

### Error Handling
- Winston logging configured for different environments
- Structured error responses with appropriate HTTP status codes
- Database transaction handling for data integrity

### Data Migration and Import
- Drizzle migrations for schema changes
- Google Sheets import functionality for bulk data operations
- Historical data import scripts for initial setup
- Database reset/seed functionality for development

## Notion Integration Specifics

The application includes sophisticated Notion integration for work note management:
- Create work entries with automatic task carryover from previous visits
- Bi-directional sync between local database and Notion pages
- Embedded interface (`/notion-embed`) for quick entry creation
- Smart client management with auto-complete and new client handling

## Google Services Integration

### Calendar Integration
- Real-time sync with Google Calendar for scheduling
- Event creation/modification with proper metadata
- Travel time calculation and buffer management

### Sheets Integration  
- Bulk data import/export functionality
- Historical data migration from existing spreadsheets
- Structured data validation and transformation

### Maps Integration
- Travel time calculation between client locations
- Route optimization for efficient scheduling
- Zone-based travel time estimates

## Development Notes

### Common Patterns
- Use Material-UI components for consistent styling
- Implement proper loading states and error boundaries
- Follow React Hook patterns for state management
- Use React Router for navigation with protected routes

### Database Development
- Always generate migrations for schema changes: `npm run db:generate`
- Test migrations locally before deploying
- Use Drizzle Studio for database inspection during development
- Backup database before running destructive operations

### API Development
- Follow RESTful conventions for API endpoints
- Implement proper request validation
- Use middleware for authentication and logging
- Return consistent error response formats

### Testing and Quality
- Run type checking before commits: `npm run type-check`
- Test Google integrations with valid credentials
- Validate database migrations in development environment
- Test authentication flow with real Google accounts from allowlist