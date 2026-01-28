import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, createTestUser } from './db-test-helper';
import { createDb } from '@packrat/api/db';
import { packs, packItems } from '@packrat/api/db/schema';
import type { Context } from 'hono';
import { createTools } from '@packrat/api/utils/ai/tools';

// Helper to extract first chunk from AsyncIterable response
async function getFirstChunk<T>(iterable: AsyncIterable<T>): Promise<T> {
  for await (const chunk of iterable) {
    return chunk;
  }
  throw new Error('Empty AsyncIterable');
}

describe('AI Tool: getPackDetails - Image Filtering Bug Fix', () => {
  let testContext: Context;
  let testUserId: number;
  let testPackId: string;

  beforeAll(async () => {
    testContext = await setupTestDatabase();
    testUserId = await createTestUser(testContext, {
      email: 'test-ai-tools@test.com',
      firstName: 'Test',
      lastName: 'User',
    });

    // Create a test pack with mixed items (some with images, some without)
    const db = createDb(testContext);
    testPackId = 'test-pack-ai-tools-123';

    // Create pack
    await db.insert(packs).values({
      id: testPackId,
      name: 'Test Pack for AI',
      description: 'Testing AI tool responses',
      category: 'hiking',
      userId: testUserId,
      isPublic: false,
      deleted: false,
      localCreatedAt: new Date(),
      localUpdatedAt: new Date(),
    });

    // Create pack items - mix of items with and without images
    await db.insert(packItems).values([
      {
        id: 'item-with-image-1',
        packId: testPackId,
        userId: testUserId,
        name: 'Tent with Image',
        description: 'A nice tent',
        weight: 2000,
        weightUnit: 'g',
        quantity: 1,
        category: 'shelter',
        consumable: false,
        worn: false,
        image: 'https://example.com/tent.jpg', // HAS IMAGE
        deleted: false,
      },
      {
        id: 'item-without-image-1',
        packId: testPackId,
        userId: testUserId,
        name: 'Sleeping Bag without Image',
        description: 'Warm sleeping bag',
        weight: 1500,
        weightUnit: 'g',
        quantity: 1,
        category: 'sleep',
        consumable: false,
        worn: false,
        image: null, // NO IMAGE
        deleted: false,
      },
      {
        id: 'item-with-image-2',
        packId: testPackId,
        userId: testUserId,
        name: 'Backpack with Image',
        description: 'Large backpack',
        weight: 1200,
        weightUnit: 'g',
        quantity: 1,
        category: 'gear',
        consumable: false,
        worn: true,
        image: 'https://example.com/backpack.jpg', // HAS IMAGE
        deleted: false,
      },
      {
        id: 'item-without-image-2',
        packId: testPackId,
        userId: testUserId,
        name: 'Water Filter without Image',
        description: 'Portable water filter',
        weight: 200,
        weightUnit: 'g',
        quantity: 1,
        category: 'water',
        consumable: false,
        worn: false,
        image: null, // NO IMAGE
        deleted: false,
      },
      {
        id: 'item-without-image-3',
        packId: testPackId,
        userId: testUserId,
        name: 'First Aid Kit without Image',
        description: 'Emergency first aid',
        weight: 300,
        weightUnit: 'g',
        quantity: 1,
        category: 'safety',
        consumable: false,
        worn: false,
        image: null, // NO IMAGE
        deleted: false,
      },
    ]);
  });

  afterAll(async () => {
    await teardownTestDatabase(testContext);
  });

  it('should return pack details with ALL items (with and without images)', async () => {
    const tools = createTools(testContext, testUserId);
    const getPackDetailsTool = tools.getPackDetails;

    // Execute the tool and iterate over AsyncIterable response
    const resultIterable = await getPackDetailsTool.execute({ packId: testPackId });
    const result = await getFirstChunk(resultIterable);

    // Verify success
    expect(result.success).toBe(true);
    if (!result.success) return; // Type guard

    // Verify all 5 items are returned
    expect(result.data.items).toHaveLength(5);

    // Verify items are returned without image field
    result.data.items.forEach((item: any) => {
      expect(item).not.toHaveProperty('image');
      expect(item).not.toHaveProperty('embedding');

      // Verify essential fields are present
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('weight');
      expect(item).toHaveProperty('category');
    });

    // Verify specific items are included
    const itemNames = result.data.items.map((item: any) => item.name);
    expect(itemNames).toContain('Tent with Image');
    expect(itemNames).toContain('Sleeping Bag without Image');
    expect(itemNames).toContain('Backpack with Image');
    expect(itemNames).toContain('Water Filter without Image');
    expect(itemNames).toContain('First Aid Kit without Image');
  });

  it('should treat items with and without images equally in the response structure', async () => {
    const tools = createTools(testContext, testUserId);
    const getPackDetailsTool = tools.getPackDetails;

    const resultIterable = await getPackDetailsTool.execute({ packId: testPackId });
    const result = await getFirstChunk(resultIterable);

    if (!result.success) {
      throw new Error('Tool execution failed');
    }

    // Find one item that originally had an image and one that didn't
    const tentItem = result.data.items.find((item: any) => item.name === 'Tent with Image');
    const waterFilterItem = result.data.items.find(
      (item: any) => item.name === 'Water Filter without Image',
    );

    // Both should have the same structure (no image field)
    expect(Object.keys(tentItem || {})).toEqual(Object.keys(waterFilterItem || {}));
  });

  it('should include correct metadata about items', async () => {
    const tools = createTools(testContext, testUserId);
    const getPackDetailsTool = tools.getPackDetails;

    const resultIterable = await getPackDetailsTool.execute({ packId: testPackId });
    const result = await getFirstChunk(resultIterable);

    if (!result.success) {
      throw new Error('Tool execution failed');
    }

    // Verify categories are correctly extracted
    expect(result.data.categories).toContain('shelter');
    expect(result.data.categories).toContain('sleep');
    expect(result.data.categories).toContain('water');
    expect(result.data.categories).toContain('safety');

    // Verify pack metadata is preserved
    expect(result.data.name).toBe('Test Pack for AI');
    expect(result.data.id).toBe(testPackId);
  });

  it('getPackItemDetails should also exclude image field', async () => {
    const tools = createTools(testContext, testUserId);
    const getPackItemDetailsTool = tools.getPackItemDetails;

    // Test with an item that has an image
    const resultIterableWithImage = await getPackItemDetailsTool.execute({
      itemId: 'item-with-image-1',
    });
    const resultWithImage = await getFirstChunk(resultIterableWithImage);

    if (!resultWithImage.success) {
      throw new Error('Tool execution failed');
    }

    expect(resultWithImage.data).not.toHaveProperty('image');
    expect(resultWithImage.data).not.toHaveProperty('embedding');
    expect(resultWithImage.data).toHaveProperty('name');
    expect(resultWithImage.data.name).toBe('Tent with Image');

    // Test with an item without an image
    const resultIterableWithoutImage = await getPackItemDetailsTool.execute({
      itemId: 'item-without-image-2',
    });
    const resultWithoutImage = await getFirstChunk(resultIterableWithoutImage);

    if (!resultWithoutImage.success) {
      throw new Error('Tool execution failed');
    }

    expect(resultWithoutImage.data).not.toHaveProperty('image');
    expect(resultWithoutImage.data).not.toHaveProperty('embedding');
    expect(resultWithoutImage.data).toHaveProperty('name');
    expect(resultWithoutImage.data.name).toBe('Water Filter without Image');
  });
});
