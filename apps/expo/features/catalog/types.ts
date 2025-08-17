import type { WeightUnit } from 'expo-app/types';

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
  id: number;
  name: string;
  productUrl: string;
  sku: string;
  weight: number;
  weightUnit: string;
  description?: string | null;
  categories?: string[] | null;
  images?: string[] | null;
  brand?: string | null;
  model?: string | null;
  ratingValue?: number | null;
  color?: string | null;
  size?: string | null;
  price?: number | null;
  availability?: 'in_stock' | 'out_of_stock' | 'preorder' | null;
  seller?: string | null;
  productSku?: string | null;
  material?: string | null;
  currency?: string | null;
  condition?: string | null;
  reviewCount?: number | null;
  usageCount?: number | null;

  variants?: Array<{
    attribute: string;
    values: string[];
  }> | null;

  techs?: Record<string, string> | null;

  links?: Array<{
    title: string;
    url: string;
  }> | null;

  reviews?: Array<{
    user_name: string;
    user_avatar?: string | null;
    context?: Record<string, string> | null;
    recommends?: boolean | null;
    rating: number;
    title: string;
    text: string;
    date: string;
    images?: string[] | null;
    upvotes?: number | null;
    downvotes?: number | null;
    verified?: boolean | null;
  }> | null;

  qas?: Array<{
    question: string;
    user?: string | null;
    date: string;
    answers: Array<{
      a: string;
      date: string;
      user?: string | null;
      upvotes?: number | null;
    }>;
  }> | null;

  faqs?: Array<{
    question: string;
    answer: string;
  }> | null;

  embedding?: number[] | null; // vector(1536)

  createdAt: Date;
  updatedAt: Date;
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
