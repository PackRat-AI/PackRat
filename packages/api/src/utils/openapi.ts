import { openapi } from '@elysiajs/openapi';

/**
 * Shared OpenAPI plugin instance configured for the PackRat API.
 *
 * Admin and API-key-gated paths are excluded from the public schema so
 * unauthenticated clients cannot enumerate them via /doc or /scalar.
 */
export const packratOpenApi = openapi({
  path: '/scalar',
  specPath: '/doc',
  exclude: {
    paths: [
      /^\/api\/admin(\/|$)/,
      /^\/api\/catalog\/etl(\/|$)/,
      /^\/api\/catalog\/.*\/backfill(\/|$)/i,
    ],
  },
  documentation: {
    openapi: '3.1.0',
    info: {
      title: 'PackRat API',
      version: '1.0.0',
      description:
        'PackRat is a comprehensive outdoor adventure planning platform that helps users organize and manage their packing lists for trips.',
      contact: {
        name: 'PackRat Support',
        email: 'support@packrat.app',
        url: 'https://packrat.app',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      { url: 'https://api.packrat.app', description: 'Production server' },
      { url: 'https://staging-api.packrat.app', description: 'Staging server' },
      { url: 'http://localhost:8787', description: 'Local development server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/login or /api/auth/refresh endpoints',
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Server-to-server API key for machine clients',
        },
      },
    },
    tags: [
      { name: 'Authentication', description: 'User authentication and authorization' },
      { name: 'Users', description: 'User profile and account management' },
      { name: 'Packs', description: 'Pack creation, management, and sharing' },
      { name: 'Pack Items', description: 'Manage items within packs' },
      { name: 'Pack Templates', description: 'Pre-built pack templates for common activities' },
      { name: 'Catalog', description: 'Product catalog with gear information and recommendations' },
      { name: 'Guides', description: 'Adventure guides and location information' },
      { name: 'Search', description: 'Search functionality across the platform' },
      { name: 'Weather', description: 'Weather information for trip planning' },
      { name: 'Chat', description: 'AI-powered chat assistant for trip planning' },
      { name: 'Trips', description: 'Trip planning and itineraries' },
      { name: 'Feed', description: 'Social feed, posts and comments' },
      { name: 'Trail Conditions', description: 'User-reported trail conditions' },
      { name: 'Wildlife', description: 'Wildlife identification' },
      { name: 'Admin', description: 'Administrative endpoints (restricted access)' },
      { name: 'Upload', description: 'File upload and media management' },
    ],
  },
});
