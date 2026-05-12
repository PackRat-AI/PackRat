// ── Auth / User ──────────────────────────────────────────────────────────────

export type User = {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null; // 'USER' | 'ADMIN'
  emailVerified: boolean | null;
  avatarUrl?: string | null;
};

// ── Enums ────────────────────────────────────────────────────────────────────

export type WeightUnit = 'g' | 'oz' | 'kg' | 'lb';

export type PackCategory =
  | 'hiking'
  | 'backpacking'
  | 'camping'
  | 'climbing'
  | 'winter'
  | 'desert'
  | 'custom'
  | 'water sports'
  | 'skiing';

export type ItemCategory =
  | 'clothing'
  | 'shelter'
  | 'sleep'
  | 'kitchen'
  | 'water'
  | 'electronics'
  | 'first-aid'
  | 'navigation'
  | 'tools'
  | 'consumables'
  | 'miscellaneous';

// ── Packs ────────────────────────────────────────────────────────────────────

export type PackItem = {
  id: string;
  name: string;
  description: string | null;
  weight: number; // numeric, unit stored in weightUnit
  weightUnit: WeightUnit;
  quantity: number; // always >= 1
  category: ItemCategory | null;
  consumable: boolean;
  worn: boolean;
  image: string | null;
  notes: string | null;
  packId: string;
  catalogItemId: number | null;
  userId: number;
  deleted: boolean;
  isAIGenerated: boolean;
  createdAt: string; // ISO datetime
  updatedAt: string;
};

export type PackWithWeights = {
  id: string;
  userId: number;
  name: string;
  description: string | null;
  category: PackCategory | null;
  isPublic: boolean;
  image: string | null;
  tags: string[] | null;
  deleted: boolean;
  isAIGenerated: boolean;
  createdAt: string;
  updatedAt: string;
  items?: PackItem[];
  totalWeight: number; // sum of all items in grams
  baseWeight: number; // excludes consumables and worn items
};

export type PackListResponse = {
  packs: PackWithWeights[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// ── Trips ────────────────────────────────────────────────────────────────────

export type TripLocation = {
  latitude: number;
  longitude: number;
  name?: string;
};

export type Trip = {
  id: string;
  name: string;
  description?: string | null;
  notes?: string | null;
  location?: TripLocation | null;
  startDate?: string | null; // ISO date string
  endDate?: string | null;
  userId?: number;
  packId?: string | null; // linked pack (optional)
  deleted: boolean;
  createdAt?: string;
  updatedAt?: string;
};

// ── Catalog ──────────────────────────────────────────────────────────────────

export type CatalogItem = {
  id: number;
  name: string;
  productUrl: string;
  sku: string;
  weight: number;
  weightUnit: string;
  description: string | null;
  categories: string[] | null;
  images: string[] | null;
  model: string | null;
  ratingValue: number | null; // 0–5
  color: string | null;
  size: string | null;
  price: number | null;
  currency: string | null;
  availability: 'in_stock' | 'out_of_stock' | 'preorder' | null;
  seller: string | null;
  material: string | null;
  reviewCount: number | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type CatalogListResponse = {
  items: CatalogItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

// ── Feed ─────────────────────────────────────────────────────────────────────

export type PostAuthor = {
  id: string;
  firstName: string | null;
  lastName: string | null;
};

export type Post = {
  id: number;
  userId: string;
  caption: string | null;
  images: string[]; // array of image URLs
  createdAt: string;
  updatedAt: string;
  author?: PostAuthor;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

export type FeedResponse = {
  items: Post[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

// ── Guides ───────────────────────────────────────────────────────────────────

export type Guide = {
  id: string;
  title: string;
  category: string;
  readTime: string;
  excerpt?: string;
};

// ── Notifications ────────────────────────────────────────────────────────────

export type Notification = {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'system';
  message: string;
  read: boolean;
  createdAt: string;
  actorName?: string;
  actorAvatar?: string;
};
