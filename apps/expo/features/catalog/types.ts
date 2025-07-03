export interface CatalogItemLink {
  id: string;
  title: string;
  url: string;
  type: 'official' | 'review' | 'guide' | 'purchase' | 'other';
}

export interface CatalogItemReview {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  text: string;
  date: string;
  helpful: number;
  verified: boolean;
}

export interface CatalogItem {
  id: string;
  name: string;
  usageCount: number;
  description?: string;
  defaultWeight?: number;
  defaultWeightUnit?: string;
  category?: string;
  image?: string;
  brand?: string;
  model?: string;
  url?: string;

  // New fields
  ratingValue?: number;
  productUrl?: string;
  color?: string | null;
  size?: string | null;
  sku?: string;
  price?: number | null;
  availability?: string;
  seller?: string;
  productSku?: string;
  material?: string;
  currency?: string;
  condition?: string;
  techs?: Record<string, string>;
  links?: CatalogItemLink[];
  reviews?: CatalogItemReview[];

  createdAt: string;
  updatedAt: string;
}

export interface PaginatedCatalogItemsResponse {
  items: CatalogItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CatalogItemInput {
  name: string;
  description?: string;
  defaultWeight?: number;
  defaultWeightUnit?: string;
  category?: string;
  image?: string;
  brand?: string;
  model?: string;
  url?: string;

  // New fields
  ratingValue?: number;
  productUrl?: string;
  color?: string | null;
  size?: string | null;
  sku?: string;
  price?: number | null;
  availability?: string;
  seller?: string;
  productSku?: string;
  material?: string;
  currency?: string;
  condition?: string;
  techs?: Record<string, string>;
  links?: CatalogItemLink[];
  reviews?: CatalogItemReview[];
}
