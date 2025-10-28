import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
  vector,
} from 'drizzle-orm/pg-core';
import type { ValidationError } from '../types/etl';

const availabilityEnum = pgEnum('availability', ['in_stock', 'out_of_stock', 'preorder']);

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
  templateId: text('template_id').references(() => packTemplates.id),

  isPublic: boolean('is_public').notNull().default(false),
  image: text('image'),
  tags: jsonb('tags').$type<string[]>(),
  deleted: boolean('deleted').notNull().default(false),
  isAIGenerated: boolean('is_ai_generated').notNull().default(false),
  localCreatedAt: timestamp('local_created_at').notNull(),
  localUpdatedAt: timestamp('local_updated_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(), // for controlling sync. controlled by server.
  updatedAt: timestamp('updated_at').defaultNow().notNull(), // for controlling sync. controlled by server.
});

// Catalog items table
export const catalogItems = pgTable(
  'catalog_items',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    productUrl: text('product_url').notNull(),
    sku: text('sku').unique().notNull(),
    weight: real('weight').notNull(),
    weightUnit: text('weight_unit').notNull(),
    description: text('description'),
    categories: jsonb('categories').$type<string[]>(),
    images: jsonb('images').$type<string[]>(),
    brand: text('brand'),
    model: text('model'),
    ratingValue: real('rating_value'),
    color: text('color'),
    size: text('size'),
    price: real('price'),
    availability: availabilityEnum('availability'),
    seller: text('seller'),
    productSku: text('product_sku'),
    material: text('material'),
    currency: text('currency'),
    condition: text('condition'),
    reviewCount: integer('review_count'),

    variants:
      jsonb('variants').$type<
        Array<{
          attribute: string;
          values: string[];
        }>
      >(),

    techs: jsonb('techs').$type<Record<string, string>>(),

    links:
      jsonb('links').$type<
        Array<{
          title: string;
          url: string;
        }>
      >(),

    reviews:
      jsonb('reviews').$type<
        Array<{
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
        }>
      >(),

    qas: jsonb('qas').$type<
      Array<{
        question: string;
        user?: string | null;
        date: string;
        answers: Array<{
          a: string;
          date: string;
          user?: string | null;
          upvotes?: number | null;
        }>;
      }>
    >(),

    faqs: jsonb('faqs').$type<
      Array<{
        question: string;
        answer: string;
      }>
    >(),
    embedding: vector('embedding', { dimensions: 1536 }),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    embeddingIndex: index('embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  }),
);

// Pack items table
export const packItems = pgTable(
  'pack_items',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    weight: real('weight').notNull(),
    weightUnit: text('weight_unit').notNull(),
    quantity: integer('quantity').default(1).notNull(),
    category: text('category'),
    consumable: boolean('consumable').notNull().default(false),
    worn: boolean('worn').notNull().default(false),
    image: text('image'),
    notes: text('notes'),
    packId: text('pack_id')
      .references(() => packs.id, { onDelete: 'cascade' })
      .notNull(),
    catalogItemId: integer('catalog_item_id').references(() => catalogItems.id),
    userId: integer('user_id')
      .references(() => users.id)
      .notNull(),
    deleted: boolean('deleted').notNull().default(false),
    isAIGenerated: boolean('is_ai_generated').notNull().default(false),
    templateItemId: text('template_item_id').references(() => packTemplateItems.id),
    embedding: vector('embedding', { dimensions: 1536 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    embeddingIndex: index('pack_items_embedding_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  }),
);

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

//Pack Template table
export const packTemplates = pgTable('pack_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  image: text('image'),
  tags: jsonb('tags').$type<string[]>(),
  isAppTemplate: boolean('is_app_template').notNull().default(false),
  deleted: boolean('deleted').notNull().default(false),

  localCreatedAt: timestamp('local_created_at').notNull(),
  localUpdatedAt: timestamp('local_updated_at').notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

//Pack Template Item table
export const packTemplateItems = pgTable('pack_template_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  weight: real('weight').notNull(),
  weightUnit: text('weight_unit').notNull(),
  quantity: integer('quantity').default(1).notNull(),
  category: text('category'),
  consumable: boolean('consumable').notNull().default(false),
  worn: boolean('worn').notNull().default(false),
  image: text('image'),
  notes: text('notes'),
  packTemplateId: text('pack_template_id')
    .references(() => packTemplates.id, { onDelete: 'cascade' })
    .notNull(),
  catalogItemId: integer('catalog_item_id').references(() => catalogItems.id),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  deleted: boolean('deleted').notNull().default(false),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const trips = pgTable('trips', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  location: jsonb('location').$type<{ latitude: number; longitude: number; name?: string }>(),
  notes: text('notes'),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  packId: text('pack_id').references(() => packs.id, { onDelete: 'set null' }),
  localCreatedAt: timestamp('local_created_at').notNull(),
  localUpdatedAt: timestamp('local_updated_at').notNull(),
  deleted: boolean('deleted').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
  etlJobs: many(catalogItemEtlJobs),
}));

export const packWeightHistoryRelations = relations(packWeightHistory, ({ one }) => ({
  pack: one(packs, {
    fields: [packWeightHistory.packId],
    references: [packs.id],
  }),
}));
// Trips relations
export const tripsRelations = relations(trips, ({ one }) => ({
  user: one(users, {
    fields: [trips.userId],
    references: [users.id],
  }),
  pack: one(packs, {
    fields: [trips.packId],
    references: [packs.id],
  }),
}));

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

export const reportedContentRelations = relations(reportedContent, ({ one }) => ({
  user: one(users, {
    fields: [reportedContent.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [reportedContent.reviewedBy],
    references: [users.id],
  }),
}));

export const packTemplatesRelations = relations(packTemplates, ({ one, many }) => ({
  user: one(users, {
    fields: [packTemplates.userId],
    references: [users.id],
  }),
  items: many(packTemplateItems),
}));

export const packTemplateItemsRelations = relations(packTemplateItems, ({ one }) => ({
  template: one(packTemplates, {
    fields: [packTemplateItems.packTemplateId],
    references: [packTemplates.id],
  }),
  user: one(users, {
    fields: [packTemplateItems.userId],
    references: [users.id],
  }),
  catalogItem: one(catalogItems, {
    fields: [packTemplateItems.catalogItemId],
    references: [catalogItems.id],
  }),
}));

export const invalidItemLogs = pgTable('invalid_item_logs', {
  id: serial('id').primaryKey(),
  jobId: text('job_id')
    .references(() => etlJobs.id)
    .notNull(),
  errors: jsonb('errors').notNull().$type<ValidationError[]>(),
  rawData: jsonb('raw_data').notNull(),
  rowIndex: integer('row_index').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type InvalidItemLog = typeof invalidItemLogs.$inferSelect;
export type NewInvalidItemLog = typeof invalidItemLogs.$inferInsert;

const etlJobStatusEnum = pgEnum('etl_job_status', ['running', 'completed', 'failed']);

export const etlJobs = pgTable(
  'etl_jobs',
  {
    id: text('id').primaryKey(),
    status: etlJobStatusEnum('status').notNull(),
    source: text('source').notNull(),
    filename: text('filename').notNull(),
    startedAt: timestamp('started_at').notNull(),
    completedAt: timestamp('completed_at'),
    totalProcessed: integer('total_processed'),
    totalValid: integer('total_valid'),
    totalInvalid: integer('total_invalid'),
    scraperRevision: text('scraper_revision').notNull(), // Git commit SHA or tag
  },
  (table) => ({
    scraperRevisionIdx: index('etl_jobs_scraper_revision_idx').on(table.scraperRevision),
  }),
);

export type ETLJob = typeof etlJobs.$inferSelect;
export type NewETLJob = typeof etlJobs.$inferInsert;

export const etlJobsRelations = relations(etlJobs, ({ many }) => ({
  logs: many(invalidItemLogs),
  catalogItems: many(catalogItemEtlJobs),
}));

export const invalidItemLogsRelations = relations(invalidItemLogs, ({ one }) => ({
  job: one(etlJobs, {
    fields: [invalidItemLogs.jobId],
    references: [etlJobs.id],
  }),
}));

export const catalogItemEtlJobs = pgTable('catalog_item_etl_jobs', {
  id: serial('id').primaryKey(),
  catalogItemId: integer('catalog_item_id')
    .references(() => catalogItems.id, { onDelete: 'cascade' })
    .notNull(),
  etlJobId: text('etl_job_id')
    .references(() => etlJobs.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const catalogItemEtlJobsRelations = relations(catalogItemEtlJobs, ({ one }) => ({
  catalogItem: one(catalogItems, {
    fields: [catalogItemEtlJobs.catalogItemId],
    references: [catalogItems.id],
  }),
  etlJob: one(etlJobs, {
    fields: [catalogItemEtlJobs.etlJobId],
    references: [etlJobs.id],
  }),
}));

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

export type PackTemplate = InferSelectModel<typeof packTemplates>;
export type NewPackTemplate = InferInsertModel<typeof packTemplates>;

export type PackTemplateItem = InferSelectModel<typeof packTemplateItems>;
export type NewPackTemplateItem = InferInsertModel<typeof packTemplateItems>;

export type Trip = InferSelectModel<typeof trips>;
export type NewTrip = InferInsertModel<typeof trips>;

export type PackTemplateWithItems = PackTemplate & {
  items: PackTemplateItem[];
};
