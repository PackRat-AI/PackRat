import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { R2BucketService } from '@packrat/api/services/r2-bucket';
import {
  api,
  apiWithAuth,
  expectBadRequest,
  expectJsonResponse,
  expectNotFound,
  expectUnauthorized,
  httpMethods,
} from './utils/test-helpers';

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

// Mock the R2BucketService module
vi.mock('@packrat/api/services/r2-bucket', () => {
  return {
    R2BucketService: class MockR2BucketService {
      constructor() {
        // No-op constructor - don't create S3Client
      }

      async list(options?: { prefix?: string; limit?: number }) {
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
      }

      async get(key: string) {
        const guide = mockGuides.find((g) => g.key === key);
        if (!guide) {
          return null;
        }
        return createMockR2ObjectBody(guide);
      }

      async head(key: string) {
        const guide = mockGuides.find((g) => g.key === key);
        if (!guide) {
          return null;
        }
        return createMockR2Object(guide);
      }

      async put(key: string, _value: unknown, _options?: unknown) {
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
      }

      async delete(_keys: string | string[]) {
        // Mock deletion - no-op
      }
    } as unknown as typeof R2BucketService,
  };
});

// Guides routes with mocked R2 bucket service
describe('Guides Routes', () => {
  describe('Authentication', () => {
    it('GET /guides requires auth', async () => {
      const res = await api('/guides', httpMethods.get(''));
      expectUnauthorized(res);
    });

    it('GET /guides/categories requires auth', async () => {
      const res = await api('/guides/categories', httpMethods.get(''));
      expectUnauthorized(res);
    });

    it('GET /guides/search requires auth', async () => {
      const res = await api('/guides/search', httpMethods.get(''));
      expectUnauthorized(res);
    });

    it('GET /guides/:id requires auth', async () => {
      const res = await api('/guides/1', httpMethods.get(''));
      expectUnauthorized(res);
    });
  });

  describe('GET /guides', () => {
    it('returns guides list', async () => {
      const res = await apiWithAuth('/guides');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.items).toBeDefined();
      expect(Array.isArray(data.items)).toBe(true);
    });

    it('accepts pagination parameters', async () => {
      const res = await apiWithAuth('/guides?page=1&limit=10');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts category filter', async () => {
      const res = await apiWithAuth('/guides?category=backpacking');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts difficulty filter', async () => {
      const res = await apiWithAuth('/guides?difficulty=beginner');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts sorting parameters', async () => {
      const res = await apiWithAuth('/guides?sortBy=title&sortOrder=asc');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts featured filter', async () => {
      const res = await apiWithAuth('/guides?featured=true');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });
  });

  describe('GET /guides/categories', () => {
    it('returns available guide categories', async () => {
      const res = await apiWithAuth('/guides/categories');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data) || data.categories).toBeTruthy();
    });

    it('includes category metadata', async () => {
      const res = await apiWithAuth('/guides/categories');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      if (Array.isArray(data) && data.length > 0) {
        const category = data[0];
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('slug');
      }
    });
  });

  describe('GET /guides/search', () => {
    it('searches guides with query parameter', async () => {
      const res = await apiWithAuth('/guides/search?q=hiking');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.items).toBeDefined();
      expect(Array.isArray(data.items)).toBe(true);
    });

    it('requires query parameter', async () => {
      const res = await apiWithAuth('/guides/search');
      expectBadRequest(res);

      const data = await res.json();
      expect(data.error || data.message).toBeTruthy();
    });

    it('accepts search filters', async () => {
      const res = await apiWithAuth('/guides/search?q=tent&category=gear&difficulty=intermediate');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('accepts pagination for search results', async () => {
      const res = await apiWithAuth('/guides/search?q=backpacking&page=1&limit=5');

      expect(res.status).toBe(200);
      await expectJsonResponse(res);
    });

    it('handles empty search results', async () => {
      const res = await apiWithAuth('/guides/search?q=veryrareunlikelyterm12345');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.items).toBeDefined();
      expect(data.items.length).toBe(0);
    });
  });

  describe('GET /guides/:id', () => {
    it('returns single guide by ID', async () => {
      // Use actual guide key from mock data
      const res = await apiWithAuth('/guides/beginner-hiking-guide');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['id', 'title']);
      expect(data.id).toBeDefined();
      expect(data.title).toBeDefined();
    });

    it('returns guide with content', async () => {
      const res = await apiWithAuth('/guides/beginner-hiking-guide');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.content).toBeDefined();
    });

    it('returns guide metadata', async () => {
      const res = await apiWithAuth('/guides/beginner-hiking-guide');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      // Common guide metadata fields
      expect(data.title).toBeDefined();
      expect(data.category || data.categories).toBeDefined();
    });

    it('returns 404 for non-existent guide', async () => {
      const res = await apiWithAuth('/guides/999999');
      expectNotFound(res);
    });

    it('validates ID parameter', async () => {
      const res = await apiWithAuth('/guides/invalid-id');
      expect([400, 404]).toContain(res.status);
    });
  });

  describe('GET /guides/:slug (if slug-based routing exists)', () => {
    it('returns guide by slug', async () => {
      const res = await apiWithAuth('/guides/backpacking-essentials');

      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res, ['id', 'title']);
      expect(data.title).toBeDefined();
    });

    it('returns 404 for non-existent slug', async () => {
      const res = await apiWithAuth('/guides/non-existent-guide-slug');
      expectNotFound(res);
    });
  });

  describe('Error Handling', () => {
    it('handles malformed requests gracefully', async () => {
      const res = await apiWithAuth('/guides?page=invalid&limit=notanumber');

      // Should either return 400 or default to valid pagination
      expect([200, 400]).toContain(res.status);
      if (res.status === 400) {
        expectBadRequest(res);
      }
    });

    it('handles invalid category filters', async () => {
      const res = await apiWithAuth('/guides?category=nonexistent-category');

      // Should return empty results or 200, not crash
      expect(res.status).toBe(200);
      const data = await expectJsonResponse(res);
      expect(data.items).toBeDefined();
      expect(Array.isArray(data.items)).toBe(true);
      // May or may not have results depending on implementation
    });
  });
});
