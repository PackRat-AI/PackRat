import { neonConfig, Pool } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { afterAll, beforeAll, beforeEach, vi } from 'vitest';
import * as schema from '../src/db/schema';
import { clearCurrentTestUsers } from './utils/test-helpers';

// Route @neondatabase/serverless through the local wsproxy (docker-compose.test.yml),
// so tests use the same driver as production against Docker Postgres.
// wsproxy upgrades on /v1 and reads the target from ?address= (resolved inside the
// compose network, so `postgres-test:5432` is the service name).
neonConfig.wsProxy = () => 'localhost:5434/v1?address=postgres-test:5432';
neonConfig.useSecureWebSocket = false;
neonConfig.pipelineConnect = false;
neonConfig.pipelineTLS = false;

const testEnv = {
  ENVIRONMENT: 'development',
  SENTRY_DSN: 'https://test@test.ingest.sentry.io/test',
  CF_VERSION_METADATA: JSON.stringify({ id: 'test-version' }),

  NEON_DATABASE_URL: 'postgres://test_user:test_password@localhost:5432/packrat_test',
  NEON_DATABASE_URL_READONLY: 'postgres://test_user:test_password@localhost:5432/packrat_test',

  JWT_SECRET: 'secret',
  PASSWORD_RESET_SECRET: 'secret',
  GOOGLE_CLIENT_ID: 'test-client-id',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'admin-password',
  PACKRAT_API_KEY: 'test-api-key',

  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 'key',
  EMAIL_FROM: 'test@example.com',

  OPENAI_API_KEY: 'sk-test-key',
  GOOGLE_GENERATIVE_AI_API_KEY: 'test-google-key',
  AI_PROVIDER: 'openai',
  PERPLEXITY_API_KEY: 'pplx-test-key',

  OPENWEATHER_KEY: 'test-weather-key',
  WEATHER_API_KEY: 'test-weather-key',

  CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
  CLOUDFLARE_AI_GATEWAY_ID: 'test-gateway-id',
  R2_ACCESS_KEY_ID: 'test-access-key',
  R2_SECRET_ACCESS_KEY: 'test-secret-key',
  PACKRAT_BUCKET_R2_BUCKET_NAME: 'test-bucket',
  PACKRAT_GUIDES_BUCKET_R2_BUCKET_NAME: 'test-guides-bucket',
  PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME: 'test-scrapy-bucket',

  PACKRAT_GUIDES_RAG_NAME: 'test-rag',
  PACKRAT_GUIDES_BASE_URL: 'https://guides.test.com',
};

let testPool: Pool;
let testDb: ReturnType<typeof drizzle>;
let isConnected = false;

// Mock AWS SDK S3Client to prevent actual network calls
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://mock-signed-url.com/test.jpg'),
}));

vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: vi.fn(function (this: unknown) {
      return {
        send: vi.fn(),
        config: {
          endpointProvider: vi.fn(),
        },
      };
    }),
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

// Mock the AI SDK modules before any imports. generateObject is also stubbed
// globally (default return is shaped for pack-template extraction) so routes
// that use it (generateFromOnlineContent, packService) don't hit real OpenAI.
vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    generateObject: vi.fn(() =>
      Promise.resolve({
        object: {
          templateName: 'Hiking Essentials',
          templateCategory: 'hiking',
          templateDescription: 'Essential gear for a day hike',
          items: [
            {
              name: 'Backpack',
              description: 'Day hiking backpack, 20L capacity',
              quantity: 1,
              category: 'Packs',
              weightGrams: 500,
              consumable: false,
              worn: false,
            },
            {
              name: 'Water Bottle',
              description: 'Reusable water bottle, 1L',
              quantity: 2,
              category: 'Hydration',
              weightGrams: 150,
              consumable: false,
              worn: false,
            },
          ],
        },
      }),
    ),
    streamText: vi.fn(({ messages }) => {
      const mockResponse = `Mock AI response for: ${messages?.[messages.length - 1]?.content || 'query'}`;

      return {
        toUIMessageStreamResponse: () => {
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            start(controller) {
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

vi.mock('@packrat/api/utils/ai/provider', () => ({
  createAIProvider: vi.fn(() => {
    return (modelId: string) => ({
      modelId,
      provider: 'openai',
    });
  }),
  extractCloudflareLogId: vi.fn(() => null),
}));

vi.mock('@packrat/api/utils/ai/tools', () => ({
  createTools: vi.fn(() => ({})),
}));

vi.mock('@packrat/api/utils/DbUtils', () => ({
  getSchemaInfo: vi.fn(async () => 'Mock schema info'),
}));

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

vi.mock('@packrat/api/services/r2-bucket', () => {
  return {
    R2BucketService: vi.fn(function (this: unknown) {
      return {
        list: vi.fn(async (options?: { prefix?: string; limit?: number }) => {
          let objects = mockGuides.map((guide) => createMockR2Object(guide));

          if (options?.prefix) {
            const prefix = options.prefix;
            objects = objects.filter((obj) => obj.key.startsWith(prefix));
          }

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

        delete: vi.fn(async (_keys: string | string[]) => {}),
      };
    }),
  };
});

vi.mock('hono/adapter', async () => {
  const actual = await vi.importActual<typeof import('hono/adapter')>('hono/adapter');
  return { ...actual, env: () => testEnv };
});

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

vi.mock('@packrat/api/services/embeddingService', () => ({
  generateEmbedding: vi.fn(async () => {
    return Array.from({ length: 1536 }, () => Math.random());
  }),
  generateManyEmbeddings: vi.fn(async (params: { values: string[] }) => {
    return params.values.map(() => Array.from({ length: 1536 }, () => Math.random()));
  }),
}));

vi.mock('@packrat/api/services/etl/queue', () => ({
  queueCatalogETL: vi.fn(async ({ jobId }: { jobId: string }) => {
    return jobId;
  }),
  processQueueBatch: vi.fn(async () => {
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

vi.mock('@packrat/api/db', () => ({
  createDb: vi.fn(() => testDb),
  createReadOnlyDb: vi.fn(() => testDb),
  createDbClient: vi.fn(() => testDb),
}));

vi.mock('youtube-transcript', () => ({
  fetchTranscript: vi.fn().mockResolvedValue([]),
}));

// Global @cloudflare/containers mock — the real getContainer calls
// binding.idFromName() which throws on the undefined APP_CONTAINER binding in
// tests. Test files assign setMockContainerFetch() to override the default
// response per test (e.g. for duplicate-contentId cases). Must be global
// because singleWorker: true shares the module cache across test files, so
// any file that imports @cloudflare/containers before this mock registers
// would otherwise get the real implementation.
vi.mock('@cloudflare/containers', () => ({
  Container: class MockContainer {},
  getContainer: vi.fn(() => ({
    fetch: (req: Request) =>
      (
        globalThis as unknown as { __mockContainerFetch?: (req: Request) => Promise<Response> }
      ).__mockContainerFetch?.(req) ??
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              imageUrls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
              caption: 'Default test caption',
              contentId: 'default-test-content-id',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
  })),
}));

// toucan-js@4.1.1 → @sentry/core@8.9.2 has dual ESM/CJS exports that miniflare mis-resolves;
// upstream fix lands in @hono/sentry >1.2.2 (not yet released 2026-04).
vi.mock('@hono/sentry', () => ({
  sentry: () => async (c: any, next: any) => {
    c.set('sentry', {
      setUser: () => {},
      captureException: () => {},
      captureMessage: () => {},
      addBreadcrumb: () => {},
      setTag: () => {},
      setContext: () => {},
      setExtra: () => {},
    });
    await next();
  },
  getSentry: (c: any) => c.get('sentry'),
}));

beforeAll(async () => {
  console.log('🔧 Setting up test database connection...');

  testPool = new Pool({
    connectionString: testEnv.NEON_DATABASE_URL,
  });

  try {
    testDb = drizzle(testPool, { schema }) as any;
    // Warm-up query to verify connectivity
    await testPool.query('SELECT 1');
    isConnected = true;
    console.log('✅ Test database connected successfully');
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error);
    throw error;
  }
});

beforeEach(async () => {
  if (!testDb) return;

  clearCurrentTestUsers();

  // Route cleanup through testDb (same drizzle handle as inserts) instead of
  // testPool.query, so cleanup and tests share one path. Surface errors rather
  // than swallowing them.
  const tablesToClean = [
    'one_time_passwords',
    'refresh_tokens',
    'auth_providers',
    'weight_history',
    'pack_items',
    'pack_template_items',
    'packs',
    'pack_templates',
    'trail_condition_reports',
    'catalog_item_etl_jobs',
    'etl_jobs',
    'catalog_items',
    'invalid_item_logs',
    'reported_content',
    'comment_likes',
    'post_likes',
    'post_comments',
    'posts',
    'trips',
    'users',
  ];

  const tableList = tablesToClean.map((t) => `"${t}"`).join(', ');
  await testDb.execute(sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`));
});

afterAll(async () => {
  console.log('🧹 Cleaning up test database connection...');

  try {
    if (isConnected && testPool) {
      await testPool.end();
    }
    console.log('✅ Test database connection closed');
  } catch (error) {
    console.error('❌ Failed to cleanup test database connection:', error);
  }
});
