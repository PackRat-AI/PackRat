import type { NewCatalogItem } from '@packrat/db';
import { isNumber, isObject, isString, toStringRecord } from '@packrat/guards';
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
  if (isString(rawName)) item.name = rawName.trim();

  const rawProductUrl = obj.productUrl;
  if (isString(rawProductUrl)) item.productUrl = rawProductUrl.trim();

  const rawCurrency = obj.currency;
  if (isString(rawCurrency)) item.currency = rawCurrency.trim();

  const rawBrand = obj.brand;
  if (isString(rawBrand)) item.brand = rawBrand.trim();

  const rawModel = obj.model;
  if (isString(rawModel)) item.model = rawModel.trim();

  const rawColor = obj.color;
  if (isString(rawColor)) item.color = rawColor.trim();

  const rawSize = obj.size;
  if (isString(rawSize)) item.size = rawSize.trim();

  const rawSku = obj.sku;
  if (isString(rawSku)) item.sku = rawSku.trim();

  const rawProductSku = obj.productSku;
  if (isString(rawProductSku)) item.productSku = rawProductSku.trim();

  const rawSeller = obj.seller;
  if (isString(rawSeller)) item.seller = rawSeller.trim();

  const rawMaterial = obj.material;
  if (isString(rawMaterial)) item.material = rawMaterial.trim();

  const rawCondition = obj.condition;
  if (isString(rawCondition)) item.condition = rawCondition.trim();

  // --- Description: strip newline chars ---
  const rawDescription = obj.description;
  if (isString(rawDescription)) {
    item.description = rawDescription.replace(NEWLINE_CHARS, ' ').trim();
  }

  // --- reviewCount: direct number or parse from string ---
  const rawReviewCount = obj.reviewCount;
  if (isNumber(rawReviewCount)) {
    item.reviewCount = Math.trunc(rawReviewCount) || 0;
  } else if (isString(rawReviewCount)) {
    item.reviewCount = parseInt(rawReviewCount, 10) || 0;
  } else {
    item.reviewCount = 0;
  }

  // --- price: direct number or parsePrice from string ---
  const rawPrice = obj.price;
  if (isNumber(rawPrice)) {
    item.price = rawPrice;
  } else if (isString(rawPrice)) {
    item.price = parsePrice(rawPrice) ?? undefined;
  }

  // --- ratingValue: direct number or parseFloat from string ---
  const rawRatingValue = obj.ratingValue;
  if (isNumber(rawRatingValue)) {
    item.ratingValue = rawRatingValue;
  } else if (isString(rawRatingValue)) {
    const parsed = parseFloat(rawRatingValue);
    item.ratingValue = Number.isNaN(parsed) ? null : parsed;
  }

  // --- categories: array passthrough or split string ---
  const rawCategories = obj.categories;
  if (Array.isArray(rawCategories)) {
    item.categories = rawCategories.filter((c): c is string => isString(c));
  } else if (isString(rawCategories) && rawCategories.trim()) {
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
    item.images = rawImages.filter((i): i is string => isString(i));
  }

  // --- weight + weightUnit ---
  const rawWeight = obj.weight;
  const rawWeightUnit = obj.weightUnit;
  const unitStr = isString(rawWeightUnit) ? rawWeightUnit : undefined;

  if (isNumber(rawWeight) && rawWeight > 0) {
    const { weight, unit } = parseWeight(String(rawWeight), unitStr);
    item.weight = weight ?? undefined;
    const parsedUnit = WeightUnitSchema.safeParse(unit);
    item.weightUnit = parsedUnit.success ? parsedUnit.data : undefined;
  } else if (isString(rawWeight) && parseFloat(rawWeight) > 0) {
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
  } else if (isString(rawFaqs) && rawFaqs.trim()) {
    try {
      item.faqs = parseFaqs(rawFaqs);
    } catch {
      item.faqs = [];
    }
  }

  // --- techs: passthrough ---
  const rawTechs = obj.techs;
  if (isObject(rawTechs)) {
    item.techs = toStringRecord(rawTechs);
  } else if (isString(rawTechs) && rawTechs.trim()) {
    try {
      const parsed = safeJsonParse<Record<string, string>>(rawTechs);
      item.techs = Array.isArray(parsed) ? {} : parsed;
    } catch {
      item.techs = {};
    }
  }

  // --- weight fallback from techs (same as CSV path) ---
  if (!item.weight && item.techs && isObject(item.techs)) {
    const techs = toStringRecord(item.techs);
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
  if (isString(rawAvailability) && rawAvailability.trim()) {
    const parsedAvailability = AvailabilitySchema.safeParse(rawAvailability.trim());
    if (parsedAvailability.success) {
      item.availability = parsedAvailability.data;
    }
  }

  return item;
}
