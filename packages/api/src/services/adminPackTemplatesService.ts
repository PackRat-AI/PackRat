import { createDb } from '@packrat/api/db';
import { resolveAppTemplateOwnerId } from '@packrat/api/services/packTemplateImportService';
import {
  type PackTemplate,
  type PackTemplateItem,
  packTemplateItems,
  packTemplates,
} from '@packrat/db/schema';
import type {
  AdminPackTemplateDetail,
  AdminPackTemplateItemUpdateBody,
  AdminPackTemplateSummary,
  AdminPackTemplateUpdateBody,
} from '@packrat/schemas/admin';
import { isWeightUnit, normalize } from '@packrat/units';
import { and, desc, eq, inArray, isNotNull, or } from 'drizzle-orm';

// Featured-pack curation for the admin console. "Featured" = an app template
// (`is_app_template = true`). Admin imports land as drafts — owned by the
// app-template owner, flagged false — until an admin publishes them, so the
// list covers published app templates plus imported drafts.

function itemWeightGrams(item: Pick<PackTemplateItem, 'weight' | 'weightUnit' | 'quantity'>) {
  const unit = isWeightUnit(item.weightUnit) ? item.weightUnit : 'g';
  return normalize({ weight: item.weight, unit }) * item.quantity;
}

function toSummary({
  template,
  items,
}: {
  template: PackTemplate;
  items: Pick<PackTemplateItem, 'weight' | 'weightUnit' | 'quantity'>[];
}): AdminPackTemplateSummary {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    image: template.image,
    tags: template.tags ?? [],
    isAppTemplate: template.isAppTemplate,
    contentSource: template.contentSource,
    contentId: template.contentId,
    itemCount: items.length,
    totalWeightGrams: Math.round(items.reduce((sum, item) => sum + itemWeightGrams(item), 0)),
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

function toItem(item: PackTemplateItem): AdminPackTemplateDetail['items'][number] {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    weight: item.weight,
    weightUnit: item.weightUnit,
    quantity: item.quantity,
    category: item.category,
    consumable: item.consumable,
    worn: item.worn,
    image: item.image,
    notes: item.notes,
    catalogItemId: item.catalogItemId,
  };
}

async function curatedScope() {
  const ownerId = await resolveAppTemplateOwnerId();
  const draftsFilter = ownerId
    ? and(eq(packTemplates.userId, ownerId), isNotNull(packTemplates.contentSource))
    : undefined;
  return and(
    eq(packTemplates.deleted, false),
    draftsFilter
      ? or(eq(packTemplates.isAppTemplate, true), draftsFilter)
      : eq(packTemplates.isAppTemplate, true),
  );
}

export async function listCuratedPackTemplates(): Promise<AdminPackTemplateSummary[]> {
  const db = createDb();
  const templates = await db
    .tag('adminPackTemplates.list')
    .select()
    .from(packTemplates)
    .where(await curatedScope())
    .orderBy(desc(packTemplates.updatedAt));
  if (templates.length === 0) return [];

  const items = await db
    .tag('adminPackTemplates.listItems')
    .select({
      packTemplateId: packTemplateItems.packTemplateId,
      weight: packTemplateItems.weight,
      weightUnit: packTemplateItems.weightUnit,
      quantity: packTemplateItems.quantity,
    })
    .from(packTemplateItems)
    .where(
      and(
        inArray(
          packTemplateItems.packTemplateId,
          templates.map((t) => t.id),
        ),
        eq(packTemplateItems.deleted, false),
      ),
    );

  return templates.map((template) =>
    toSummary({ template, items: items.filter((i) => i.packTemplateId === template.id) }),
  );
}

export async function getCuratedPackTemplate(id: string): Promise<AdminPackTemplateDetail | null> {
  const db = createDb();
  const template = await db.tag('adminPackTemplates.get').query.packTemplates.findFirst({
    where: and(eq(packTemplates.id, id), eq(packTemplates.deleted, false)),
    with: { items: { where: eq(packTemplateItems.deleted, false) } },
  });
  if (!template) return null;
  const { items, ...rest } = template;
  return { ...toSummary({ template: rest, items }), items: items.map(toItem) };
}

export async function updateCuratedPackTemplate({
  id,
  changes,
}: {
  id: string;
  changes: AdminPackTemplateUpdateBody;
}): Promise<AdminPackTemplateDetail | null> {
  const db = createDb();
  const now = new Date();
  const [updated] = await db
    .tag('adminPackTemplates.update')
    .update(packTemplates)
    .set({ ...changes, updatedAt: now, localUpdatedAt: now })
    .where(and(eq(packTemplates.id, id), eq(packTemplates.deleted, false)))
    .returning();
  if (!updated) return null;
  return getCuratedPackTemplate(id);
}

export async function deleteCuratedPackTemplate(id: string): Promise<boolean> {
  const db = createDb();
  const [deleted] = await db
    .tag('adminPackTemplates.delete')
    .update(packTemplates)
    .set({ deleted: true, isAppTemplate: false, updatedAt: new Date() })
    .where(and(eq(packTemplates.id, id), eq(packTemplates.deleted, false)))
    .returning();
  return Boolean(deleted);
}

export async function updateCuratedPackTemplateItem({
  itemId,
  changes,
}: {
  itemId: string;
  changes: AdminPackTemplateItemUpdateBody;
}): Promise<AdminPackTemplateDetail['items'][number] | null> {
  const db = createDb();
  const [updated] = await db
    .tag('adminPackTemplates.updateItem')
    .update(packTemplateItems)
    .set({ ...changes, updatedAt: new Date() })
    .where(and(eq(packTemplateItems.id, itemId), eq(packTemplateItems.deleted, false)))
    .returning();
  return updated ? toItem(updated) : null;
}

export async function deleteCuratedPackTemplateItem(itemId: string): Promise<boolean> {
  const db = createDb();
  const [deleted] = await db
    .tag('adminPackTemplates.deleteItem')
    .update(packTemplateItems)
    .set({ deleted: true, updatedAt: new Date() })
    .where(and(eq(packTemplateItems.id, itemId), eq(packTemplateItems.deleted, false)))
    .returning();
  return Boolean(deleted);
}
