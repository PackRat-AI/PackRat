import { vi } from 'vitest';

// Mock R2 objects for testing
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
function createMockR2Object(guide: typeof mockGuides[0]) {
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
function createMockR2ObjectBody(guide: typeof mockGuides[0]) {
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

// Setup R2 bucket mocks
export function setupR2Mocks() {
  vi.mock('@packrat/api/services/r2-bucket', () => {
    return {
      R2BucketService: vi.fn().mockImplementation(() => {
        return {
          list: vi.fn(async (options?: { prefix?: string; limit?: number }) => {
            let objects = mockGuides.map((guide) => createMockR2Object(guide));
            
            // Apply prefix filter if provided
            if (options?.prefix) {
              objects = objects.filter((obj) => obj.key.startsWith(options.prefix));
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
}

// Reset R2 mocks
export function resetR2Mocks() {
  vi.clearAllMocks();
}

// Helper to get mock guide data for tests
export function getMockGuides() {
  return mockGuides;
}

// Helper to add a mock guide
export function addMockGuide(guide: {
  key: string;
  title: string;
  category: string;
  content: string;
}) {
  mockGuides.push({
    ...guide,
    categories: [guide.category],
    description: `Description for ${guide.title}`,
    author: 'Test Author',
    difficulty: 'beginner',
    readingTime: 5,
  });
}
