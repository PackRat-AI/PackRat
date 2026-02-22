import { pgTable, text, timestamp, real, boolean, integer } from 'drizzle-orm/pg-core';

export const natureIdentifications = pgTable('nature_identifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  
  // Image
  imageUrl: text('image_url'),
  imageLocalPath: text('image_local_path'),
  
  // Identification results
  speciesName: text('species_name').notNull(),
  speciesCommonName: text('species_common_name'),
  confidence: real('confidence').notNull(),
  category: text('category').notNull(), // 'plant', 'animal', 'bird', 'insect', 'other'
  
  // Details
  description: text('description'),
  habitat: text('habitat'),
  isEdible: boolean('is_edible'),
  isDangerous: boolean('is_dangerous'),
  
  // Location
  latitude: real('latitude'),
  longitude: real('longitude'),
  locationName: text('location_name'),
  
  // Offline
  isOffline: boolean('is_offline').default(false),
  syncedAt: timestamp('synced_at'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// History of identifications per user
export const natureIdentificationHistory = pgTable('nature_identification_history', {
  id: text('id').primaryKey(),
  identificationId: text('identification_id').notNull().references(() => natureIdentifications.id),
  userId: text('user_id').notNull(),
  viewedAt: timestamp('viewed_at').defaultNow().notNull(),
});
