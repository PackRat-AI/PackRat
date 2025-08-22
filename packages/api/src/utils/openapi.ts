import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';

export const configureOpenAPI = (app: OpenAPIHono<{ Bindings: Env; Variables: Variables }>) => {
  // Register security scheme
  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'JWT token obtained from /api/auth/login or /api/auth/refresh endpoints',
  });

  app.doc('/doc', {
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
      {
        url: 'https://api.packrat.app',
        description: 'Production server',
      },
      {
        url: 'https://staging-api.packrat.app',
        description: 'Staging server',
      },
      {
        url: 'http://localhost:8787',
        description: 'Local development server',
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
        externalDocs: {
          description: 'Learn more about authentication',
          url: 'https://docs.packrat.app/auth',
        },
      },
      {
        name: 'Users',
        description: 'User profile and account management',
      },
      {
        name: 'Packs',
        description: 'Pack creation, management, and sharing',
      },
      {
        name: 'Pack Items',
        description: 'Manage items within packs',
      },
      {
        name: 'Pack Templates',
        description: 'Pre-built pack templates for common activities',
      },
      {
        name: 'Catalog',
        description: 'Product catalog with gear information and recommendations',
      },
      {
        name: 'Guides',
        description: 'Adventure guides and location information',
      },
      {
        name: 'Search',
        description: 'Search functionality across the platform',
      },
      {
        name: 'Weather',
        description: 'Weather information for trip planning',
      },
      {
        name: 'Chat',
        description: 'AI-powered chat assistant for trip planning',
      },
      {
        name: 'Admin',
        description: 'Administrative endpoints (restricted access)',
      },
      {
        name: 'Upload',
        description: 'File upload and media management',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/login or /api/auth/refresh endpoints',
        },
        refreshToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Refresh-Token',
          description: 'Refresh token for obtaining new access tokens',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            code: {
              type: 'string',
              description: 'Error code for programmatic handling',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
            },
          },
          required: ['error'],
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              description: 'Success message',
            },
          },
          required: ['success'],
        },
        PaginationParams: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              default: 1,
              description: 'Page number',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: 'Items per page',
            },
            sortBy: {
              type: 'string',
              description: 'Field to sort by',
            },
            sortOrder: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'asc',
              description: 'Sort order',
            },
          },
        },
        PaginationResponse: {
          type: 'object',
          properties: {
            total: {
              type: 'integer',
              description: 'Total number of items',
            },
            page: {
              type: 'integer',
              description: 'Current page number',
            },
            limit: {
              type: 'integer',
              description: 'Items per page',
            },
            totalPages: {
              type: 'integer',
              description: 'Total number of pages',
            },
            hasNext: {
              type: 'boolean',
              description: 'Whether there is a next page',
            },
            hasPrev: {
              type: 'boolean',
              description: 'Whether there is a previous page',
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Authentication required',
                code: 'UNAUTHORIZED',
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Insufficient permissions to perform this action',
                code: 'FORBIDDEN',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Resource not found',
                code: 'NOT_FOUND',
              },
            },
          },
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: {
                  field: 'email',
                  message: 'Invalid email format',
                },
              },
            },
          },
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'An unexpected error occurred',
                code: 'INTERNAL_ERROR',
              },
            },
          },
        },
      },
    },
    'x-logo': {
      url: 'https://packrat.app/logo.png',
      altText: 'PackRat Logo',
    },
  });

  return app;
};
