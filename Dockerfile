FROM node:18-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy package files
COPY backend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy backend source code
COPY backend/ ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check with better timeout and retry settings
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=5 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the server
CMD ["npm", "start"] 