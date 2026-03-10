# TikTok Service

A Cloudflare Container-based service that handles TikTok API integration for the PackRat application. This service runs as a Cloudflare Container with a full Node.js runtime while integrating seamlessly with the Cloudflare Workers ecosystem.

## Architecture

This service follows the [official Cloudflare Containers template](https://github.com/cloudflare/templates/tree/main/containers-template) pattern:

- **Worker Entry Point** (`src/index.ts`): Cloudflare Worker that routes requests to the container
- **Container Class** (`TikTokContainer`): Extends `@cloudflare/containers` Container class with lifecycle hooks
- **Container Server** (`container_src/server.ts`): Full Node.js HTTP server running inside the container
- **Durable Objects**: Container instances are managed via Durable Object bindings

## Features

- Extract slideshow images and captions from TikTok URLs
- Full Node.js runtime support for TikTok API libraries
- Automatic container lifecycle management (sleep after inactivity)
- Health check endpoints
- Request validation and error handling
- Image rehosting to R2 storage

## Development

### Local Development with Wrangler

```bash
# From this directory
bun run dev
```

### Generate TypeScript types

```bash
bun run cf-typegen
```

### Local Container Testing (Docker)

For testing the container image locally:

```bash
# Build and run with docker-compose
docker-compose up

# Or build manually
docker build -t tiktok-container .
docker run -p 8080:8080 tiktok-container
```

## Deployment

Deploy to Cloudflare:

```bash
bun run deploy
```

This will:
1. Build the container image from `./Dockerfile`
2. Push the image to Cloudflare's container registry
3. Deploy the Worker with container bindings

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
  "tiktokUrl": "https://tiktok.com/@user/video/123"
}
```

Returns extracted images and caption data.

### Singleton Container
```
GET /singleton
```

Returns information about the container instance.

## Environment Variables

Container environment variables are configured in the `TikTokContainer` class:

```typescript
envVars = {
  NODE_ENV: 'production',
  PORT: '8080',
};
```

Additional R2 configuration for image rehosting:
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `R2_ACCESS_KEY_ID` - R2 access key ID
- `R2_SECRET_ACCESS_KEY` - R2 secret access key
- `R2_BUCKET_NAME` - R2 bucket name
- `R2_PUBLIC_URL` - R2 public URL

## Configuration

The service is configured via `wrangler.jsonc`:

```jsonc
{
  "containers": [
    {
      "class_name": "TikTokContainer",
      "image": "./Dockerfile",
      "max_instances": 5
    }
  ],
  "durable_objects": {
    "bindings": [
      {
        "class_name": "TikTokContainer",
        "name": "TIKTOK_CONTAINER"
      }
    ]
  }
}
```

## Integration

The main PackRat API (`packages/api`) calls this service via the `TIKTOK_SERVICE_URL` environment variable. When deployed as a Cloudflare Container, the Worker URL is used directly.