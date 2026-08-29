/** Pack entity category */
export enum PackCategory {
  Backpacking = 'backpacking',
  Camping = 'camping',
  Climbing = 'climbing',
  Custom = 'custom',
  Desert = 'desert',
  Hiking = 'hiking',
  Skiing = 'skiing',
  WaterSports = 'water sports',
  Winter = 'winter',
}

/** Category for an individual item within a pack */
export enum ItemCategory {
  Clothing = 'clothing',
  Shelter = 'shelter',
  Sleep = 'sleep',
  Kitchen = 'kitchen',
  Water = 'water',
  Electronics = 'electronics',
  FirstAid = 'first-aid',
  Navigation = 'navigation',
  Tools = 'tools',
  Consumables = 'consumables',
  Miscellaneous = 'miscellaneous',
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
  /**
   * Sort by item weight, normalised to grams server-side (the stored
   * catalog mixes g/kg/oz/lb, so the API converts before ordering).
   *
   * Added after an OpenAI Apps review run: the model reached for
   * `sort_by: "weight"` unprompted on an ultralight-gear query, the value
   * failed schema validation, and the whole catalog search silently
   * no-opped — so the answer was built from model knowledge instead of
   * PackRat's catalog. Weight is the primary axis backpackers optimise
   * on; omitting it from a gear catalog's sort options was the gap.
   */
  Weight = 'weight',
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
