# TikTok Service

A containerized Node.js service that handles TikTok API integration for the PackRat application. This service runs separately from the main Cloudflare Workers API to support libraries that require a full Node.js runtime.

## Features

- Extract slideshow images and captions from TikTok URLs
- Full Node.js runtime support for TikTok API libraries
- Docker containerization for easy deployment
- Health check endpoints
- Request validation and error handling

## Development

Start the service locally:
```bash
# From root directory
bun tiktok

# Or from this directory
bun dev
```

## Docker

Build and run with Docker:
```bash
# Build image
bun docker:build

# Run container
bun docker:run

# Or use docker-compose
docker-compose up
```

## API Endpoints

### Health Check
```
GET /health
```

Returns service status and timestamp.

### Import TikTok Slideshow
```
POST /import
Content-Type: application/json

{
  "tiktokUrl": "https://tiktok.com/@user/video/123",
  "userId": "optional-user-id"
}
```

Returns extracted images and caption data.

## Environment Variables

- `PORT` - Service port (default: 8080)
- `NODE_ENV` - Environment mode
- `TIKTOK_SERVICE_URL` - Used by main API to connect to this service

## Integration

The main PackRat API (`packages/api`) proxies TikTok requests to this service. The service URL is configurable via the `TIKTOK_SERVICE_URL` environment variable.

## Deployment

This service is designed to be deployed as a Cloudflare Container, providing full Node.js runtime while integrating with the existing Cloudflare infrastructure.