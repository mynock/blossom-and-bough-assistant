# Docker Development Setup

This document describes how to run the Blossom & Bough application using Docker Compose for development.

## Architecture

The Docker Compose setup includes three services:

1. **PostgreSQL Database** (`postgres`) - Port 5432
2. **Backend API** (`backend`) - Port 3001 (runs `npm run dev`)
3. **Frontend React App** (`frontend`) - Port 3000 (runs `npm start`)

## Prerequisites

- Docker and Docker Compose installed
- Environment variables configured (see below)

## Quick Start

1. **Clone and navigate to the project directory**
2. **Set up environment variables** (see Environment Configuration below)
3. **Start all services:**
   ```bash
   docker-compose up
   ```
4. **Access the applications:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Database accessible at localhost:5432

## Environment Configuration

### Option 1: Use .env file (Recommended)
Create a `.env` file in the root directory with your actual values:

```env
# Copy from env.example and update with your values
GOOGLE_SHEETS_ID=your_actual_google_sheets_id
GOOGLE_OAUTH_CLIENT_ID=your_actual_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_actual_client_secret
SESSION_SECRET=your_secure_session_secret
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
AUTH_ALLOWLIST=your_email@example.com
```

### Option 2: Export environment variables
```bash
export GOOGLE_SHEETS_ID=your_actual_google_sheets_id
export GOOGLE_OAUTH_CLIENT_ID=your_actual_client_id
# ... etc
```

## Docker Commands

### Start all services
```bash
docker-compose up
```

### Start in background (detached mode)
```bash
docker-compose up -d
```

### View logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres
```

### Stop all services
```bash
docker-compose down
```

### Rebuild and start (after code changes to Dockerfiles)
```bash
docker-compose up --build
```

### Remove everything (including volumes)
```bash
docker-compose down -v
```

## Database Management

### Run migrations
```bash
# Connect to backend container and run migrations
docker-compose exec backend npm run db:migrate
```

### Access database directly
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U blossom_user -d blossom_and_bough
```

### Open Drizzle Studio
```bash
# Connect to backend container and run studio
docker-compose exec backend npm run db:studio
```

### Database credentials (for external connections)
- Host: localhost
- Port: 5432
- Database: blossom_and_bough
- Username: blossom_user
- Password: blossom_password

## Development Workflow

### File Changes
- **Frontend**: Changes in `./src/` are automatically reloaded
- **Backend**: Changes in `./server/` are automatically reloaded with nodemon
- **Package.json changes**: Require container restart

### Installing new dependencies
```bash
# For frontend
docker-compose exec frontend npm install new-package

# For backend
docker-compose exec backend npm install new-package

# Or rebuild containers after local npm install
docker-compose up --build
```

### Debugging

#### Connect to running containers
```bash
# Backend container
docker-compose exec backend sh

# Frontend container  
docker-compose exec frontend sh

# Database container
docker-compose exec postgres sh
```

#### View service status
```bash
docker-compose ps
```

#### Check resource usage
```bash
docker stats
```

## Troubleshooting

### Port conflicts
If ports 3000, 3001, or 5432 are already in use:
1. Stop other services using those ports
2. Or modify the ports in `docker-compose.yml`

### Database connection issues
1. Verify the database container is healthy: `docker-compose ps`
2. Check logs: `docker-compose logs postgres`
3. Ensure migrations are run: `docker-compose exec backend npm run db:migrate`

### File permission issues (Linux/macOS)
If you encounter permission errors:
```bash
# Fix ownership
sudo chown -R $USER:$USER ./node_modules ./server/node_modules
```

### Clear everything and start fresh
```bash
# Stop and remove containers, networks, and volumes
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Rebuild from scratch
docker-compose up --build
```

## Production Considerations

This setup is optimized for development with:
- Volume mounts for hot reloading
- Development database credentials
- Debug-friendly logging

For production deployment:
- Use the existing `Dockerfile` (production-ready)
- Set proper environment variables
- Use external managed database
- Enable SSL/TLS
- Configure proper secrets management

## Files Created

- `docker-compose.yml` - Main orchestration file
- `Dockerfile.backend` - Backend development container
- `Dockerfile.frontend` - Frontend development container  
- `server/scripts/init-db.sql` - Database initialization
- `.dockerignore` - Files to exclude from builds 