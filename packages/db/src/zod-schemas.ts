import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import {
  catalogItemEtlJobs,
  catalogItems,
  etlJobs,
  invalidItemLogs,
  packItems,
  packs,
  packTemplateItems,
  packTemplates,
  packWeightHistory,
  reportedContent,
  users,
} from './schema';

export const selectUserSchema = createSelectSchema(users);
export const insertUserSchema = createInsertSchema(users);

export const selectPackSchema = createSelectSchema(packs);
export const insertPackSchema = createInsertSchema(packs);
export const selectPackItemSchema = createSelectSchema(packItems);
export const insertPackItemSchema = createInsertSchema(packItems);
export const selectPackWeightHistorySchema = createSelectSchema(packWeightHistory);
export const insertPackWeightHistorySchema = createInsertSchema(packWeightHistory);

export const selectCatalogItemSchema = createSelectSchema(catalogItems);
export const insertCatalogItemSchema = createInsertSchema(catalogItems);

export const selectPackTemplateSchema = createSelectSchema(packTemplates);
export const insertPackTemplateSchema = createInsertSchema(packTemplates);
export const selectPackTemplateItemSchema = createSelectSchema(packTemplateItems);
export const insertPackTemplateItemSchema = createInsertSchema(packTemplateItems);

export const selectReportedContentSchema = createSelectSchema(reportedContent);
export const insertReportedContentSchema = createInsertSchema(reportedContent);
export const selectInvalidItemLogSchema = createSelectSchema(invalidItemLogs);
export const insertInvalidItemLogSchema = createInsertSchema(invalidItemLogs);
export const selectEtlJobSchema = createSelectSchema(etlJobs);
export const insertEtlJobSchema = createInsertSchema(etlJobs);
export const selectCatalogItemEtlJobSchema = createSelectSchema(catalogItemEtlJobs);
export const insertCatalogItemEtlJobSchema = createInsertSchema(catalogItemEtlJobs);
