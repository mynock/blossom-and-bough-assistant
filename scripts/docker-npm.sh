#!/bin/bash

# Helper script to run npm commands in Docker containers without rebuilding

set -e

CONTAINER=""
COMMAND=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --container|-c)
      CONTAINER="$2"
      shift 2
      ;;
    --backend|-b)
      CONTAINER="blossom-backend"
      shift
      ;;
    --frontend|-f)
      CONTAINER="blossom-frontend"
      shift
      ;;
    *)
      COMMAND="$@"
      break
      ;;
  esac
done

if [ -z "$CONTAINER" ]; then
  echo "Usage: $0 [--backend|-b] [--frontend|-f] [--container|-c CONTAINER_NAME] <npm command>"
  echo ""
  echo "Examples:"
  echo "  $0 --backend install express"
  echo "  $0 --frontend install @types/react"
  echo "  $0 --backend install --save-dev jest"
  echo "  $0 --frontend update"
  exit 1
fi

if [ -z "$COMMAND" ]; then
  echo "Error: No npm command provided"
  exit 1
fi

echo "Running 'npm $COMMAND' in container: $CONTAINER"

# Run the npm command in the container
docker exec -it "$CONTAINER" npm $COMMAND

echo "Command completed successfully!"
echo ""
echo "Note: The package.json files in your container have been updated."
echo "You may want to copy them back to your host if you want to persist the changes:"
echo ""
if [ "$CONTAINER" = "blossom-backend" ]; then
  echo "  docker cp $CONTAINER:/app/server/package.json ./server/"
  echo "  docker cp $CONTAINER:/app/server/package-lock.json ./server/"
elif [ "$CONTAINER" = "blossom-frontend" ]; then
  echo "  docker cp $CONTAINER:/app/package.json ./"
  echo "  docker cp $CONTAINER:/app/package-lock.json ./"
fi
