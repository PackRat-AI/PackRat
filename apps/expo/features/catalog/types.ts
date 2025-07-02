export interface CatalogItemLink {
  id: string;
  title: string;
  url: string;
  type: string;
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
  color?: string;
  size?: string;
  sku?: string;
  price?: number;
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
  color?: string;
  size?: string;
  sku?: string;
  price?: number;
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
