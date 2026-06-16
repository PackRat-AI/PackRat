/**
 * Reusable projection types derived from the Drizzle schema.
 *
 * These exist so service functions and compute helpers can declare a precise
 * minimum input shape (e.g., "the pack-weight calculation needs weight,
 * weightUnit, quantity, consumable, worn") without forcing every caller to
 * pass a full `PackItem` — which in turn would force every DB query feeding
 * those callers to `SELECT *` and pull every column, including the 1536-dim
 * embedding and any fat JSONB.
 *
 * Add new projection types here when:
 *  - a function reads only a subset of a table's columns
 *  - extracting the subset would unlock narrower DB-side projection at one
 *    or more call sites
 *
 * Keep these types co-located with the schema (this package) so they stay
 * in sync with column additions/renames.
 */
import type { PackItem } from './schema';

// ── packs ──────────────────────────────────────────────────────────────────

/** Minimum item fields the pack-weight calculations read. */
export type PackItemForWeights = Pick<
  PackItem,
  'weight' | 'weightUnit' | 'quantity' | 'consumable' | 'worn'
>;

/**
 * Pack shape minimal enough to drive weight calculations: an id (for error
 * messages) plus an items array of weight-relevant columns. Generic over the
 * concrete item shape so callers passing wider rows get a wider return from
 * the compute helpers (the helpers spread `...pack` into their return value).
 */
export type PackForWeights<TItem extends PackItemForWeights = PackItem> = {
  id: string;
  items: TItem[];
};

/** Minimum item fields the pack-weight breakdown reads (adds name + category). */
export type PackItemForBreakdown = PackItemForWeights & Pick<PackItem, 'name' | 'category'>;

/** Pack shape minimal enough to drive the per-category weight breakdown. */
export type PackForBreakdown<TItem extends PackItemForBreakdown = PackItem> = {
  id: string;
  items: TItem[];
};
