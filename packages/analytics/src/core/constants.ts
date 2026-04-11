/**
 * Centralized constants, enums, and configuration for PackRat Analytics.
 * Single source of truth for magic strings, numbers, and SQL patterns.
 */

// ── Enums ──────────────────────────────────────────────────────────────

export const AvailabilityStatus = {
  IN_STOCK: 'in_stock',
  AVAILABLE: 'available',
  OUT_OF_STOCK: 'out_of_stock',
  PREORDER: 'preorder',
  BACKORDER: 'backorder',
  UNKNOWN: 'unknown',
} as const;

export type AvailabilityStatus = (typeof AvailabilityStatus)[keyof typeof AvailabilityStatus];

export const CacheStatus = {
  NOT_INITIALIZED: 'not_initialized',
  ACTIVE: 'active',
  UPDATING: 'updating',
  ERROR: 'error',
  DISABLED: 'disabled',
} as const;

export type CacheStatus = (typeof CacheStatus)[keyof typeof CacheStatus];

export const ExportFormat = {
  CSV: 'csv',
  PARQUET: 'parquet',
  JSON: 'json',
} as const;

export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];

export const DedupStrategy = {
  BEST_QUALITY: 'best_quality',
  MERGE_DATA: 'merge_data',
  PREFER_SITE: 'prefer_site',
} as const;

export type DedupStrategy = (typeof DedupStrategy)[keyof typeof DedupStrategy];

// ── Database Configuration ────────────────────────────────────────────

export const DBConfig: {
  MEMORY_LIMIT: string;
  THREAD_COUNT: number;
  HTTP_TIMEOUT: number;
  CACHE_REFRESH_HOURS: number;
  CACHE_VERSION: string;
  SCHEMA_VERSION: string;
  DEFAULT_LIMIT: number;
  MAX_VALID_PRICE: number;
  MIN_VALID_PRICE: number;
  PRICE_ROUND_DIGITS: number;
  NAME_TRUNCATE_LENGTH: number;
  DEAL_NAME_TRUNCATE_LENGTH: number;
  MIN_GROUP_COUNT: number;
  MIN_CATEGORY_COUNT: number;
} = {
  MEMORY_LIMIT: '4GB',
  THREAD_COUNT: 4,
  HTTP_TIMEOUT: 300_000,

  // Cache settings
  CACHE_REFRESH_HOURS: 24,
  CACHE_VERSION: '2.0',
  SCHEMA_VERSION: '2.0',

  // Query defaults
  DEFAULT_LIMIT: 20,
  MAX_VALID_PRICE: 999_999,
  MIN_VALID_PRICE: 0,
  PRICE_ROUND_DIGITS: 2,

  // Display
  NAME_TRUNCATE_LENGTH: 50,
  DEAL_NAME_TRUNCATE_LENGTH: 40,

  // Grouping thresholds
  MIN_GROUP_COUNT: 3,
  MIN_CATEGORY_COUNT: 5,
};

// ── R2 / File Path Patterns ───────────────────────────────────────────

export const SITE_EXTRACT_REGEX = 'v[12]/([^/]+)/';

export const R2_CSV_GLOB_V1 = 'v1/*/*.csv';
export const R2_CSV_GLOB_V2 = 'v2/*/*.csv';
// v1 contains legacy format CSVs with malformed/empty files; skip by default.
// Restore with: R2_CSV_GLOBS = [R2_CSV_GLOB_V1, R2_CSV_GLOB_V2]
export const R2_CSV_GLOBS = [R2_CSV_GLOB_V2];

// ── Field Mappings ────────────────────────────────────────────────────

/**
 * Maps logical field names to all known CSV column name variations.
 * Used by COALESCE queries to handle schema differences across sites.
 */
export const FIELD_MAPPINGS: Record<string, string[]> = {
  // V2 CSV columns use camelCase from Pydantic model
  name: ['name'],
  brand: ['brand'],
  category: ['categories'],
  price: ['price'],
  availability: ['availability'],
  description: ['description'],
  product_url: ['productUrl'],
  image_url: ['images'],
  compare_at_price: ['compareAtPrice'],
  rating_value: ['ratingValue'],
  review_count: ['reviewCount'],
  weight: ['weight'],
  weight_unit: ['weightUnit'],
  color: ['color'],
  size: ['size'],
  material: ['material'],
  tags: ['tags'],
  published_at: ['publishedAt'],
  updated_at: ['updatedAt'],
};

/** Default values when a field is missing/null */
export const FIELD_DEFAULTS: Record<string, string> = {
  name: 'Unknown',
  brand: 'Unknown',
  category: 'Uncategorized',
  description: '',
  product_url: '',
  image_url: '',
  color: '',
  size: '',
  material: '',
  tags: '',
  published_at: '',
  updated_at: '',
};

// ── Quality Scoring ───────────────────────────────────────────────────

export const QUALITY_WEIGHTS: Record<string, number> = {
  completeness: 0.3,
  price_valid: 0.2,
  name_quality: 0.15,
  brand_quality: 0.15,
  url_present: 0.1,
  image_present: 0.1,
};

/**
 * High-quality sites preferred for deduplication and ranking.
 * Populated at runtime from cached site list; these are fallback defaults.
 */
export const PREFERRED_SITES: string[] = [];
