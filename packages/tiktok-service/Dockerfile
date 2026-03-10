FROM oven/bun:1 as builder

WORKDIR /app

# Copy root package files for workspace setup
COPY package.json bun.lockb bunfig.toml ./

# Copy the TikTok service package
COPY packages/tiktok-service/package.json ./packages/tiktok-service/package.json

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY packages/tiktok-service/src ./packages/tiktok-service/src

# Build the service
WORKDIR /app/packages/tiktok-service
RUN bun run build

# Production image with Node.js runtime
FROM node:18-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S tiktok -u 1001

# Copy built application and package.json
COPY --from=builder --chown=tiktok:nodejs /app/packages/tiktok-service/dist ./
COPY --from=builder --chown=tiktok:nodejs /app/packages/tiktok-service/package.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Switch to non-root user
USER tiktok

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "http.get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

CMD ["node", "index.js"]