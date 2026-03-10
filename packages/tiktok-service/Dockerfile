FROM oven/bun:1 AS builder

WORKDIR /app

# Copy container source code and package files
COPY container_src/package.json ./
COPY container_src/server.ts ./

# Install dependencies
RUN bun install

# Build the service
RUN bun build server.ts --outdir dist --target bun

# Production image
FROM oven/bun:1-slim

WORKDIR /app

# Create non-root user for security
RUN addgroup --gid 1001 nodejs && \
    adduser --uid 1001 --gid 1001 --disabled-password tiktok

# Copy built application
COPY --from=builder --chown=tiktok:nodejs /app/dist ./
COPY --from=builder --chown=tiktok:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER tiktok

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:8080/health').then(r => process.exit(r.ok ? 0 : 1))" || exit 1

CMD ["bun", "run", "server.js"]