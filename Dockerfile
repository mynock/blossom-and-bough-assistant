# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install ALL dependencies (including devDependencies for build)
RUN npm ci
RUN cd server && npm ci

# Copy source code
COPY . .

# Build React frontend
RUN npm run build:production

# Build backend
RUN cd server && npm run build

# Remove devDependencies after build
RUN npm prune --production
RUN cd server && npm prune --production

# Change to server directory
WORKDIR /app/server

# Expose port
EXPOSE $PORT

# Start the server
CMD ["npm", "run", "start:prod"]