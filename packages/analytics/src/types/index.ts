/** A row of normalized gear data from R2 CSVs or local DuckDB cache. */
export interface CatalogRow {
  site: string;
  name: string;
  brand: string;
  category: string;
  price: number | null;
  availability: string;
  description: string;
  product_url: string;
  image_url: string;
  compare_at_price: number | null;
  rating_value: number | null;
  review_count: number | null;
  weight: number | null;
  weight_unit: string;
  color: string;
  size: string;
  material: string;
  tags: string;
  published_at: string;
  updated_at: string;
}

/** Price comparison summary per site. */
export interface PriceComparison {
  site: string;
  item_count: number;
  avg_price: number;
  min_price: number;
  max_price: number;
}

/** Brand analysis summary per site + category. */
export interface BrandAnalysis {
  site: string;
  category: string;
  product_count: number;
  avg_price: number;
  min_price: number;
  max_price: number;
}

/** Category insights per site. */
export interface CategoryInsights {
  site: string;
  product_count: number;
  brand_count: number;
  avg_price: number;
  min_price: number;
  max_price: number;
}

/** Price trend observation. */
export interface PriceTrend {
  scrape_date: string;
  site: string;
  name: string;
  brand: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  observations: number;
}

/** Site statistics. */
export interface SiteStats {
  site: string;
  items: number;
  brands: number;
  categories: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  in_stock_pct: number;
  has_url_pct: number;
}

/** Cache metadata. */
export interface CacheMetadata {
  version: string;
  created_at: string;
  record_count: number;
  sites: string[];
}

/** Generic query result as array of typed rows. */
export type QueryResult<T> = T[];
