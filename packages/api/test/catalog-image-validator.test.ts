import { describe, expect, test } from 'bun:test';
import { detectImageMismatches } from '../../src/utils/catalogImageValidator';

// Mock the database
const mockCatalogItems = [
  {
    id: 1,
    name: 'Osprey Atmos AG 65 Backpack',
    categories: ['backpacks', 'gear'],
    images: ['https://example.com/backpack.jpg'],
  },
  {
    id: 2,
    name: 'Patagonia Nano Puff Jacket',
    categories: ['clothing', 'jackets'],
    images: ['https://example.com/jacket.jpg'],
  },
  {
    id: 3,
    name: 'REI Co-op Trail 40 Pack',
    categories: ['backpacks'],
    images: ['https://example.com/jacket-image.jpg'], // Mismatch!
  },
  {
    id: 4,
    name: 'North Face Down Jacket',
    categories: ['clothing'],
    images: ['https://example.com/backpack-gear.jpg'], // Mismatch!
  },
  {
    id: 5,
    name: 'Big Agnes Copper Spur Tent',
    categories: ['shelter'],
    images: ['https://example.com/tent.jpg'],
  },
];

describe('detectImageMismatches', () => {
  test('detects backpack with jacket image', async () => {
    const env = {} as any;
    
    // Mock the database response
    const originalSelect = jest.fn();
    jest.mock('../../src/db', () => ({
      createDbClient: () => ({
        select: () => ({
          from: () => ({
            where: () => Promise.resolve(mockCatalogItems),
          }),
        }),
      }),
    }));

    const mismatches = await detectImageMismatches(env);
    
    const backpackMismatch = mismatches.find(m => m.id === 3);
    expect(backpackMismatch).toBeDefined();
    expect(backpackMismatch?.issue).toBe('Backpack item shows jacket image');
  });

  test('detects jacket with backpack image', async () => {
    const env = {} as any;
    
    const mismatches = await detectImageMismatches(env);
    
    const jacketMismatch = mismatches.find(m => m.id === 4);
    expect(jacketMismatch).toBeDefined();
    expect(jacketMismatch?.issue).toBe('Jacket item shows backpack image');
  });

  test('does not flag correctly matched items', async () => {
    const env = {} as any;
    
    const mismatches = await detectImageMismatches(env);
    
    const correctBackpack = mismatches.find(m => m.id === 1);
    const correctJacket = mismatches.find(m => m.id === 2);
    const correctTent = mismatches.find(m => m.id === 5);
    
    expect(correctBackpack).toBeUndefined();
    expect(correctJacket).toBeUndefined();
    expect(correctTent).toBeUndefined();
  });
});
