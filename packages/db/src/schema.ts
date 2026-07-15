import type { PackCategory, WeightUnit } from '@packrat/constants';
import { type InferInsertModel, type InferSelectModel, relations, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
  vector,
} from 'drizzle-orm/pg-core';
import type { ValidationError } from './validation';

const availabilityEnum = pgEnum('availability', ['in_stock', 'out_of_stock', 'preorder']);

// User table
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  role: text('role').default('USER').notNull(),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash'),
  preferences: jsonb('preferences').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Better Auth — session table
export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    impersonatedBy: text('impersonated_by'),
  },
  (table) => [index('session_userId_idx').on(table.userId)],
);

// Better Auth — account table (OAuth + credential provider)
export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    unique('account_provider_account_idx').on(t.providerId, t.accountId),
    index('account_userId_idx').on(t.userId),
  ],
);

// Better Auth — verification table (email/OTP verification tokens)
export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

// Better Auth — jwks table (asymmetric JWT key pairs for jwt() plugin)
export const jwks = pgTable('jwks', {
  id: text('id').primaryKey(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  createdAt: timestamp('created_at').notNull(),
});

// Packs table
export const packs = pgTable('packs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull().$type<PackCategory>(),
  userId: text('user_id')
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Catalog items table
export const catalogItems = pgTable(
  'catalog_items',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    productUrl: text('product_url').notNull(),
    sku: text('sku').unique().notNull(),
    weight: real('weight'),
    weightUnit: text('weight_unit').$type<WeightUnit>(),
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
    weightUnit: text('weight_unit').notNull().$type<WeightUnit>(),
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
    userId: text('user_id')
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
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  packId: text('pack_id')
    .references(() => packs.id, { onDelete: 'cascade' })
    .notNull(),
  weight: real('weight').notNull(),
  localCreatedAt: timestamp('local_created_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const packTemplates = pgTable('pack_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  image: text('image'),
  tags: jsonb('tags').$type<string[]>(),
  isAppTemplate: boolean('is_app_template').notNull().default(false),
  deleted: boolean('deleted').notNull().default(false),
  contentSource: text('content_source'),
  contentId: text('content_id'),

  localCreatedAt: timestamp('local_created_at').notNull(),
  localUpdatedAt: timestamp('local_updated_at').notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const packTemplateItems = pgTable('pack_template_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  weight: real('weight').notNull(),
  weightUnit: text('weight_unit').notNull().$type<WeightUnit>(),
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
  userId: text('user_id')
    .references(() => users.id)
    .notNull(),
  deleted: boolean('deleted').notNull().default(false),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Trail condition reports table
export const trailConditionReports = pgTable(
  'trail_condition_reports',
  {
    id: text('id').primaryKey(),
    trailName: text('trail_name').notNull(),
    trailRegion: text('trail_region'),
    surface: text('surface').notNull(),
    overallCondition: text('overall_condition').notNull(),
    hazards: jsonb('hazards').$type<string[]>().notNull().default([]),
    waterCrossings: integer('water_crossings').notNull().default(0),
    waterCrossingDifficulty: text('water_crossing_difficulty'),
    notes: text('notes'),
    photos: jsonb('photos').$type<string[]>().notNull().default([]),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tripId: text('trip_id').references(() => trips.id, { onDelete: 'set null' }),
    deleted: boolean('deleted').notNull().default(false),
    localCreatedAt: timestamp('local_created_at').notNull(),
    localUpdatedAt: timestamp('local_updated_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('trail_condition_reports_user_id_idx').on(table.userId),
    activeCreatedIdx: index('trail_condition_reports_active_created_idx').on(
      table.deleted,
      table.createdAt.desc(),
    ),
    trailNameIdx: index('trail_condition_reports_trail_name_idx').on(table.trailName),
    tripIdIdx: index('trail_condition_reports_trip_id_idx')
      .on(table.tripId)
      .where(sql`${table.tripId} IS NOT NULL`),
  }),
);

export const trips = pgTable('trips', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  location: jsonb('location').$type<{ latitude: number; longitude: number; name?: string }>(),
  notes: text('notes'),
  userId: text('user_id')
    .references(() => users.id)
    .notNull(),
  packId: text('pack_id').references(() => packs.id, { onDelete: 'set null' }),
  trailOsmId: bigint('trail_osm_id', { mode: 'bigint' }),
  localCreatedAt: timestamp('local_created_at').notNull(),
  localUpdatedAt: timestamp('local_updated_at').notNull(),
  deleted: boolean('deleted').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations

export const packsRelations = relations(packs, ({ one, many }) => ({
  user: one(users, { fields: [packs.userId], references: [users.id] }),
  items: many(packItems),
}));

export const packItemsRelations = relations(packItems, ({ one }) => ({
  pack: one(packs, { fields: [packItems.packId], references: [packs.id] }),
  user: one(users, { fields: [packItems.userId], references: [users.id] }),
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
  pack: one(packs, { fields: [packWeightHistory.packId], references: [packs.id] }),
}));

export const tripsRelations = relations(trips, ({ one }) => ({
  user: one(users, { fields: [trips.userId], references: [users.id] }),
  pack: one(packs, { fields: [trips.packId], references: [packs.id] }),
}));

export const reportedContent = pgTable('reported_content', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .references(() => users.id)
    .notNull(),
  userQuery: text('user_query').notNull(),
  aiResponse: text('ai_response').notNull(),
  reason: text('reason').notNull(),
  userComment: text('user_comment'),
  status: text('status').default('pending').notNull(),
  reviewed: boolean('reviewed').default(false),
  reviewedBy: text('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const reportedContentRelations = relations(reportedContent, ({ one }) => ({
  user: one(users, { fields: [reportedContent.userId], references: [users.id] }),
  reviewer: one(users, { fields: [reportedContent.reviewedBy], references: [users.id] }),
}));

export const packTemplatesRelations = relations(packTemplates, ({ one, many }) => ({
  user: one(users, { fields: [packTemplates.userId], references: [users.id] }),
  items: many(packTemplateItems),
}));

export const packTemplateItemsRelations = relations(packTemplateItems, ({ one }) => ({
  template: one(packTemplates, {
    fields: [packTemplateItems.packTemplateId],
    references: [packTemplates.id],
  }),
  user: one(users, { fields: [packTemplateItems.userId], references: [users.id] }),
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
    scraperRevision: text('scraper_revision').notNull(),
    // Workflows-aware columns. workflowInstanceId links the row to its
    // CatalogEtlWorkflow instance (null on legacy queue-path rows; set on
    // workflow-path rows). totalEmbeddingFailures counts SKUs that were
    // upserted without embeddings because generateManyEmbeddings threw —
    // observable degradation signal for the embedding service.
    workflowInstanceId: text('workflow_instance_id'),
    totalEmbeddingFailures: integer('total_embedding_failures').default(0).notNull(),
    // Post-ingestion row-count verification, written by the admin reconcile
    // endpoint. verifiedRowCount is the logical CSV row count parsed from
    // the R2 source; mismatches against totalProcessed indicate data drift.
    verifiedAt: timestamp('verified_at'),
    verifiedRowCount: integer('verified_row_count'),
    // R2 source provenance captured at ingest time. Repair-from-scratch
    // refuses to re-ingest when the live R2 etag no longer matches the
    // stored value (unless overridden with ?force=true) so a scraper
    // overwrite mid-flight can't be silently re-applied under the old
    // (source, filename).
    sourceEtag: text('source_etag'),
    sourceLastModified: timestamp('source_last_modified'),
    // Audit trail for repair-from-scratch / retry. supersededByJobId
    // points at the ORIGINAL job (the new repair-job row carries the
    // pointer); supersededAt is the time of supersession. CHECK
    // constraint prevents self-reference.
    supersededByJobId: text('superseded_by_job_id').references((): AnyPgColumn => etlJobs.id, {
      onDelete: 'set null',
    }),
    supersededAt: timestamp('superseded_at'),
  },
  (table) => ({
    scraperRevisionIdx: index('etl_jobs_scraper_revision_idx').on(table.scraperRevision),
    workflowInstanceIdIdx: index('etl_jobs_workflow_instance_id_idx').on(table.workflowInstanceId),
    supersededByIdx: index('etl_jobs_superseded_by_idx').on(table.supersededByJobId),
    noSelfSupersede: check(
      'etl_jobs_no_self_supersede',
      sql`${table.supersededByJobId} IS NULL OR ${table.supersededByJobId} <> ${table.id}`,
    ),
  }),
);

export type ETLJob = typeof etlJobs.$inferSelect;
export type NewETLJob = typeof etlJobs.$inferInsert;

export const etlJobsRelations = relations(etlJobs, ({ many }) => ({
  logs: many(invalidItemLogs),
  catalogItems: many(catalogItemEtlJobs),
}));

export const invalidItemLogsRelations = relations(invalidItemLogs, ({ one }) => ({
  job: one(etlJobs, { fields: [invalidItemLogs.jobId], references: [etlJobs.id] }),
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
  etlJob: one(etlJobs, { fields: [catalogItemEtlJobs.etlJobId], references: [etlJobs.id] }),
}));

// Infer model types
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Session = InferSelectModel<typeof session>;
export type NewSession = InferInsertModel<typeof session>;
export type Account = InferSelectModel<typeof account>;
export type NewAccount = InferInsertModel<typeof account>;
export type Verification = InferSelectModel<typeof verification>;
export type NewVerification = InferInsertModel<typeof verification>;
export type Jwks = InferSelectModel<typeof jwks>;
export type NewJwks = InferInsertModel<typeof jwks>;
export type Pack = InferSelectModel<typeof packs>;
export type PackWithItems = Pack & { items: PackItem[] };
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
export type TrailConditionReport = InferSelectModel<typeof trailConditionReports>;
export type NewTrailConditionReport = InferInsertModel<typeof trailConditionReports>;
export type Trip = InferSelectModel<typeof trips>;
export type NewTrip = InferInsertModel<typeof trips>;
export type PackTemplateWithItems = PackTemplate & { items: PackTemplateItem[] };

// Social Feed tables
export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  caption: text('caption'),
  images: jsonb('images').$type<string[]>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const postLikes = pgTable(
  'post_likes',
  {
    id: serial('id').primaryKey(),
    postId: integer('post_id')
      .references(() => posts.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    uniquePostUser: unique('post_likes_post_id_user_id_unique').on(table.postId, table.userId),
  }),
);

export const postComments = pgTable('post_comments', {
  id: serial('id').primaryKey(),
  postId: integer('post_id')
    .references(() => posts.id, { onDelete: 'cascade' })
    .notNull(),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  content: text('content').notNull(),
  parentCommentId: integer('parent_comment_id').references((): AnyPgColumn => postComments.id, {
    onDelete: 'cascade',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const commentLikes = pgTable(
  'comment_likes',
  {
    id: serial('id').primaryKey(),
    commentId: integer('comment_id')
      .references(() => postComments.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueCommentUser: unique('comment_likes_comment_id_user_id_unique').on(
      table.commentId,
      table.userId,
    ),
  }),
);

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, { fields: [posts.userId], references: [users.id] }),
  likes: many(postLikes),
  comments: many(postComments),
}));

export const postLikesRelations = relations(postLikes, ({ one }) => ({
  post: one(posts, { fields: [postLikes.postId], references: [posts.id] }),
  user: one(users, { fields: [postLikes.userId], references: [users.id] }),
}));

export const postCommentsRelations = relations(postComments, ({ one, many }) => ({
  post: one(posts, { fields: [postComments.postId], references: [posts.id] }),
  user: one(users, { fields: [postComments.userId], references: [users.id] }),
  likes: many(commentLikes),
}));

export const commentLikesRelations = relations(commentLikes, ({ one }) => ({
  comment: one(postComments, { fields: [commentLikes.commentId], references: [postComments.id] }),
  user: one(users, { fields: [commentLikes.userId], references: [users.id] }),
}));

export type Post = InferSelectModel<typeof posts>;
export type NewPost = InferInsertModel<typeof posts>;
export type PostLike = InferSelectModel<typeof postLikes>;
export type NewPostLike = InferInsertModel<typeof postLikes>;
export type PostComment = InferSelectModel<typeof postComments>;
export type NewPostComment = InferInsertModel<typeof postComments>;
export type CommentLike = InferSelectModel<typeof commentLikes>;
export type NewCommentLike = InferInsertModel<typeof commentLikes>;

export const featureAccess = pgTable('feature_access', {
  key: text('key').primaryKey(),
  label: text('label').notNull(),
  description: text('description'),
  earlyAccessUntil: timestamp('early_access_until'),
  releasedAt: timestamp('released_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type FeatureAccess = InferSelectModel<typeof featureAccess>;
export type NewFeatureAccess = InferInsertModel<typeof featureAccess>;

// Stores only overrides — a missing key falls back to the coded default in
// packages/config's FeatureFlag map. See packages/api's featureFlagsService.
export const featureFlags = pgTable('feature_flags', {
  key: text('key').primaryKey(),
  enabled: boolean('enabled').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type FeatureFlagRow = InferSelectModel<typeof featureFlags>;
export type NewFeatureFlagRow = InferInsertModel<typeof featureFlags>;

// CapturedQuery is the per-query record stored in D1 metrics (packages/api/src/db/metricsDb.ts).
// Defined here so both the API (queryMetrics.ts) and the D1 schema (packages/db/src/d1Schema.ts)
// share the same type without a circular dependency.
export interface CapturedQuery {
  hash: string;
  preview: string;
  callSite?: string;
  durationMs: number;
  resultBytes: number;
}
