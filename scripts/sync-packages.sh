#!/bin/bash

# Script to sync package.json and package-lock.json from containers back to host

set -e

SYNC_BACKEND=false
SYNC_FRONTEND=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --backend|-b)
      SYNC_BACKEND=true
      shift
      ;;
    --frontend|-f)
      SYNC_FRONTEND=true
      shift
      ;;
    --all|-a)
      SYNC_BACKEND=true
      SYNC_FRONTEND=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--backend|-b] [--frontend|-f] [--all|-a]"
      echo ""
      echo "Sync package.json and package-lock.json from Docker containers to host"
      echo ""
      echo "Options:"
      echo "  --backend, -b     Sync backend packages"
      echo "  --frontend, -f    Sync frontend packages"
      echo "  --all, -a         Sync both backend and frontend packages"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

if [ "$SYNC_BACKEND" = false ] && [ "$SYNC_FRONTEND" = false ]; then
  echo "Error: No containers specified to sync"
  echo "Use --help for usage information"
  exit 1
fi

# Function to check if container is running
check_container() {
  local container_name=$1
  if ! docker ps --format "table {{.Names}}" | grep -q "^$container_name$"; then
    echo "Warning: Container $container_name is not running"
    return 1
  fi
  return 0
}

# Sync backend packages
if [ "$SYNC_BACKEND" = true ]; then
  echo "Syncing backend packages..."
  if check_container "blossom-backend"; then
    docker cp blossom-backend:/app/server/package.json ./server/
    docker cp blossom-backend:/app/server/package-lock.json ./server/
    echo "✓ Backend packages synced"
  else
    echo "✗ Skipping backend sync - container not running"
  fi
fi

# Sync frontend packages
if [ "$SYNC_FRONTEND" = true ]; then
  echo "Syncing frontend packages..."
  if check_container "blossom-frontend"; then
    docker cp blossom-frontend:/app/package.json ./
    docker cp blossom-frontend:/app/package-lock.json ./
    echo "✓ Frontend packages synced"
  else
    echo "✗ Skipping frontend sync - container not running"
  fi
fi

echo ""
echo "Package sync completed!"
echo ""
echo "Remember to commit these changes to version control if needed."
