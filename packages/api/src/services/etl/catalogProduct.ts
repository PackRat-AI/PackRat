import type { NewCatalogItem, NewCatalogItemOffer } from '@packrat/db/schema';

/**
 * Identity of a catalog product across retailers and variants:
 * lower-cased brand + name with everything but [a-z0-9] removed.
 *
 * Must stay byte-identical to the SQL expression in
 * scripts/catalog-products-cutover.sql, which keys the existing rows:
 *   lower(coalesce(brand,'')) || '|' || regexp_replace(lower(name), '[^a-z0-9]', '', 'g')
 */
export function catalogProductKey({
  brand,
  name,
}: {
  brand?: string | null;
  name: string;
}): string {
  return `${(brand ?? '').toLowerCase()}|${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

const GRAMS_PER_UNIT = Object.freeze({ g: 1, oz: 28.3495, lb: 453.592, kg: 1000 } as const);

// Nothing carried on a trail weighs under 3 g or over 25 kg; values outside
// this band are scraper or unit errors, not products.
const MIN_PLAUSIBLE_GRAMS = 3;
const MAX_PLAUSIBLE_GRAMS = 25_000;

/**
 * Normalises a scraped weight to grams and drops implausible values, so a bad
 * listing stores no weight instead of a wrong one.
 */
export function normalizeCatalogWeight({
  weight,
  weightUnit,
}: Pick<NewCatalogItem, 'weight' | 'weightUnit'>): Pick<NewCatalogItem, 'weight' | 'weightUnit'> {
  if (weight == null || weightUnit == null || !(weightUnit in GRAMS_PER_UNIT)) {
    return { weight: null, weightUnit: null };
  }
  const grams = weight * GRAMS_PER_UNIT[weightUnit as keyof typeof GRAMS_PER_UNIT];
  if (!(grams >= MIN_PLAUSIBLE_GRAMS && grams <= MAX_PLAUSIBLE_GRAMS)) {
    return { weight: null, weightUnit: null };
  }
  return { weight: Math.round(grams * 100) / 100, weightUnit: 'g' };
}

type ProductGroup = {
  productKey: string;
  product: NewCatalogItem;
  offers: Omit<NewCatalogItemOffer, 'catalogItemId'>[];
};

/**
 * Collapses SKU-unique listings into one product per productKey. The first
 * listing seeds the product row; later listings fill fields it left empty.
 * Every listing becomes an offer.
 */
export function groupItemsByProduct(items: NewCatalogItem[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();

  for (const item of items) {
    const productKey = catalogProductKey(item);
    const offer = {
      sku: item.sku,
      productUrl: item.productUrl,
      price: item.price,
      currency: item.currency,
      seller: item.seller,
      availability: item.availability,
      color: item.color,
      size: item.size,
      condition: item.condition,
      productSku: item.productSku,
    };
    const weight = normalizeCatalogWeight(item);
    const existing = groups.get(productKey);

    if (!existing) {
      groups.set(productKey, {
        productKey,
        product: { ...item, ...weight, productKey },
        offers: [offer],
      });
      continue;
    }

    existing.offers.push(offer);
    for (const [key, value] of Object.entries({ ...item, ...weight })) {
      const field = key as keyof NewCatalogItem;
      if (existing.product[field] == null && value != null) {
        Object.assign(existing.product, { [field]: value });
      }
    }
  }

  return [...groups.values()];
}
