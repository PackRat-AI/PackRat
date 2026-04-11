import { integer, jsonb, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../db/schema';

export const trailConditions = pgTable('trail_conditions', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  trailId: text('trail_id'),
  trailName: text('trail_name').notNull(),
  latitude: real('latitude'),
  longitude: real('longitude'),
  locationName: text('location_name'),
  surfaceCondition: text('surface_condition'),
  difficulty: text('difficulty'),
  hasFallenTrees: integer('has_fallen_trees').notNull().default(0),
  hasWildlife: integer('has_wildlife').notNull().default(0),
  hasErosion: integer('has_erosion').notNull().default(0),
  hasClosures: integer('has_closures').notNull().default(0),
  hasWaterCrossings: integer('has_water_crossings').notNull().default(0),
  waterCrossingCount: integer('water_crossing_count'),
  waterDepth: text('water_depth'),
  waterDifficulty: text('water_difficulty'),
  photoUrls: jsonb('photo_urls').$type<string[]>().notNull().default([]),
  notes: text('notes'),
  trustScore: real('trust_score').notNull().default(1),
  isOffline: integer('is_offline').notNull().default(0),
  verifiedCount: integer('verified_count').notNull().default(0),
  reportedAt: timestamp('reported_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const trailConditionVerifications = pgTable('trail_condition_verifications', {
  id: text('id').primaryKey(),
  conditionId: text('condition_id')
    .references(() => trailConditions.id)
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  isAccurate: integer('is_accurate').notNull().default(1),
  notes: text('notes'),
});
