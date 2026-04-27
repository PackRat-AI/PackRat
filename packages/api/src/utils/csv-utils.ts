import { isString } from '@packrat/guards';
import type { NewCatalogItem } from '../db/schema';
import { AvailabilitySchema, WeightUnitSchema } from '../types';

// ── CSV sanitization regex constants ──
const NEWLINE_CHARS = /[\r\n]+/g;
const SINGLE_QUOTE_TO_DOUBLE = /'/g;
const WRAPPING_QUOTES = /^"|"$/g;
const PYTHON_NONE = /\bNone\b/g;
const PYTHON_TRUE = /\bTrue\b/g;
const PYTHON_FALSE = /\bFalse\b/g;
const CURLY_SINGLE_QUOTES = /[‘’‛‹›]/g;
const CURLY_DOUBLE_QUOTES = /[“”„‟«»]/g;
const BACKTICK_CHARS = /[`]/g;
const UNQUOTED_OBJECT_KEY = /([{,]\s*)'([^']+?)'\s*:/g;
const SINGLE_QUOTED_VALUE = /:\s*'(.*?)'(?=\s*[},])/g;
const ESCAPE_BACKSLASHES = /\\/g;
const ESCAPE_DOUBLE_QUOTES = /"/g;
const CONTROL_CHARS = /\\n|\\r|\\b|\\t|\\f|\r?\n|\r|\b|\t|\f/g;
const UNICODE_LINE_SEPARATORS = /\u2028|\u2029/g;
const HEX_ESCAPE = /\\x([0-9A-Fa-f]{2})/g;
const LONE_BACKSLASH = /([^\\])\\(?![\\/"'bfnrtu])/g;
const TRAILING_COMMA = /,\s*([}\]])/g;
const ESCAPED_DOUBLE_QUOTE = /\\"/g;
const NON_NUMERIC_PRICE = /[^0-9.]/g;

export function mapCsvRowToItem({
  values,
  fieldMap,
}: {
  values: string[];
  fieldMap: Record<string, number>;
}): Partial<NewCatalogItem> | null {
  const item: Partial<NewCatalogItem> = {};
  // --- Optional Scalars ---
  item.description =
    fieldMap.description !== undefined
      ? values[fieldMap.description]?.replace(NEWLINE_CHARS, ' ').trim()
      : undefined;

  const name = fieldMap.name !== undefined ? values[fieldMap.name]?.trim() : undefined;
  item.name = name;

  const productUrl =
    fieldMap.productUrl !== undefined ? values[fieldMap.productUrl]?.trim() : undefined;
  item.productUrl = productUrl;

  const currency = fieldMap.currency !== undefined ? values[fieldMap.currency]?.trim() : undefined;
  item.currency = currency;

  const reviewCountStr =
    fieldMap.reviewCount !== undefined ? values[fieldMap.reviewCount] : undefined;
  item.reviewCount = reviewCountStr ? parseInt(reviewCountStr, 10) || 0 : 0;

  if (fieldMap.categories !== undefined && values[fieldMap.categories]) {
    const val = values[fieldMap.categories]?.trim();
    if (val) {
      try {
        item.categories = val.startsWith('[')
          ? JSON.parse(val)
          : val
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean);
      } catch {
        item.categories = val ? [val] : undefined;
      }
    } else {
      item.categories = undefined;
    }
  } else {
    item.categories = undefined;
  }

  let images: string[] | undefined;
  if (fieldMap.images !== undefined && values[fieldMap.images]) {
    try {
      const val = values[fieldMap.images]?.trim();
      if (val) {
        images = val.startsWith('[')
          ? JSON.parse(val)
          : val
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean);
      }
    } catch {
      images = undefined;
    }
  } else {
    images = undefined;
  }
  item.images = images;

  // Scalars
  const weightStr = fieldMap.weight !== undefined ? values[fieldMap.weight] : undefined;
  const unitStr = fieldMap.weightUnit !== undefined ? values[fieldMap.weightUnit] : undefined;
  if (weightStr && parseFloat(weightStr) > 0) {
    const { weight, unit } = parseWeight(weightStr, unitStr);
    item.weight = weight || undefined;
    const parsedUnit = WeightUnitSchema.safeParse(unit);
    item.weightUnit = parsedUnit.success ? parsedUnit.data : undefined;
  }

  const priceStr = fieldMap.price !== undefined ? values[fieldMap.price] : undefined;
  if (priceStr) item.price = parsePrice(priceStr);

  const ratingStr = fieldMap.ratingValue !== undefined ? values[fieldMap.ratingValue] : undefined;
  if (ratingStr) item.ratingValue = parseFloat(ratingStr) || null;

  if (fieldMap.variants !== undefined && values[fieldMap.variants]) {
    const val = values[fieldMap.variants]?.trim();
    if (val) {
      try {
        item.variants = JSON.parse(val);
      } catch {
        try {
          item.variants = JSON.parse(val.replace(SINGLE_QUOTE_TO_DOUBLE, '"'));
        } catch {
          item.variants = [];
        }
      }
    }
  }

  if (fieldMap.faqs !== undefined && values[fieldMap.faqs]) {
    const val = values[fieldMap.faqs]?.trim();
    if (val) {
      try {
        item.faqs = parseFaqs(val);
      } catch {
        item.faqs = [];
      }
    }
  }

  // JSON fields
  const jsonFields: Extract<'links' | 'reviews' | 'qas', keyof NewCatalogItem>[] = [
    'links',
    'reviews',
    'qas',
  ];
  for (const field of jsonFields) {
    const fieldIndex = fieldMap[field as string];
    if (fieldIndex !== undefined && values[fieldIndex]) {
      try {
        item[field] = safeJsonParse(values[fieldIndex]);
      } catch {
        item[field] = [];
      }
    }
  }

  // Techs + fallback for weight
  const techsStr = fieldMap.techs !== undefined ? values[fieldMap.techs] : undefined;
  if (techsStr) {
    try {
      const parsed = safeJsonParse<Record<string, string>>(techsStr);
      item.techs = Array.isArray(parsed) ? {} : parsed;

      if (!item.weight && !Array.isArray(parsed)) {
        const claimedWeight = parsed['Claimed Weight'] || parsed.weight;
        if (claimedWeight) {
          const { weight, unit } = parseWeight(claimedWeight);
          item.weight = weight || undefined;
          const parsedUnit = WeightUnitSchema.safeParse(unit);
          item.weightUnit = parsedUnit.success ? parsedUnit.data : undefined;
        }
      }
    } catch {
      item.techs = {};
    }
  }

  // Direct mappings for string fields
  const stringFields = [
    'brand',
    'model',
    'color',
    'size',
    'sku',
    'productSku',
    'seller',
    'material',
    'condition',
  ] as const;
  for (const field of stringFields) {
    const index = fieldMap[field];
    if (index !== undefined && values[index]) {
      item[field] = values[index].replace(WRAPPING_QUOTES, '').trim();
    }
  }

  // Handle availability enum separately
  if (fieldMap.availability !== undefined && values[fieldMap.availability]) {
    const availabilityValue = values[fieldMap.availability];
    if (availabilityValue) {
      const parsedAvailability = AvailabilitySchema.safeParse(
        availabilityValue.replace(WRAPPING_QUOTES, '').trim(),
      );
      if (parsedAvailability.success) {
        item.availability = parsedAvailability.data;
      }
    }
  }

  return item;
}

export function parseWeight(
  weightStr: string,
  unitStr?: string,
): { weight: number | null; unit: string | null } {
  if (!weightStr) return { weight: null, unit: null };

  const weightVal = parseFloat(weightStr);
  if (Number.isNaN(weightVal) || weightVal < 0) {
    return { weight: null, unit: null };
  }

  const hint = (unitStr || weightStr).toLowerCase();

  if (hint.includes('oz')) {
    return { weight: Math.round(weightVal * 28.35), unit: 'oz' };
  }
  if (hint.includes('lb')) {
    return { weight: Math.round(weightVal * 453.592), unit: 'lb' };
  }
  if (hint.includes('kg')) {
    return { weight: weightVal * 1000, unit: 'kg' };
  }

  return { weight: weightVal, unit: 'g' };
}

/**
 * Normalizes a messy JSON-like string to make it more parseable by JSON.parse.
 * Handles Python values, smart quotes, invalid escapes, trailing commas, and more.
 */
export function normalizeJsonString(value: string): string {
  return (
    value
      .trim()

      // Replace Python-style null/booleans with JS equivalents
      .replace(PYTHON_NONE, 'null')
      .replace(PYTHON_TRUE, 'true')
      .replace(PYTHON_FALSE, 'false')

      // Normalize smart/special quotes to standard quotes
      .replace(CURLY_SINGLE_QUOTES, "'")
      .replace(CURLY_DOUBLE_QUOTES, '"')
      .replace(BACKTICK_CHARS, '')

      // Convert object keys from 'key': to "key":
      .replace(UNQUOTED_OBJECT_KEY, '$1"$2":')

      // Convert string values from 'value' to "escaped value"
      .replace(SINGLE_QUOTED_VALUE, (_, val) => {
        const escaped = val
          .replace(ESCAPE_BACKSLASHES, '\\\\') // Escape backslashes
          .replace(ESCAPE_DOUBLE_QUOTES, '\\"') // Escape double quotes
          .replace(CONTROL_CHARS, '') // Remove newlines/control chars
          .replace(UNICODE_LINE_SEPARATORS, ''); // Remove special Unicode line separators
        return `: "${escaped}"`;
      })

      // Decode \xNN hex escapes to characters
      .replace(HEX_ESCAPE, (_, hex) => String.fromCharCode(parseInt(hex, 16)))

      // Escape lone backslashes (e.g., \ not followed by valid escape)
      .replace(LONE_BACKSLASH, '$1\\\\')

      // Remove trailing commas before closing braces/brackets
      .replace(TRAILING_COMMA, '$1')
  );
}

export function safeJsonParse<T = unknown>(value: string): T | [] {
  if (!value || value === 'undefined' || value === 'null') return [];

  const normalized = normalizeJsonString(value);

  try {
    return JSON.parse(normalized) as T; // safe-cast: caller-provided generic boundary — caller is responsible for type safety
  } catch (err) {
    console.warn('❌ Failed to parse JSON:', {
      error: err,
      originalInput: value,
      normalizedInput: normalized,
    });
    return [];
  }
}

export function parseFaqs(input: string): Array<{ question: string; answer: string }> {
  if (!input || !isString(input)) return [];

  const results: Array<{ question: string; answer: string }> = [];

  // Remove outer quotes
  let cleaned = input.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1).replace(ESCAPED_DOUBLE_QUOTE, '"');
  }

  // Replace smart quotes
  cleaned = normalizeJsonString(cleaned);

  // Use a global regex to extract each question-answer block
  const regex =
    /{[^{}]*?['"]question['"]\s*:\s*['"](.+?)['"]\s*,\s*['"]answer['"]\s*:\s*['"](.+?)['"]\s*}/g;

  let match = regex.exec(cleaned);
  while (match !== null) {
    const question = match[1]?.trim();
    const answer = match[2]?.trim();
    if (question && answer) {
      results.push({ question, answer });
    }

    match = regex.exec(cleaned);
  }
  return results;
}

export function parsePrice(priceStr: string): number | null {
  if (!priceStr) return null;
  const price = parseFloat(priceStr.replace(NON_NUMERIC_PRICE, ''));
  return Number.isNaN(price) ? null : price;
}
