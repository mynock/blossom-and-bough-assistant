# Docker Development Setup

This document describes how to run the Blossom & Bough application using Docker Compose for development, including strategies for avoiding container rebuilds during active development.

## Architecture

The Docker Compose setup includes three services:

1. **PostgreSQL Database** (`postgres`) - Port 5432
2. **Backend API** (`backend`) - Port 3001 (runs `npm run dev`)
3. **Frontend React App** (`frontend`) - Port 3000 (runs `npm start`)

### Prerequisites

- Docker and Docker Compose installed
- Environment variables configured (see Environment Configuration below)

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
docker-compose exec backend npm run db:migrate
```

### Access database directly
```bash
docker-compose exec postgres psql -U blossom_user -d blossom_and_bough
```

### Open Drizzle Studio
```bash
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
- **Package.json changes**: Require container restart (or use the approaches below)

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
docker-compose exec backend sh
docker-compose exec frontend sh
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

## Avoiding Container Rebuilds

### Quick Start

The fastest way to add packages without rebuilding:

```bash
# Add a package to backend
./scripts/docker-npm.sh --backend install express

# Add a package to frontend
./scripts/docker-npm.sh --frontend install react-router-dom

# Sync the updated package.json files back to your host
./scripts/sync-packages.sh --all
```

### Approach 1: Enhanced Docker Compose (Recommended)

Use the provided `docker-compose.dev.yml` which includes:

- **Volume mounting**: Source code is mounted for live reloading
- **Named volumes**: `node_modules` directories use named volumes to persist between restarts
- **Package detection**: Automatically detects `package.json` changes and reinstalls dependencies

```bash
docker-compose -f docker-compose.dev.yml up
```

### Approach 2: Helper Scripts

```bash
# Backend packages
./scripts/docker-npm.sh --backend install <package-name>
./scripts/docker-npm.sh --backend install --save-dev <dev-package>

# Frontend packages
./scripts/docker-npm.sh --frontend install <package-name>

# Sync package files back to host
./scripts/sync-packages.sh --all
./scripts/sync-packages.sh --backend
./scripts/sync-packages.sh --frontend
```

### Approach 3: Optimized Dockerfiles

Use the enhanced Dockerfiles (`Dockerfile.backend.dev`, `Dockerfile.frontend.dev`) that copy `package.json` files first for better Docker layer caching.

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend.dev
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend.dev
```

### Direct Container Commands

```bash
docker exec -it blossom-backend npm install express
docker exec -it blossom-frontend npm install react-router-dom
docker exec -it blossom-backend npm update
```

### Volume Strategy

The key to avoiding rebuilds is using Docker volumes strategically:

```yaml
volumes:
  # Source code: mounted from host for live reloading
  - ./server:/app/server
  - ./src:/app/src
  # Node modules: named volumes persist between restarts
  - backend_node_modules:/app/server/node_modules
  - frontend_node_modules:/app/node_modules
```

### Best Practices

1. Use the enhanced `docker-compose.dev.yml` for regular development
2. Install packages using the helper scripts for consistency
3. Always sync package files back to host to maintain version control
4. Commit `package.json` changes after installing new dependencies
5. Use named volumes for `node_modules` to persist packages

### Performance Tips

- Use `npm ci` instead of `npm install` in Dockerfiles for faster, deterministic installs
- Clear npm cache after installs to reduce image size
- Use `.dockerignore` to exclude unnecessary files from build context
- Consider using `npm prune --production` for production builds

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
```bash
sudo chown -R $USER:$USER ./node_modules ./server/node_modules
```

### Containers not starting
```bash
# Rebuild with no cache
docker-compose build --no-cache

# Or remove volumes and restart
docker-compose down -v
docker-compose up
```

### Package version conflicts
```bash
docker exec -it blossom-backend rm -rf node_modules package-lock.json
docker exec -it blossom-backend npm install
```

### Syncing issues
```bash
docker cp blossom-backend:/app/server/package.json ./server/
docker cp blossom-backend:/app/server/package-lock.json ./server/
```

### Clear everything and start fresh
```bash
docker-compose down -v
docker-compose down --rmi all
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

## Files Reference

- `docker-compose.yml` - Main orchestration file
- `docker-compose.dev.yml` - Enhanced development orchestration with named volumes
- `Dockerfile.backend` / `Dockerfile.backend.dev` - Backend containers
- `Dockerfile.frontend` / `Dockerfile.frontend.dev` - Frontend containers
- `server/scripts/init-db.sql` - Database initialization
- `.dockerignore` - Files to exclude from builds
- `scripts/docker-npm.sh` - Helper script for installing packages in containers
- `scripts/sync-packages.sh` - Helper script for syncing package files to host
