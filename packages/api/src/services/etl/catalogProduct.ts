import type { NewCatalogItem, NewCatalogItemOffer } from '@packrat/db/schema';

/**
 * Identity of a catalog product across retailers and variants: brand and
 * name, each reduced to ASCII letters and digits, then lower-cased.
 *
 * Stripping before lower-casing keeps the result independent of locale, so it
 * matches the SQL in scripts/catalog-products-cutover.sql exactly:
 *   lower(regexp_replace(coalesce(brand, ''), '[^a-zA-Z0-9]', '', 'g')) || '|' ||
 *   lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g'))
 */
export function catalogProductKey({
  brand,
  name,
}: {
  brand?: string | null;
  name: string;
}): string {
  return `${asciiAlphanumeric(brand ?? '').toLowerCase()}|${asciiAlphanumeric(name).toLowerCase()}`;
}

const asciiAlphanumeric = (value: string): string =>
  [...value]
    .filter(
      (char) =>
        (char >= 'a' && char <= 'z') ||
        (char >= 'A' && char <= 'Z') ||
        (char >= '0' && char <= '9'),
    )
    .join('');

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
export function groupItemsByProduct({
  items,
  existingProductKeyBySku = new Map(),
}: {
  items: NewCatalogItem[];
  existingProductKeyBySku?: ReadonlyMap<string, string>;
}): ProductGroup[] {
  // A listing already stored as an offer stays with its product even if the
  // store has since renamed it, and pulls same-named listings in this batch
  // along with it.
  const existingKeyByComputedKey = new Map<string, string>();
  for (const item of items) {
    const existingKey = existingProductKeyBySku.get(item.sku);
    if (existingKey !== undefined) {
      existingKeyByComputedKey.set(catalogProductKey(item), existingKey);
    }
  }

  const groups = new Map<string, ProductGroup>();

  for (const item of items) {
    const computedKey = catalogProductKey(item);
    const productKey =
      existingProductKeyBySku.get(item.sku) ??
      existingKeyByComputedKey.get(computedKey) ??
      computedKey;
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
