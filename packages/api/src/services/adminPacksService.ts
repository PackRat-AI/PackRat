import { createDb } from '@packrat/api/db';
import { packItems, packs, users } from '@packrat/db/schema';
import type {
  AdminPackDetail,
  AdminPackTemplateItemCreateBody,
  AdminPackTemplateItemUpdateBody,
  AdminPackUpdateBody,
} from '@packrat/schemas/admin';
import { isWeightUnit, normalize } from '@packrat/units';
import { and, asc, eq } from 'drizzle-orm';

// Pack review for the admin console. Any pack can be viewed; only AI-generated
// packs can be edited, so an admin never rewrites a user's own list. Generated
// packs land private and go live when an admin sets isPublic.

type AdminPackItem = AdminPackDetail['items'][number];

const itemColumns = {
  id: packItems.id,
  name: packItems.name,
  description: packItems.description,
  weight: packItems.weight,
  weightUnit: packItems.weightUnit,
  quantity: packItems.quantity,
  category: packItems.category,
  consumable: packItems.consumable,
  worn: packItems.worn,
  image: packItems.image,
  notes: packItems.notes,
  catalogItemId: packItems.catalogItemId,
};

function itemWeightGrams(item: Pick<AdminPackItem, 'weight' | 'weightUnit' | 'quantity'>) {
  const unit = isWeightUnit(item.weightUnit) ? item.weightUnit : 'g';
  return normalize({ weight: item.weight, unit }) * item.quantity;
}

async function touchPack(packId: string) {
  const now = new Date();
  await createDb()
    .tag('adminPacks.touch')
    .update(packs)
    .set({ updatedAt: now, localUpdatedAt: now })
    .where(eq(packs.id, packId));
}

// pack_items reads go through a projected select: the table carries a
// 1536-dim embedding that must never ship to the console.
async function getItem(itemId: string): Promise<AdminPackItem | null> {
  const [item] = await createDb()
    .tag('adminPacks.getItem')
    .select(itemColumns)
    .from(packItems)
    .where(eq(packItems.id, itemId));
  return item ?? null;
}

async function findEditablePack(packId: string) {
  return createDb()
    .tag('adminPacks.findEditable')
    .query.packs.findFirst({
      columns: { id: true, userId: true },
      where: and(eq(packs.id, packId), eq(packs.deleted, false), eq(packs.isAIGenerated, true)),
    });
}

async function findEditableItemPackId(itemId: string): Promise<string | null> {
  const [row] = await createDb()
    .tag('adminPacks.findEditableItem')
    .select({ packId: packItems.packId })
    .from(packItems)
    .innerJoin(packs, eq(packItems.packId, packs.id))
    .where(
      and(
        eq(packItems.id, itemId),
        eq(packItems.deleted, false),
        eq(packs.deleted, false),
        eq(packs.isAIGenerated, true),
      ),
    );
  return row?.packId ?? null;
}

export async function getAdminPack(id: string): Promise<AdminPackDetail | null> {
  const db = createDb();
  const [pack] = await db
    .tag('adminPacks.get')
    .select({
      id: packs.id,
      name: packs.name,
      description: packs.description,
      category: packs.category,
      image: packs.image,
      tags: packs.tags,
      isPublic: packs.isPublic,
      isAIGenerated: packs.isAIGenerated,
      ownerEmail: users.email,
      createdAt: packs.createdAt,
      updatedAt: packs.updatedAt,
    })
    .from(packs)
    .leftJoin(users, eq(packs.userId, users.id))
    .where(and(eq(packs.id, id), eq(packs.deleted, false)));
  if (!pack) return null;

  const items = await db
    .tag('adminPacks.getItems')
    .select(itemColumns)
    .from(packItems)
    .where(and(eq(packItems.packId, id), eq(packItems.deleted, false)))
    .orderBy(asc(packItems.createdAt));

  return {
    ...pack,
    tags: pack.tags ?? [],
    ownerEmail: pack.ownerEmail ?? null,
    itemCount: items.length,
    totalWeightGrams: Math.round(items.reduce((sum, item) => sum + itemWeightGrams(item), 0)),
    createdAt: pack.createdAt.toISOString(),
    updatedAt: pack.updatedAt.toISOString(),
    items,
  };
}

export async function updateAdminPack({
  id,
  changes,
}: {
  id: string;
  changes: AdminPackUpdateBody;
}): Promise<AdminPackDetail | null> {
  const now = new Date();
  const [updated] = await createDb()
    .tag('adminPacks.update')
    .update(packs)
    .set({ ...changes, updatedAt: now, localUpdatedAt: now })
    .where(and(eq(packs.id, id), eq(packs.deleted, false), eq(packs.isAIGenerated, true)))
    .returning();
  if (!updated) return null;
  return getAdminPack(id);
}

export async function createAdminPackItem({
  packId,
  item,
}: {
  packId: string;
  item: AdminPackTemplateItemCreateBody;
}): Promise<AdminPackItem | null> {
  const pack = await findEditablePack(packId);
  if (!pack) return null;

  // Items belong to the pack's owner, matching what generation creates.
  const id = crypto.randomUUID();
  await createDb()
    .tag('adminPacks.createItem')
    .insert(packItems)
    .values({
      id,
      packId: pack.id,
      userId: pack.userId,
      name: item.name,
      description: item.description ?? null,
      weight: item.weight,
      weightUnit: item.weightUnit,
      quantity: item.quantity ?? 1,
      category: item.category ?? null,
      consumable: item.consumable ?? false,
      worn: item.worn ?? false,
      notes: item.notes ?? null,
    });
  await touchPack(pack.id);
  return getItem(id);
}

export async function updateAdminPackItem({
  itemId,
  changes,
}: {
  itemId: string;
  changes: AdminPackTemplateItemUpdateBody;
}): Promise<AdminPackItem | null> {
  const packId = await findEditableItemPackId(itemId);
  if (!packId) return null;
  await createDb()
    .tag('adminPacks.updateItem')
    .update(packItems)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(packItems.id, itemId));
  await touchPack(packId);
  return getItem(itemId);
}

export async function deleteAdminPackItem(itemId: string): Promise<boolean> {
  const packId = await findEditableItemPackId(itemId);
  if (!packId) return false;
  await createDb()
    .tag('adminPacks.deleteItem')
    .update(packItems)
    .set({ deleted: true, updatedAt: new Date() })
    .where(eq(packItems.id, itemId));
  await touchPack(packId);
  return true;
}
