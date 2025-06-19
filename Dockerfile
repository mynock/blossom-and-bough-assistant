# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies
RUN npm ci
RUN cd server && npm ci

# Copy source code
COPY . .

# Build React frontend with CI=false to not treat warnings as errors
RUN npm run build:production

# Build backend
RUN cd server && npm run build

# Expose port
EXPOSE $PORT

# Start the server
CMD ["sh", "-c", "cd server && npm run start:prod"] 