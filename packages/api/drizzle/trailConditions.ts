import { pgTable, text, timestamp, real, boolean, integer } from 'drizzle-orm/pg-core';

export const trailConditions = pgTable('trail_conditions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  
  // Trail info
  trailId: text('trail_id'),
  trailName: text('trail_name').notNull(),
  
  // Location
  latitude: real('latitude'),
  longitude: real('longitude'),
  locationName: text('location_name'),
  
  // Conditions
  surfaceCondition: text('surface_condition'), // 'paved', 'gravel', 'dirt', 'rocky', 'snow', 'mud'
  difficulty: integer('difficulty'), // 1-5 scale
  
  // Hazards
  hasFallenTrees: boolean('has_fallen_trees').default(false),
  hasWildlife: boolean('has_wildlife').default(false),
  hasErosion: boolean('has_erosion').default(false),
  hasClosures: boolean('has_closures').default(false),
  hasWaterCrossings: boolean('has_water_crossings').default(false),
  
  // Water crossings details
  waterCrossingCount: integer('water_crossing_count'),
  waterDepth: text('water_depth'), // 'shallow', 'moderate', 'deep'
  waterDifficulty: text('water_difficulty'), // 'easy', 'moderate', 'difficult'
  
  // Photos
  photoUrls: text('photo_urls').array(),
  
  // Notes
  notes: text('notes'),
  
  // Trust/verification
  trustScore: real('trust_score').default(1.0),
  verifiedCount: integer('verified_count').default(0),
  
  // Offline
  isOffline: boolean('is_offline').default(false),
  syncedAt: timestamp('synced_at'),
  
  // Timestamps
  reportedAt: timestamp('reported_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Verifications from other users
export const trailConditionVerifications = pgTable('trail_condition_verifications', {
  id: text('id').primaryKey(),
  conditionId: text('condition_id').notNull().references(() => trailConditions.id),
  userId: text('user_id').notNull(),
  isAccurate: boolean('is_accururate').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
