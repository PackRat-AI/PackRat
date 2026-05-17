export const PACK_CATEGORIES = Object.freeze([
  'hiking',
  'backpacking',
  'camping',
  'climbing',
  'winter',
  'desert',
  'custom',
  'water sports',
  'skiing',
] as const);

export type PackCategory = (typeof PACK_CATEGORIES)[number];

export const ITEM_CATEGORIES = Object.freeze([
  'clothing',
  'shelter',
  'sleep',
  'kitchen',
  'water',
  'electronics',
  'first-aid',
  'navigation',
  'tools',
  'consumables',
  'miscellaneous',
] as const);

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const WEIGHT_UNITS = Object.freeze(['g', 'oz', 'kg', 'lb'] as const);
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const AVAILABILITY_VALUES = Object.freeze(['in_stock', 'out_of_stock', 'preorder'] as const);

export type Availability = (typeof AVAILABILITY_VALUES)[number];

export interface ItemLink {
  id: string;
  title: string;
  url: string;
  type: 'official' | 'review' | 'guide' | 'purchase' | 'other';
}

export interface ItemReview {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  text: string;
  date: string;
  helpful?: number;
  verified?: boolean;
}
