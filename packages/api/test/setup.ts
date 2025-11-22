const testEnv = {
  // Environment & Deployment
  ENVIRONMENT: 'development',
  SENTRY_DSN: 'https://test@test.ingest.sentry.io/test',
  CF_VERSION_METADATA: JSON.stringify({ id: 'test-version' }),

  // Database
  NEON_DATABASE_URL: 'postgres://test_user:test_password@localhost:5433/packrat_test',
  NEON_DATABASE_URL_READONLY: 'postgres://test_user:test_password@localhost:5433/packrat_test',

  // Authentication & Security
  JWT_SECRET: 'secret',
  PASSWORD_RESET_SECRET: 'secret',
  GOOGLE_CLIENT_ID: 'test-client-id',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'admin-password',
  PACKRAT_API_KEY: 'test-api-key',

  // Email Configuration
  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 'key',
  EMAIL_FROM: 'test@example.com',

  // AI & External APIs
  OPENAI_API_KEY: 'sk-test-key',
  AI_PROVIDER: 'openai',
  PERPLEXITY_API_KEY: 'pplx-test-key',

  // Weather Services
  OPENWEATHER_KEY: 'test-weather-key',
  WEATHER_API_KEY: 'test-weather-key',

  // Cloudflare R2 Storage
  CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
  CLOUDFLARE_AI_GATEWAY_ID: 'test-gateway-id',
  R2_ACCESS_KEY_ID: 'test-access-key',
  R2_SECRET_ACCESS_KEY: 'test-secret-key',
  PACKRAT_BUCKET_R2_BUCKET_NAME: 'test-bucket',
  PACKRAT_GUIDES_BUCKET_R2_BUCKET_NAME: 'test-guides-bucket',
  PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME: 'test-scrapy-bucket',

  // Content & Guides
  PACKRAT_GUIDES_RAG_NAME: 'test-rag',
  PACKRAT_GUIDES_BASE_URL: 'https://guides.test.com',
};

import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, vi } from 'vitest';
import * as schema from '../src/db/schema';

let testClient: Client;
let testDb: ReturnType<typeof drizzle>;
let isConnected = false;

// Mock AWS SDK S3Client to prevent actual network calls
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://mock-signed-url.com/test.jpg'),
}));

vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: vi.fn().mockImplementation(() => ({
      send: vi.fn(),
      config: {
        endpointProvider: vi.fn(),
      },
    })),
    ListObjectsV2Command: vi.fn(),
    GetObjectCommand: vi.fn(),
    HeadObjectCommand: vi.fn(),
    PutObjectCommand: vi.fn(),
    DeleteObjectCommand: vi.fn(),
    DeleteObjectsCommand: vi.fn(),
    CreateMultipartUploadCommand: vi.fn(),
    UploadPartCommand: vi.fn(),
    CompleteMultipartUploadCommand: vi.fn(),
    AbortMultipartUploadCommand: vi.fn(),
  };
});

// Mock AI Services
vi.mock('@packrat/api/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@packrat/api/services')>();
  return {
    ...actual,
    ImageDetectionService: class MockImageDetectionService {
      async detectAndMatchItems(_imageUrl: string, _matchLimit?: number) {
        return {
          detectedItems: [
            {
              label: 'backpack',
              confidence: 0.9,
              matches: [],
            },
          ],
          summary: 'Detected a backpack.',
        };
      }
    },
    AIService: class MockAIService {
      async perplexitySearch(_query: string) {
        return {
          answer: 'Mock search result',
          sources: [],
        };
      }

      async queryGuidesRAG(_query: string) {
        return {
          answer: 'Mock guide information',
          sources: [],
        };
      }
    },
  };
});

// Mock the AI SDK modules before any imports
vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    streamText: vi.fn(({ messages }) => {
      // Create a mock stream response
      const mockResponse = `Mock AI response for: ${messages?.[messages.length - 1]?.content || 'query'}`;

      return {
        toUIMessageStreamResponse: () => {
          // Return a mock Response with streaming
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            start(controller) {
              // Send mock streaming data
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'text', content: mockResponse })}\n\n`,
                ),
              );
              controller.close();
            },
          });

          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            },
          });
        },
      };
    }),
  };
});

// Mock the AI provider module
vi.mock('@packrat/api/utils/ai/provider', () => ({
  createAIProvider: vi.fn(() => {
    // Return a mock provider function
    return (modelId: string) => ({
      modelId,
      provider: 'openai',
    });
  }),
  extractCloudflareLogId: vi.fn(() => null),
}));

// Mock the AI tools module - need to mock before the import happens
vi.mock('@packrat/api/utils/ai/tools', () => ({
  createTools: vi.fn(() => ({})),
}));

// Mock schema info utility
vi.mock('@packrat/api/utils/DbUtils', () => ({
  getSchemaInfo: vi.fn(async () => 'Mock schema info'),
}));

// Mock guides data
const mockGuides = [
  {
    key: 'beginner-hiking-guide.md',
    title: 'Beginner Hiking Guide',
    category: 'hiking',
    categories: ['hiking', 'beginner'],
    description: 'A comprehensive guide for beginner hikers',
    author: 'PackRat Team',
    difficulty: 'beginner',
    readingTime: 5,
    content: '# Beginner Hiking Guide\n\nThis is a guide for beginners...',
  },
  {
    key: 'backpacking-essentials.md',
    title: 'Backpacking Essentials',
    category: 'backpacking',
    categories: ['backpacking', 'gear'],
    description: 'Essential gear for backpacking trips',
    author: 'Outdoor Expert',
    difficulty: 'intermediate',
    readingTime: 8,
    content: '# Backpacking Essentials\n\nEssential gear includes...',
  },
  {
    key: 'winter-camping-tips.md',
    title: 'Winter Camping Tips',
    category: 'camping',
    categories: ['camping', 'winter'],
    description: 'Tips for safe winter camping',
    author: 'Winter Expert',
    difficulty: 'advanced',
    readingTime: 10,
    content: '# Winter Camping Tips\n\nWinter camping requires...',
  },
];

// Create mock R2 objects with proper metadata
function createMockR2Object(guide: (typeof mockGuides)[0]) {
  return {
    key: guide.key,
    version: 'v1',
    size: guide.content.length,
    etag: 'mock-etag',
    httpEtag: '"mock-etag"',
    checksums: {
      toJSON: () => ({}),
    },
    uploaded: new Date('2024-01-01'),
    customMetadata: {
      title: guide.title,
      category: guide.category,
      description: guide.description,
    },
    storageClass: 'STANDARD',
    writeHttpMetadata: () => {},
  };
}

// Create mock R2 object body with content
function createMockR2ObjectBody(guide: (typeof mockGuides)[0]) {
  const frontmatter = `---
title: ${guide.title}
category: ${guide.category}
categories: ${JSON.stringify(guide.categories)}
description: ${guide.description}
author: ${guide.author}
difficulty: ${guide.difficulty}
readingTime: ${guide.readingTime}
---

${guide.content}`;

  const encoder = new TextEncoder();
  const bytes = encoder.encode(frontmatter);

  return {
    ...createMockR2Object(guide),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    bodyUsed: false,
    arrayBuffer: async () => bytes.buffer as ArrayBuffer,
    bytes: async () => bytes,
    text: async () => frontmatter,
    json: async () => JSON.parse(frontmatter),
    blob: async () => new Blob([bytes]),
  };
}

// Mock R2 bucket service
vi.mock('@packrat/api/services/r2-bucket', () => {
  return {
    R2BucketService: vi.fn().mockImplementation(() => {
      return {
        list: vi.fn(async (options?: { prefix?: string; limit?: number }) => {
          let objects = mockGuides.map((guide) => createMockR2Object(guide));

          // Apply prefix filter if provided
          if (options?.prefix) {
            const prefix = options.prefix;
            objects = objects.filter((obj) => obj.key.startsWith(prefix));
          }

          // Apply limit if provided
          if (options?.limit) {
            objects = objects.slice(0, options.limit);
          }

          return {
            objects,
            truncated: false,
            delimitedPrefixes: [],
          };
        }),

        get: vi.fn(async (key: string) => {
          const guide = mockGuides.find((g) => g.key === key);
          if (!guide) {
            return null;
          }
          return createMockR2ObjectBody(guide);
        }),

        head: vi.fn(async (key: string) => {
          const guide = mockGuides.find((g) => g.key === key);
          if (!guide) {
            return null;
          }
          return createMockR2Object(guide);
        }),

        put: vi.fn(async (key: string, _value: unknown, _options?: unknown) => {
          return createMockR2Object({
            key,
            title: key.replace(/\.(mdx?|md)$/, ''),
            category: 'general',
            categories: ['general'],
            description: 'Mock guide',
            author: 'Test Author',
            difficulty: 'beginner',
            readingTime: 5,
            content: 'Mock content',
          });
        }),

        delete: vi.fn(async (_keys: string | string[]) => {
          // Mock deletion - no-op
        }),
      };
    }),
  };
});

vi.mock('hono/adapter', async () => {
  const actual = await vi.importActual<typeof import('hono/adapter')>('hono/adapter');
  return { ...actual, env: () => testEnv };
});

// Mock google-auth-library to avoid node:child_process issues in Workers environment
vi.mock('google-auth-library', () => ({
  OAuth2Client: class MockOAuth2Client {
    async verifyIdToken() {
      return {
        getPayload: () => ({
          sub: 'mock-google-id',
          email: 'test@gmail.com',
          name: 'Test User',
          email_verified: true,
        }),
      };
    }
  },
}));

// Mock the embedding service to avoid calling OpenAI API in tests
vi.mock('@packrat/api/services/embeddingService', () => ({
  generateEmbedding: vi.fn(async () => {
    // Return a mock embedding (1536 dimensions for OpenAI)
    return Array.from({ length: 1536 }, () => Math.random());
  }),
  generateManyEmbeddings: vi.fn(async (params: { values: string[] }) => {
    // Return mock embeddings for each value
    return params.values.map(() => Array.from({ length: 1536 }, () => Math.random()));
  }),
}));

// Mock the ETL queue service to avoid Cloudflare Queue issues in tests
vi.mock('@packrat/api/services/etl/queue', () => ({
  queueCatalogETL: vi.fn(async ({ jobId }: { jobId: string }) => {
    // Mock successful queueing
    return jobId;
  }),
  processQueueBatch: vi.fn(async () => {
    // Mock successful processing
    return;
  }),
}));

vi.mock('@packrat/api/utils/env-validation', () => ({
  getEnv: vi.fn(() => ({
    ...testEnv,
    ETL_QUEUE: {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined),
    },
    PACKRAT_BUCKET: {
      delete: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue({
        key: 'mock-key',
        checksums: {
          toJSON: () => ({}),
        },
      }),
      get: vi.fn().mockResolvedValue(null),
      head: vi.fn().mockResolvedValue(null),
    },
  })),
}));

// Mock the database module to use our test database (node-postgres version)
vi.mock('@packrat/api/db', () => ({
  createDb: vi.fn(() => testDb),
  createReadOnlyDb: vi.fn(() => testDb),
  createDbClient: vi.fn(() => testDb),
}));

// Setup PostgreSQL connection for tests
beforeAll(async () => {
  console.log('🔧 Setting up test database connection...');

  // Create direct PostgreSQL client connection for manual database operations
  testClient = new Client({
    host: 'localhost',
    port: 5433,
    database: 'packrat_test',
    user: 'test_user',
    password: 'test_password',
  });

  try {
    await testClient.connect();
    testDb = drizzle(testClient, { schema }) as any;
    isConnected = true;
    console.log('✅ Test database connected successfully');
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error);
    throw error;
  }
});

// Clean up database after each test to ensure isolation
beforeEach(async () => {
  if (!testClient) return;

  // Delete from tables in reverse dependency order to avoid foreign key violations
  // This is safer than TRUNCATE CASCADE and less prone to deadlocks
  const tablesToClean = [
    'weight_history',
    'verification_codes',
    'password_reset_codes',
    'weather_cache',
    'pack_items',
    'pack_template_items',
    'packs',
    'pack_templates',
    'user_items',
    'catalog_items',
    'users',
  ];

  try {
    // Delete in a single transaction for atomicity
    await testClient.query('BEGIN');
    for (const table of tablesToClean) {
      await testClient.query(`DELETE FROM "${table}"`);
    }
    await testClient.query('COMMIT');
  } catch (_error) {
    await testClient.query('ROLLBACK');
    // Ignore errors - tables might not exist yet
  }
});

// Cleanup after all tests
afterAll(async () => {
  console.log('🧹 Cleaning up test database connection...');

  try {
    // Close PostgreSQL client connection only if it was successfully connected
    if (isConnected && testClient) {
      await testClient.end();
    }
    console.log('✅ Test database connection closed');
  } catch (error) {
    console.error('❌ Failed to cleanup test database connection:', error);
  }
});
