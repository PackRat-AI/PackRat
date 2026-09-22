import { describe, expect, it } from 'vitest';
import type { PackInStore } from '../../types';
import {
  buildPackItemInput,
  describeAddedItem,
  listUserPacksFromStore,
  prepareAddItemToPack,
} from '../chatPackTools';

function storePack(overrides: { id: string; name: string; deleted?: boolean }): PackInStore {
  return {
    description: null,
    category: 'hiking',
    isPublic: false,
    image: null,
    tags: null,
    deleted: false,
    ...overrides,
  };
}

const japanTrip = storePack({ id: 'p1', name: 'Japan Trip' });

const packs: Record<string, PackInStore> = {
  p1: japanTrip,
  p2: storePack({ id: 'p2', name: 'Ski Weekend' }),
  p3: storePack({ id: 'p3', name: 'Archived Trip', deleted: true }),
};

describe('listUserPacksFromStore', () => {
  it('resolves the pack named in the prompt to its id', () => {
    const result = listUserPacksFromStore({ packs, nameQuery: 'Japan Trip' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.map((p) => p.id)).toEqual(['p1']);
  });

  it('lists live packs when no query is given', () => {
    const result = listUserPacksFromStore({ packs });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.map((p) => p.name)).toEqual(['Japan Trip', 'Ski Weekend']);
  });

  it('succeeds with an empty list rather than failing when nothing matches', () => {
    // A miss must not read as a tool error — the model should be able to fall
    // back to listing everything and asking the user.
    const result = listUserPacksFromStore({ packs, nameQuery: 'Patagonia' });

    expect(result).toEqual({ success: true, data: [] });
  });
});

describe('buildPackItemInput', () => {
  it('defaults weight, unit, quantity and category when the model omits them', () => {
    expect(buildPackItemInput({ packId: 'p1', name: 'T-shirt' })).toEqual({
      name: 'T-shirt',
      weight: 0,
      weightUnit: 'g',
      quantity: 1,
      category: 'general',
      consumable: false,
      worn: false,
      notes: undefined,
      catalogItemId: undefined,
    });
  });

  it('keeps the values the model supplied', () => {
    const result = buildPackItemInput({
      packId: 'p1',
      name: 'Merino T-Shirt',
      weight: 150,
      weightUnit: 'g',
      quantity: 2,
      category: 'clothing',
      consumable: false,
      worn: true,
      notes: 'base layer',
      catalogItemId: '42',
    });

    expect(result).toMatchObject({
      name: 'Merino T-Shirt',
      weight: 150,
      weightUnit: 'g',
      quantity: 2,
      category: 'clothing',
      worn: true,
      notes: 'base layer',
      catalogItemId: 42,
    });
  });

  it('trims the item name and a whitespace-only category', () => {
    const result = buildPackItemInput({ packId: 'p1', name: '  T-shirt  ', category: '   ' });

    expect(result.name).toBe('T-shirt');
    expect(result.category).toBe('general');
  });

  it('clamps a zero, negative or fractional quantity to a whole count of at least one', () => {
    expect(buildPackItemInput({ packId: 'p1', name: 'x', quantity: 0 }).quantity).toBe(1);
    expect(buildPackItemInput({ packId: 'p1', name: 'x', quantity: -3 }).quantity).toBe(1);
    expect(buildPackItemInput({ packId: 'p1', name: 'x', quantity: 2.7 }).quantity).toBe(2);
  });

  it('drops a non-numeric catalog id instead of failing the add', () => {
    expect(
      buildPackItemInput({ packId: 'p1', name: 'x', catalogItemId: 'not-an-id' }).catalogItemId,
    ).toBeUndefined();
    expect(
      buildPackItemInput({ packId: 'p1', name: 'x', catalogItemId: '0' }).catalogItemId,
    ).toBeUndefined();
  });
});

describe('prepareAddItemToPack', () => {
  it('resolves the pack and builds the item payload', () => {
    const result = prepareAddItemToPack({
      packs,
      input: { packId: 'p1', name: 'T-shirt', weight: 150, weightUnit: 'g' },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.pack.name).toBe('Japan Trip');
    expect(result.data.itemData).toMatchObject({ name: 'T-shirt', weight: 150, quantity: 1 });
  });

  it('refuses an unknown pack id and tells the model how to recover', () => {
    const result = prepareAddItemToPack({ packs, input: { packId: 'nope', name: 'T-shirt' } });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('listUserPacks');
  });

  it('refuses a soft-deleted pack', () => {
    const result = prepareAddItemToPack({ packs, input: { packId: 'p3', name: 'T-shirt' } });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('p3');
  });

  it('refuses a blank item name', () => {
    const result = prepareAddItemToPack({ packs, input: { packId: 'p1', name: '   ' } });

    expect(result).toEqual({ success: false, error: 'An item name is required.' });
  });
});

describe('describeAddedItem', () => {
  it('names the pack back so the assistant can confirm the write', () => {
    const result = describeAddedItem({
      pack: japanTrip,
      item: {
        id: 'i1',
        name: 'T-shirt',
        quantity: 1,
        weight: 150,
        weightUnit: 'g',
        category: 'clothing',
      },
    });

    expect(result).toEqual({
      packId: 'p1',
      packName: 'Japan Trip',
      item: {
        id: 'i1',
        name: 'T-shirt',
        quantity: 1,
        weight: 150,
        weightUnit: 'g',
        category: 'clothing',
      },
    });
  });
});
