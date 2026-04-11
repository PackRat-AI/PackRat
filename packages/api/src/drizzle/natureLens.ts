import { integer, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../db/schema';

export const natureIdentifications = pgTable('nature_identifications', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  imageUrl: text('image_url'),
  speciesName: text('species_name').notNull(),
  speciesCommonName: text('species_common_name').notNull(),
  confidence: real('confidence').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  habitat: text('habitat').notNull(),
  isEdible: integer('is_edible').notNull().default(0),
  isDangerous: integer('is_dangerous').notNull().default(0),
  latitude: real('latitude'),
  longitude: real('longitude'),
  locationName: text('location_name'),
  isOffline: integer('is_offline').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
