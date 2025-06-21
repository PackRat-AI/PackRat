import type { CatalogItem, PackItem, WeightUnit } from '~/types';

/**
 * Checks if an item is a pack item
 */
export function isPackItem(item: CatalogItem | PackItem): item is PackItem {
  return 'packId' in item && item.packId !== undefined;
}

/**
 * Gets the effective weight of an item
 */
export function getEffectiveWeight(item: CatalogItem | PackItem): number {
  if (isPackItem(item)) {
    return item.weight;
  }
  return 'defaultWeight' in item ? item.defaultWeight : 0;
}

/**
 * Gets the quantity of an item
 */
export function getQuantity(item: CatalogItem | PackItem): number {
  return isPackItem(item) ? item.quantity : 1;
}

/**
 * Gets the weight unit of an item
 */
export function getWeightUnit(item: CatalogItem | PackItem): WeightUnit {
  return isPackItem(item) ? item.weightUnit : 'g';
}

/** Gets the notes of an item */
export function getNotes(item: CatalogItem | PackItem): string | undefined {
  return isPackItem(item) ? item.notes : undefined;
}

/**
 * Calculates the total weight of an item (weight × quantity)
 */
export function calculateTotalWeight(item: CatalogItem | PackItem): number {
  return getEffectiveWeight(item) * getQuantity(item);
}

/**
 * Checks if an item is consumable
 */
export function isConsumable(item: CatalogItem | PackItem): boolean {
  return 'consumable' in item && item.consumable;
}

/**
 * Checks if quantity should be shown for an item
 */
export function shouldShowQuantity(item: CatalogItem | PackItem): boolean {
  return isPackItem(item) && 'quantity' in item;
}

/**
 * Checks if an item is worn
 */
export function isWorn(item: CatalogItem | PackItem): boolean {
  return 'worn' in item && item.worn;
}

/**
 * Check if the item has a notes field
 */
export function hasNotes(item: CatalogItem | PackItem): boolean {
  return 'notes' in item && item.notes !== undefined;
}
