/** Pack entity category */
export enum PackCategory {
  Backpacking = 'backpacking',
  Camping = 'camping',
  Climbing = 'climbing',
  Cycling = 'cycling',
  Hiking = 'hiking',
  Skiing = 'skiing',
  Travel = 'travel',
  General = 'general',
}

/** Category for an individual item within a pack */
export enum ItemCategory {
  Shelter = 'shelter',
  Sleep = 'sleep',
  Clothing = 'clothing',
  Footwear = 'footwear',
  Navigation = 'navigation',
  Safety = 'safety',
  Food = 'food',
  Water = 'water',
  Hygiene = 'hygiene',
  Tools = 'tools',
}

/** Trail surface type for condition reports */
export enum TrailSurface {
  Paved = 'paved',
  Gravel = 'gravel',
  Dirt = 'dirt',
  Rocky = 'rocky',
  Snow = 'snow',
  Mud = 'mud',
}

/** Overall trail condition rating */
export enum TrailCondition {
  Excellent = 'excellent',
  Good = 'good',
  Fair = 'fair',
  Poor = 'poor',
}

/** Difficulty of water crossings */
export enum CrossingDifficulty {
  Easy = 'easy',
  Moderate = 'moderate',
  Difficult = 'difficult',
}

/** Gear catalog sort field */
export enum CatalogSortField {
  Name = 'name',
  Brand = 'brand',
  Price = 'price',
  Rating = 'ratingValue',
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
  Usage = 'usage',
}

/** Sort direction */
export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc',
}

/** User outdoor experience level */
export enum ExperienceLevel {
  Beginner = 'beginner',
  Intermediate = 'intermediate',
  Advanced = 'advanced',
}

/** Gear weight philosophy */
export enum PackStyle {
  Ultralight = 'ultralight',
  Lightweight = 'lightweight',
  Traditional = 'traditional',
}

/** Weight vs durability priority for gear recommendations */
export enum WeightPriority {
  Ultralight = 'ultralight',
  WeightConscious = 'weight-conscious',
  DurabilityFirst = 'durability-first',
}
