import type { CatalogItem } from 'expo-app/features/catalog/types';
import type { PackTemplateItem } from 'expo-app/features/pack-templates';
import type { PackItem, WeightUnit } from 'expo-app/features/packs';

type Item = CatalogItem | PackItem | PackTemplateItem;

/**
 * Checks if an item is a catalog item
 */
export function isCatalogItem(item: Item): item is CatalogItem {
  return 'usageCount' in item;
}

/**
 * Gets the effective weight of an item
 */
export function getEffectiveWeight(item: Item): number {
  if (isCatalogItem(item)) {
    return item.defaultWeight ?? 0;
  }
  return item.weight;
}

/**
 * Gets the quantity of an item
 */
export function getQuantity(item: Item): number {
  return isCatalogItem(item) ? 1 : item.quantity;
}

/**
 * Gets the weight unit of an item
 */
export function getWeightUnit(item: Item): WeightUnit {
  return isCatalogItem(item) ? (item.defaultWeightUnit ?? 'g') : item.weightUnit;
}

/** Gets the notes of an item */
export function getNotes(item: Item): string | undefined {
  return isCatalogItem(item) ? undefined : item.notes;
}

/**
 * Calculates the total weight of an item (weight × quantity)
 */
export function calculateTotalWeight(item: Item): number {
  return getEffectiveWeight(item) * getQuantity(item);
}

/**
 * Checks if an item is consumable
 */
export function isConsumable(item: Item): boolean {
  return 'consumable' in item && item.consumable;
}

/**
 * Checks if quantity should be shown for an item
 */
export function shouldShowQuantity(item: Item): boolean {
  return !isCatalogItem(item) && 'quantity' in item;
}

/**
 * Checks if an item is worn
 */
export function isWorn(item: Item): boolean {
  return 'worn' in item && item.worn;
}

/**
 * Check if the item has a notes field
 */
export function hasNotes(item: Item): boolean {
  return 'notes' in item && item.notes !== undefined;
}
