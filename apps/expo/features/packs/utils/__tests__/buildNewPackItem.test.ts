import { describe, expect, it } from 'vitest';
import type { PackItemInput } from '../../types';
import { buildNewPackItem } from '../buildNewPackItem';

const baseInput: PackItemInput = {
  name: 'T-shirt',
  weight: 150,
  weightUnit: 'g',
  quantity: 1,
  category: 'clothing',
  consumable: false,
  worn: false,
};

describe('buildNewPackItem', () => {
  it('builds a live, non-AI-flagged item bound to the pack', () => {
    const item = buildNewPackItem({ id: 'i1', packId: 'p1', itemData: baseInput });

    expect(item).toEqual({
      id: 'i1',
      packId: 'p1',
      name: 'T-shirt',
      description: undefined,
      weight: 150,
      weightUnit: 'g',
      quantity: 1,
      category: 'clothing',
      consumable: false,
      worn: false,
      notes: undefined,
      image: undefined,
      catalogItemId: undefined,
      isAIGenerated: false,
      deleted: false,
    });
  });

  it('falls back to the general category when none is given', () => {
    for (const category of [undefined, '']) {
      const item = buildNewPackItem({
        id: 'i1',
        packId: 'p1',
        itemData: { ...baseInput, category },
      });
      expect(item.category).toBe('general');
    }
  });

  it('normalises a null description to undefined', () => {
    const item = buildNewPackItem({
      id: 'i1',
      packId: 'p1',
      itemData: { ...baseInput, description: null },
    });

    expect(item.description).toBeUndefined();
  });

  it('carries optional fields through when supplied', () => {
    const item = buildNewPackItem({
      id: 'i1',
      packId: 'p1',
      itemData: {
        ...baseInput,
        description: 'base layer',
        notes: 'packed last',
        image: 'cached.jpg',
        catalogItemId: 42,
        consumable: true,
        worn: true,
        quantity: 3,
      },
    });

    expect(item).toMatchObject({
      description: 'base layer',
      notes: 'packed last',
      image: 'cached.jpg',
      catalogItemId: 42,
      consumable: true,
      worn: true,
      quantity: 3,
    });
  });
});
