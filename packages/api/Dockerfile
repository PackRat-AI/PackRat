FROM oven/bun:1

WORKDIR /app

# Create non-root user for security
RUN groupadd --gid 1001 container && \
    useradd --uid 1001 --gid 1001 --no-create-home container

# Copy source files
COPY --chown=container:container container_src/package.json ./
COPY --chown=container:container container_src/server.ts ./

# Install dependencies
RUN bun install --production

# Switch to non-root user
USER container

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:8080/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" || exit 1

CMD ["bun", "run", "server.ts"]