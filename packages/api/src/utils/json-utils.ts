import type { NewCatalogItem } from '@packrat/db';
import { AvailabilitySchema, WeightUnitSchema } from '@packrat/schemas/constants';
import { parseFaqs, parsePrice, parseWeight, safeJsonParse } from './csv-utils';

// Module-level regex constant (Biome useTopLevelRegex)
const NEWLINE_CHARS = /[\r\n]+/g;

/**
 * Returns true if the R2 object key has a JSONL or NDJSON extension.
 */
export function isJsonlFile(objectKey: string): boolean {
  const lower = objectKey.toLowerCase();
  return lower.endsWith('.jsonl') || lower.endsWith('.ndjson');
}

/**
 * Maps a parsed JSON object (one line from a JSONL file) to a partial catalog item.
 * Uses `unknown` with proper type narrowing — no `any`.
 */
export function mapJsonRowToItem(obj: Record<string, unknown>): Partial<NewCatalogItem> | null {
  const item: Partial<NewCatalogItem> = {};

  // --- String scalar fields ---
  const rawName = obj.name;
  if (typeof rawName === 'string') item.name = rawName.trim();

  const rawProductUrl = obj.productUrl;
  if (typeof rawProductUrl === 'string') item.productUrl = rawProductUrl.trim();

  const rawCurrency = obj.currency;
  if (typeof rawCurrency === 'string') item.currency = rawCurrency.trim();

  const rawBrand = obj.brand;
  if (typeof rawBrand === 'string') item.brand = rawBrand.trim();

  const rawModel = obj.model;
  if (typeof rawModel === 'string') item.model = rawModel.trim();

  const rawColor = obj.color;
  if (typeof rawColor === 'string') item.color = rawColor.trim();

  const rawSize = obj.size;
  if (typeof rawSize === 'string') item.size = rawSize.trim();

  const rawSku = obj.sku;
  if (typeof rawSku === 'string') item.sku = rawSku.trim();

  const rawProductSku = obj.productSku;
  if (typeof rawProductSku === 'string') item.productSku = rawProductSku.trim();

  const rawSeller = obj.seller;
  if (typeof rawSeller === 'string') item.seller = rawSeller.trim();

  const rawMaterial = obj.material;
  if (typeof rawMaterial === 'string') item.material = rawMaterial.trim();

  const rawCondition = obj.condition;
  if (typeof rawCondition === 'string') item.condition = rawCondition.trim();

  // --- Description: strip newline chars ---
  const rawDescription = obj.description;
  if (typeof rawDescription === 'string') {
    item.description = rawDescription.replace(NEWLINE_CHARS, ' ').trim();
  }

  // --- reviewCount: direct number or parse from string ---
  const rawReviewCount = obj.reviewCount;
  if (typeof rawReviewCount === 'number') {
    item.reviewCount = Math.trunc(rawReviewCount) || 0;
  } else if (typeof rawReviewCount === 'string') {
    item.reviewCount = parseInt(rawReviewCount, 10) || 0;
  } else {
    item.reviewCount = 0;
  }

  // --- price: direct number or parsePrice from string ---
  const rawPrice = obj.price;
  if (typeof rawPrice === 'number') {
    item.price = rawPrice;
  } else if (typeof rawPrice === 'string') {
    item.price = parsePrice(rawPrice) ?? undefined;
  }

  // --- ratingValue: direct number or parseFloat from string ---
  const rawRatingValue = obj.ratingValue;
  if (typeof rawRatingValue === 'number') {
    item.ratingValue = rawRatingValue;
  } else if (typeof rawRatingValue === 'string') {
    const parsed = parseFloat(rawRatingValue);
    item.ratingValue = Number.isNaN(parsed) ? null : parsed;
  }

  // --- categories: array passthrough or split string ---
  const rawCategories = obj.categories;
  if (Array.isArray(rawCategories)) {
    item.categories = rawCategories.filter((c): c is string => typeof c === 'string');
  } else if (typeof rawCategories === 'string' && rawCategories.trim()) {
    const val = rawCategories.trim();
    try {
      item.categories = val.startsWith('[')
        ? JSON.parse(val)
        : val
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
    } catch {
      item.categories = [val];
    }
  }

  // --- images: array passthrough ---
  const rawImages = obj.images;
  if (Array.isArray(rawImages)) {
    item.images = rawImages.filter((i): i is string => typeof i === 'string');
  }

  // --- weight + weightUnit ---
  const rawWeight = obj.weight;
  const rawWeightUnit = obj.weightUnit;
  const unitStr = typeof rawWeightUnit === 'string' ? rawWeightUnit : undefined;

  if (typeof rawWeight === 'number' && rawWeight > 0) {
    const { weight, unit } = parseWeight(String(rawWeight), unitStr);
    item.weight = weight ?? undefined;
    const parsedUnit = WeightUnitSchema.safeParse(unit);
    item.weightUnit = parsedUnit.success ? parsedUnit.data : undefined;
  } else if (typeof rawWeight === 'string' && parseFloat(rawWeight) > 0) {
    const { weight, unit } = parseWeight(rawWeight, unitStr);
    item.weight = weight ?? undefined;
    const parsedUnit = WeightUnitSchema.safeParse(unit);
    item.weightUnit = parsedUnit.success ? parsedUnit.data : undefined;
  }

  // --- variants: passthrough as-is (already objects) ---
  const rawVariants = obj.variants;
  if (Array.isArray(rawVariants)) {
    item.variants = rawVariants as NewCatalogItem['variants'];
  }

  // --- links: passthrough ---
  const rawLinks = obj.links;
  if (Array.isArray(rawLinks)) {
    item.links = rawLinks as NewCatalogItem['links'];
  }

  // --- reviews: passthrough ---
  const rawReviews = obj.reviews;
  if (Array.isArray(rawReviews)) {
    item.reviews = rawReviews as NewCatalogItem['reviews'];
  }

  // --- qas: passthrough ---
  const rawQas = obj.qas;
  if (Array.isArray(rawQas)) {
    item.qas = rawQas as NewCatalogItem['qas'];
  }

  // --- faqs: array passthrough or parseFaqs from string ---
  const rawFaqs = obj.faqs;
  if (Array.isArray(rawFaqs)) {
    item.faqs = rawFaqs as NewCatalogItem['faqs'];
  } else if (typeof rawFaqs === 'string' && rawFaqs.trim()) {
    try {
      item.faqs = parseFaqs(rawFaqs);
    } catch {
      item.faqs = [];
    }
  }

  // --- techs: passthrough ---
  const rawTechs = obj.techs;
  if (rawTechs !== null && typeof rawTechs === 'object' && !Array.isArray(rawTechs)) {
    item.techs = rawTechs as Record<string, string>;
  } else if (typeof rawTechs === 'string' && rawTechs.trim()) {
    try {
      const parsed = safeJsonParse<Record<string, string>>(rawTechs);
      item.techs = Array.isArray(parsed) ? {} : parsed;
    } catch {
      item.techs = {};
    }
  }

  // --- weight fallback from techs (same as CSV path) ---
  if (!item.weight && item.techs && typeof item.techs === 'object') {
    const techs = item.techs as Record<string, string>;
    const claimedWeight = techs['Claimed Weight'] ?? techs.weight;
    if (claimedWeight) {
      const { weight, unit } = parseWeight(claimedWeight);
      item.weight = weight ?? undefined;
      const parsedUnit = WeightUnitSchema.safeParse(unit);
      item.weightUnit = parsedUnit.success ? parsedUnit.data : undefined;
    }
  }

  // --- availability: string → AvailabilitySchema.safeParse ---
  const rawAvailability = obj.availability;
  if (typeof rawAvailability === 'string' && rawAvailability.trim()) {
    const parsedAvailability = AvailabilitySchema.safeParse(rawAvailability.trim());
    if (parsedAvailability.success) {
      item.availability = parsedAvailability.data;
    }
  }

  return item;
}
