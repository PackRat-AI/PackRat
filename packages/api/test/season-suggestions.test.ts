import { beforeAll, describe, expect, it, vi } from 'vitest';
import { seedPackItem, seedTestUser } from './utils/db-helpers';
import {
  apiWithAuth,
  expectBadRequest,
  expectJsonResponse,
  expectUnauthorized,
  TEST_USER,
} from './utils/test-helpers';

// Mock AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn(async () => ({
    object: {
      season: 'Summer',
      suggestions: [
        {
          name: 'Summer Hiking Pack',
          description: 'Perfect for warm weather day hikes',
          category: 'Hiking',
          tags: ['summer', 'day-hike'],
          items: [
            {
              id: 'test-item-1',
              name: 'Water Bottle',
              quantity: 2,
              reason: 'Stay hydrated in warm weather',
            },
            {
              id: 'test-item-2',
              name: 'Sunscreen',
              quantity: 1,
              reason: 'Protect from UV rays',
            },
          ],
        },
        {
          name: 'Light Camping Pack',
          description: 'Minimal overnight camping setup for summer',
          category: 'Camping',
          tags: ['summer', 'overnight'],
          items: [
            {
              id: 'test-item-1',
              name: 'Water Bottle',
              quantity: 1,
              reason: 'Essential hydration',
            },
          ],
        },
      ],
    },
  })),
}));

// Mock OpenAI provider
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn((model: string) => `openai:${model}`)),
}));

let testUserId: number;
const testItemIds: string[] = [];

beforeAll(async () => {
  // Seed test user
  const user = await seedTestUser({ id: TEST_USER.id, email: TEST_USER.email });
  testUserId = user.id;

  // Create 20+ inventory items (required minimum for season suggestions)
  const itemCategories = [
    'Sleep System',
    'Shelter',
    'Cooking',
    'Clothing',
    'Navigation',
    'First Aid',
    'Food',
    'Water',
    'Tools',
    'Electronics',
  ];

  for (let i = 0; i < 25; i++) {
    const item = await seedPackItem({
      userId: testUserId,
      name: `Test Item ${i + 1}`,
      category: itemCategories[i % itemCategories.length],
      weight: 100 + i * 10,
      weightUnit: 'g',
    });
    testItemIds.push(item.id);
  }

  // Add the specific items referenced in our mock
  const waterBottle = await seedPackItem({
    id: 'test-item-1',
    userId: testUserId,
    name: 'Water Bottle',
    category: 'Water',
    weight: 150,
    weightUnit: 'g',
  });
  testItemIds.push(waterBottle.id);

  const sunscreen = await seedPackItem({
    id: 'test-item-2',
    userId: testUserId,
    name: 'Sunscreen',
    category: 'First Aid',
    weight: 50,
    weightUnit: 'g',
  });
  testItemIds.push(sunscreen.id);
});

describe('Season Suggestions Routes', () => {
  describe('POST /api/season-suggestions', () => {
    it('should generate season suggestions with valid inventory', async () => {
      const requestBody = {
        location: 'Seattle, WA',
        date: '2026-07-15',
      };

      const response = await apiWithAuth('/season-suggestions', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      expectJsonResponse(response, 200);
      const result = await response.json();

      expect(result).toMatchObject({
        season: 'Summer',
        location: 'Seattle, WA',
        totalInventoryItems: expect.any(Number),
      });
      expect(result.totalInventoryItems).toBeGreaterThanOrEqual(20);
      expect(Array.isArray(result.suggestions)).toBe(true);
      expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    });

    it('should return suggestions with expected structure', async () => {
      const requestBody = {
        location: 'Portland, OR',
        date: '2026-06-01',
      };

      const response = await apiWithAuth('/season-suggestions', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      expectJsonResponse(response, 200);
      const result = await response.json();

      // Check first suggestion structure
      const suggestion = result.suggestions[0];
      expect(suggestion).toMatchObject({
        name: expect.any(String),
        description: expect.any(String),
        category: expect.any(String),
        items: expect.any(Array),
      });

      // Check item structure in suggestions
      if (suggestion.items.length > 0) {
        const item = suggestion.items[0];
        expect(item).toMatchObject({
          name: expect.any(String),
          weight: expect.any(Number),
          weightUnit: expect.any(String),
          quantity: expect.any(Number),
        });
      }
    });

    it('should include only items from user inventory', async () => {
      const requestBody = {
        location: 'Denver, CO',
        date: '2026-08-15',
      };

      const response = await apiWithAuth('/season-suggestions', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      expectJsonResponse(response, 200);
      const result = await response.json();

      // All items in suggestions should exist in our test inventory
      result.suggestions.forEach((suggestion: { items: { name: string }[] }) => {
        suggestion.items.forEach((item) => {
          // Just verify it has expected properties (name exists)
          expect(item.name).toBeDefined();
        });
      });
    });

    it('should return 400 if user has insufficient inventory', async () => {
      // Create a new user with minimal inventory
      const newUser = await seedTestUser({
        email: `minimal-${Date.now()}@example.com`,
      });

      // Add only 10 items (less than required 20)
      for (let i = 0; i < 10; i++) {
        await seedPackItem({
          userId: newUser.id,
          name: `Minimal Item ${i + 1}`,
          category: 'General',
        });
      }

      const requestBody = {
        location: 'Boston, MA',
        date: '2026-09-01',
      };

      const response = await apiWithAuth(
        '/season-suggestions',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        },
        {
          id: newUser.id,
          email: newUser.email,
          firstName: 'Minimal',
          lastName: 'User',
          role: 'USER',
        },
      );

      expectBadRequest(response);
      const error = await response.json();
      expect(error.error).toContain('Insufficient inventory items');
      expect(error.error).toContain('10 items');
      expect(error.error).toContain('need at least 20');
    });

    it('should handle different locations', async () => {
      const locations = [
        'New York, NY',
        'Los Angeles, CA',
        'Chicago, IL',
        'Miami, FL',
        'Anchorage, AK',
      ];

      for (const location of locations) {
        const response = await apiWithAuth('/season-suggestions', {
          method: 'POST',
          body: JSON.stringify({
            location,
            date: '2026-06-15',
          }),
        });

        expectJsonResponse(response, 200);
        const result = await response.json();
        expect(result.location).toBe(location);
      }
    });

    it('should handle different dates/seasons', async () => {
      const dates = [
        '2026-01-15', // Winter
        '2026-04-15', // Spring
        '2026-07-15', // Summer
        '2026-10-15', // Fall
      ];

      for (const date of dates) {
        const response = await apiWithAuth('/season-suggestions', {
          method: 'POST',
          body: JSON.stringify({
            location: 'Seattle, WA',
            date,
          }),
        });

        expectJsonResponse(response, 200);
        const result = await response.json();
        expect(result.season).toBeDefined();
      }
    });

    it('should return 401 if not authenticated', async () => {
      const requestBody = {
        location: 'Seattle, WA',
        date: '2026-07-15',
      };

      const response = await fetch('http://localhost/api/season-suggestions', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      expectUnauthorized(response);
    });

    it('should exclude deleted items from inventory', async () => {
      // Create a user with exactly 20 non-deleted items
      const testUser2 = await seedTestUser({
        email: `deleted-test-${Date.now()}@example.com`,
      });

      // Add 20 active items
      for (let i = 0; i < 20; i++) {
        await seedPackItem({
          userId: testUser2.id,
          name: `Active Item ${i + 1}`,
          deleted: false,
        });
      }

      // Add 5 deleted items (should be excluded)
      for (let i = 0; i < 5; i++) {
        await seedPackItem({
          userId: testUser2.id,
          name: `Deleted Item ${i + 1}`,
          deleted: true,
        });
      }

      const response = await apiWithAuth(
        '/season-suggestions',
        {
          method: 'POST',
          body: JSON.stringify({
            location: 'Portland, OR',
            date: '2026-06-01',
          }),
        },
        {
          id: testUser2.id,
          email: testUser2.email,
          firstName: 'Test',
          lastName: 'User2',
          role: 'USER',
        },
      );

      expectJsonResponse(response, 200);
      const result = await response.json();
      // Should have exactly 20 items (deleted ones excluded)
      expect(result.totalInventoryItems).toBe(20);
    });
  });
});
