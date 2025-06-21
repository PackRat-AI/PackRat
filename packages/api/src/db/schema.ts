import { InferInsertModel, InferSelectModel, relations } from 'drizzle-orm';
import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  varchar,
  real,
} from "drizzle-orm/pg-core";

// User table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').unique().notNull(),
  emailVerified: boolean('email_verified').default(false),
  passwordHash: text('password_hash'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  role: text('role').default('USER'), // 'USER', 'ADMIN'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Authentication providers table
export const authProviders = pgTable('auth_providers', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  provider: text('provider').notNull(), // 'email', 'google', 'apple'
  providerId: text('provider_id'), // ID from the provider
  createdAt: timestamp('created_at').defaultNow(),
});

// Refresh tokens table
export const refreshTokens = pgTable('refresh_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
  replacedByToken: text('replaced_by_token'),
});

// One-time password table
export const oneTimePasswords = pgTable('one_time_passwords', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 6 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Packs table
export const packs = pgTable('packs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  isPublic: boolean('is_public').default(false),
  image: text('image'),
  tags: jsonb('tags').$type<string[]>(),
  deleted: boolean('deleted').default(false),
  localCreatedAt: timestamp('local_created_at').notNull(),
  localUpdatedAt: timestamp('local_updated_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(), // for controlling sync. controlled by server.
  updatedAt: timestamp('updated_at').defaultNow().notNull(), // for controlling sync. controlled by server.
});

// Catalog items table
export const catalogItems = pgTable('catalog_items', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  defaultWeight: real('default_weight'),
  defaultWeightUnit: text('default_weight_unit'),
  category: text('category'),
  image: text('image'),
  brand: text('brand'),
  model: text('model'),
  url: text('url'),
  ratingValue: real('rating_value'),
  productUrl: text('product_url'),
  color: text('color'),
  size: text('size'),
  sku: text('sku'),
  price: real('price'),
  availability: text('availability'),
  seller: text('seller'),
  productSku: text('product_sku'),
  material: text('material'),
  currency: text('currency'),
  condition: text('condition'),
  techs: jsonb('techs').$type<Record<string, string>>(),
  links: jsonb('links').$type<
    Array<{
      id: string;
      title: string;
      url: string;
      type: string;
    }>
  >(),
  reviews: jsonb('reviews').$type<
    Array<{
      id: string;
      userId: string;
      userName: string;
      userAvatar: string;
      rating: number;
      text: string;
      date: string;
      helpful: number;
      verified: boolean;
    }>
  >(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Pack items table
export const packItems = pgTable('pack_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  weight: real('weight').notNull(),
  weightUnit: text('weight_unit').notNull(),
  quantity: integer('quantity').default(1).notNull(),
  category: text('category'),
  consumable: boolean('consumable').default(false),
  worn: boolean('worn').default(false),
  image: text('image'),
  notes: text('notes'),
  packId: text('pack_id')
    .references(() => packs.id, { onDelete: 'cascade' })
    .notNull(),
  catalogItemId: integer('catalog_item_id').references(() => catalogItems.id),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  deleted: boolean('deleted').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const packWeightHistory = pgTable('weight_history', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  packId: text('pack_id')
    .references(() => packs.id, { onDelete: 'cascade' })
    .notNull(),
  weight: real('weight').notNull(),
  localCreatedAt: timestamp('local_created_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Define relations

export const packsRelations = relations(packs, ({ one, many }) => ({
  user: one(users, {
    fields: [packs.userId],
    references: [users.id],
  }),
  items: many(packItems),
}));

export const packItemsRelations = relations(packItems, ({ one }) => ({
  pack: one(packs, {
    fields: [packItems.packId],
    references: [packs.id],
  }),
  user: one(users, {
    fields: [packItems.userId],
    references: [users.id],
  }),
  catalogItem: one(catalogItems, {
    fields: [packItems.catalogItemId],
    references: [catalogItems.id],
  }),
}));

export const catalogItemsRelations = relations(catalogItems, ({ many }) => ({
  packItems: many(packItems),
}));

export const packWeightHistoryRelations = relations(
  packWeightHistory,
  ({ one }) => ({
    pack: one(packs, {
      fields: [packWeightHistory.packId],
      references: [packs.id],
    }),
  })
);

// Reported content table
export const reportedContent = pgTable('reported_content', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  userQuery: text('user_query').notNull(),
  aiResponse: text('ai_response').notNull(),
  reason: text('reason').notNull(),
  userComment: text('user_comment'),
  status: text('status').default('pending').notNull(), // pending, reviewed, dismissed
  reviewed: boolean('reviewed').default(false),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const reportedContentRelations = relations(
  reportedContent,
  ({ one }) => ({
    user: one(users, {
      fields: [reportedContent.userId],
      references: [users.id],
    }),
    reviewer: one(users, {
      fields: [reportedContent.reviewedBy],
      references: [users.id],
    }),
  })
);

// Infer models from tables
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type AuthProvider = InferSelectModel<typeof authProviders>;
export type NewAuthProvider = InferInsertModel<typeof authProviders>;

export type RefreshToken = InferSelectModel<typeof refreshTokens>;
export type NewRefreshToken = InferInsertModel<typeof refreshTokens>;

export type OneTimePassword = InferSelectModel<typeof oneTimePasswords>;
export type NewOneTimePassword = InferInsertModel<typeof oneTimePasswords>;

export type Pack = InferSelectModel<typeof packs>;
export type PackWithItems = Pack & {
  items: PackItem[];
};
export type NewPack = InferInsertModel<typeof packs>;

export type CatalogItem = InferSelectModel<typeof catalogItems>;
export type NewCatalogItem = InferInsertModel<typeof catalogItems>;

export type PackItem = InferSelectModel<typeof packItems>;
export type NewPackItem = InferInsertModel<typeof packItems>;

export type ReportedContent = InferSelectModel<typeof reportedContent>;
export type NewReportedContent = InferInsertModel<typeof reportedContent>;
