# Docker Development Guide: Avoiding Container Rebuilds

This guide explains multiple approaches to avoid rebuilding Docker containers when Node.js packages are updated, allowing for faster development workflows.

## Quick Start

The fastest way to add packages without rebuilding:

```bash
# Add a package to backend
./scripts/docker-npm.sh --backend install express

# Add a package to frontend  
./scripts/docker-npm.sh --frontend install react-router-dom

# Sync the updated package.json files back to your host
./scripts/sync-packages.sh --all
```

## Approach 1: Enhanced Docker Compose (Recommended)

Use the provided `docker-compose.dev.yml` which includes:

- **Volume mounting**: Source code is mounted for live reloading
- **Named volumes**: `node_modules` directories use named volumes to persist between restarts
- **Package detection**: Automatically detects `package.json` changes and reinstalls dependencies

### Usage

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# The containers will automatically detect package.json changes and reinstall dependencies
```

### Benefits
- Automatic dependency detection
- No manual intervention needed
- Persistent `node_modules` across container restarts
- Live source code reloading

## Approach 2: Helper Scripts

Use the provided scripts for manual package management:

### Installing Packages

```bash
# Backend packages
./scripts/docker-npm.sh --backend install <package-name>
./scripts/docker-npm.sh --backend install --save-dev <dev-package>

# Frontend packages  
./scripts/docker-npm.sh --frontend install <package-name>
./scripts/docker-npm.sh --frontend install --save-dev <dev-package>
```

### Syncing Package Files

After installing packages in containers, sync them back to your host:

```bash
# Sync both frontend and backend
./scripts/sync-packages.sh --all

# Sync just backend
./scripts/sync-packages.sh --backend

# Sync just frontend
./scripts/sync-packages.sh --frontend
```

### Benefits
- Full control over when packages are installed
- Works with existing containers
- Easy to script and automate

## Approach 3: Optimized Dockerfiles

Use the enhanced Dockerfiles (`Dockerfile.backend.dev`, `Dockerfile.frontend.dev`) that:

- Copy `package.json` files first for better Docker layer caching
- Install dependencies in separate layers
- Only rebuild dependency layers when package files change

### Usage

Update your `docker-compose.yml` to use the dev Dockerfiles:

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

### Benefits
- Faster rebuilds when only source code changes
- Better Docker layer caching
- Smaller rebuild times for dependency changes

## Direct Container Commands

You can also run npm commands directly in running containers:

```bash
# Install a package in the backend container
docker exec -it blossom-backend npm install express

# Install a package in the frontend container
docker exec -it blossom-frontend npm install react-router-dom

# Update all packages
docker exec -it blossom-backend npm update
docker exec -it blossom-frontend npm update
```

## Volume Strategy Explanation

The key to avoiding rebuilds is using Docker volumes strategically:

### Source Code Volumes
```yaml
volumes:
  - ./server:/app/server  # Live source code mounting
  - ./src:/app/src        # Live source code mounting
```

### Node Modules Volumes
```yaml
volumes:
  - backend_node_modules:/app/server/node_modules   # Named volume
  - frontend_node_modules:/app/node_modules         # Named volume
```

### Why This Works
1. **Source code** is mounted from host, enabling live reloading
2. **node_modules** uses named volumes, so packages persist between container restarts
3. **Package installations** happen inside containers and persist in the named volumes
4. **No rebuilds** needed since dependencies are installed at runtime

## Troubleshooting

### Containers Not Starting
If containers fail to start after package changes:
```bash
# Rebuild with no cache
docker-compose build --no-cache

# Or remove volumes and restart
docker-compose down -v
docker-compose up
```

### Package Version Conflicts
If you encounter version conflicts:
```bash
# Clear node_modules and reinstall
docker exec -it blossom-backend rm -rf node_modules package-lock.json
docker exec -it blossom-backend npm install
```

### Syncing Issues
If package files don't sync properly:
```bash
# Manually copy files
docker cp blossom-backend:/app/server/package.json ./server/
docker cp blossom-backend:/app/server/package-lock.json ./server/
```

## Best Practices

1. **Use the enhanced docker-compose.dev.yml** for regular development
2. **Install packages using the helper scripts** for consistency
3. **Always sync package files back to host** to maintain version control
4. **Commit package.json changes** after installing new dependencies
5. **Use named volumes** for node_modules to persist packages
6. **Test in a clean environment** before deploying

## Performance Tips

- Use `npm ci` instead of `npm install` in Dockerfiles for faster, deterministic installs
- Clear npm cache after installs to reduce image size
- Use `.dockerignore` to exclude unnecessary files from build context
- Consider using `npm prune --production` for production builds

## Migration from Current Setup

To start using this approach:

1. **Copy the new files** provided (`docker-compose.dev.yml`, scripts, etc.)
2. **Test with the development compose file**:
   ```bash
   docker-compose -f docker-compose.dev.yml up
   ```
3. **Install a test package** to verify the workflow:
   ```bash
   ./scripts/docker-npm.sh --backend install lodash
   ./scripts/sync-packages.sh --backend
   ```
4. **Adopt the workflow** that works best for your team

Choose the approach that best fits your development workflow. The enhanced docker-compose setup (Approach 1) is recommended for most development scenarios as it provides the best balance of automation and control.
