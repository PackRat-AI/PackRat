import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import {
  authProviders,
  catalogItemEtlJobs,
  catalogItems,
  etlJobs,
  invalidItemLogs,
  oneTimePasswords,
  packItems,
  packs,
  packTemplateItems,
  packTemplates,
  packWeightHistory,
  refreshTokens,
  reportedContent,
  users,
} from './schema';

// User schemas
export const selectUserSchema = createSelectSchema(users);
export const insertUserSchema = createInsertSchema(users);

// Auth schemas
export const selectAuthProviderSchema = createSelectSchema(authProviders);
export const insertAuthProviderSchema = createInsertSchema(authProviders);
export const selectRefreshTokenSchema = createSelectSchema(refreshTokens);
export const insertRefreshTokenSchema = createInsertSchema(refreshTokens);
export const selectOneTimePasswordSchema = createSelectSchema(oneTimePasswords);
export const insertOneTimePasswordSchema = createInsertSchema(oneTimePasswords);

// Pack schemas
export const selectPackSchema = createSelectSchema(packs);
export const insertPackSchema = createInsertSchema(packs);
export const selectPackItemSchema = createSelectSchema(packItems);
export const insertPackItemSchema = createInsertSchema(packItems);
export const selectPackWeightHistorySchema = createSelectSchema(packWeightHistory);
export const insertPackWeightHistorySchema = createInsertSchema(packWeightHistory);

// Catalog schemas
export const selectCatalogItemSchema = createSelectSchema(catalogItems);
export const insertCatalogItemSchema = createInsertSchema(catalogItems);

// Pack template schemas
export const selectPackTemplateSchema = createSelectSchema(packTemplates);
export const insertPackTemplateSchema = createInsertSchema(packTemplates);
export const selectPackTemplateItemSchema = createSelectSchema(packTemplateItems);
export const insertPackTemplateItemSchema = createInsertSchema(packTemplateItems);

// ETL and reporting schemas
export const selectReportedContentSchema = createSelectSchema(reportedContent);
export const insertReportedContentSchema = createInsertSchema(reportedContent);
export const selectInvalidItemLogSchema = createSelectSchema(invalidItemLogs);
export const insertInvalidItemLogSchema = createInsertSchema(invalidItemLogs);
export const selectEtlJobSchema = createSelectSchema(etlJobs);
export const insertEtlJobSchema = createInsertSchema(etlJobs);
export const selectCatalogItemEtlJobSchema = createSelectSchema(catalogItemEtlJobs);
export const insertCatalogItemEtlJobSchema = createInsertSchema(catalogItemEtlJobs);
