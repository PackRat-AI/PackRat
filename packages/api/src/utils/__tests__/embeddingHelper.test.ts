import { describe, expect, it } from 'vitest';
import { getEmbeddingText } from '../embeddingHelper';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('embeddingHelper', () => {
  describe('getEmbeddingText', () => {
    it('generates embedding text from catalog item with basic fields', () => {
      const item = {
        name: 'Test Tent',
        description: 'A great tent for camping',
        brand: 'TestBrand',
        model: 'Pro 2000',
      };

      const result = getEmbeddingText(item);

      expect(result).toContain('Test Tent');
      expect(result).toContain('A great tent for camping');
      expect(result).toContain('TestBrand');
      expect(result).toContain('Pro 2000');
    });

    it('includes categories in embedding text', () => {
      const item = {
        name: 'Sleeping Bag',
        categories: ['camping', 'backpacking', 'cold-weather'],
      };

      const result = getEmbeddingText(item);

      expect(result).toContain('camping, backpacking, cold-weather');
    });

    it('includes pack item category in embedding text', () => {
      const item = {
        name: 'Water Filter',
        category: 'water-treatment',
      };

      const result = getEmbeddingText(item);

      expect(result).toContain('water-treatment');
    });

    it('includes variants in embedding text', () => {
      const item = {
        name: 'Jacket',
        variants: [
          { attribute: 'Size', values: ['S', 'M', 'L'] },
          { attribute: 'Color', values: ['Red', 'Blue'] },
        ],
      };

      const result = getEmbeddingText(item);

      expect(result).toContain('Size: S, M, L');
      expect(result).toContain('Color: Red, Blue');
    });

    it('includes techs in embedding text', () => {
      const item = {
        name: 'GPS Device',
        techs: {
          'Battery Life': '20 hours',
          'Waterproof': 'IPX7',
          'Weight': '200g',
        },
      };

      const result = getEmbeddingText(item);

      expect(result).toContain('Battery Life: 20 hours');
      expect(result).toContain('Waterproof: IPX7');
      expect(result).toContain('Weight: 200g');
    });

    it('includes color, size, and material', () => {
      const item = {
        name: 'Backpack',
        color: 'Green',
        size: '50L',
        material: 'Ripstop Nylon',
      };

      const result = getEmbeddingText(item);

      expect(result).toContain('Green');
      expect(result).toContain('50L');
      expect(result).toContain('Ripstop Nylon');
    });

    it('includes reviews in embedding text', () => {
      const item = {
        name: 'Hiking Boots',
        reviews: [
          { title: 'Great boots', text: 'Very comfortable and durable' },
          { title: 'Perfect fit', text: 'Excellent traction on trails' },
        ],
      };

      const result = getEmbeddingText(item);

      expect(result).toContain('Great boots Very comfortable and durable');
      expect(result).toContain('Perfect fit Excellent traction on trails');
    });

    it('includes QA content in embedding text', () => {
      const item = {
        name: 'Stove',
        qas: [
          {
            question: 'What fuel does it use?',
            answers: [{ a: 'Propane or butane' }, { a: 'Compatible with most canisters' }],
          },
        ],
      };

      const result = getEmbeddingText(item);

      expect(result).toContain('What fuel does it use?');
      expect(result).toContain('Propane or butane');
      expect(result).toContain('Compatible with most canisters');
    });

    it('includes FAQs in embedding text', () => {
      const item = {
        name: 'Water Bottle',
        faqs: [
          { question: 'Is it dishwasher safe?', answer: 'Yes, top rack only' },
          { question: 'What is the capacity?', answer: '1 liter' },
        ],
      };

      const result = getEmbeddingText(item);

      expect(result).toContain('Is it dishwasher safe? Yes, top rack only');
      expect(result).toContain('What is the capacity? 1 liter');
    });

    it('filters out falsy values', () => {
      const item = {
        name: 'Item',
        description: undefined,
        brand: null,
        model: '',
      };

      const result = getEmbeddingText(item);

      expect(result).toBe('Item');
    });

    it('falls back to existing item for missing fields', () => {
      const item = {
        name: 'Updated Name',
      };

      const existingItem = {
        name: 'Old Name',
        brand: 'ExistingBrand',
        model: 'Model123',
        categories: ['outdoor', 'gear'],
      };

      const result = getEmbeddingText(item, existingItem);

      expect(result).toContain('Updated Name');
      expect(result).toContain('ExistingBrand');
      expect(result).toContain('Model123');
      expect(result).toContain('outdoor, gear');
    });

    it('prefers new item values over existing item', () => {
      const item = {
        name: 'New Name',
        brand: 'NewBrand',
      };

      const existingItem = {
        name: 'Old Name',
        brand: 'OldBrand',
      };

      const result = getEmbeddingText(item, existingItem);

      expect(result).toContain('New Name');
      expect(result).toContain('NewBrand');
      expect(result).not.toContain('Old Name');
      expect(result).not.toContain('OldBrand');
    });

    it('returns empty string for completely empty item', () => {
      const result = getEmbeddingText({});
      expect(result).toBe('');
    });

    it('joins all fields with newlines', () => {
      const item = {
        name: 'Test',
        description: 'Description',
        brand: 'Brand',
      };

      const result = getEmbeddingText(item);
      const lines = result.split('\n');

      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('Test');
      expect(lines[1]).toBe('Description');
      expect(lines[2]).toBe('Brand');
    });
  });
});
