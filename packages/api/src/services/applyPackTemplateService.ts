import { createDb } from '@packrat/api/db';
import { generateManyEmbeddings } from '@packrat/api/services/embeddingService';
import { getEmbeddingText } from '@packrat/api/utils/embeddingHelper';
import type { getEnv } from '@packrat/api/utils/env-validation';
import {
  type NewPackItem,
  packItems,
  packs,
  packTemplateItems,
  packTemplates,
} from '@packrat/db/schema';
import { and, eq, or } from 'drizzle-orm';

// Copies a template's active items into a pack in one request. Replaces the
// client-side loop of one POST per item, where each POST paid for its own
// embedding round trip — a 30-item template meant 30 serial OpenAI calls.
// Here every item shares a single `embedMany` call and a single insert.

export type AppliedPackItem = Omit<typeof packItems.$inferSelect, 'embedding'>;

export type ApplyPackTemplateResult =
  | { ok: true; items: AppliedPackItem[] }
  | { ok: false; reason: 'pack_not_found' | 'template_not_found' };

async function embedAll({
  texts,
  env,
}: {
  texts: string[];
  env: ReturnType<typeof getEnv>;
}): Promise<(number[] | null)[]> {
  try {
    const embeddings = await generateManyEmbeddings({
      openAiApiKey: env.OPENAI_API_KEY,
      values: texts,
      provider: env.AI_PROVIDER,
      cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID,
      cloudflareGatewayId: env.CLOUDFLARE_AI_GATEWAY_ID,
      cloudflareApiToken: env.CLOUDFLARE_API_TOKEN,
      cloudflareAiBinding: env.AI,
    });
    // generateManyEmbeddings drops blank inputs, which would shift indexes.
    // Only trust the result when it lines up one-to-one.
    if (embeddings.length === texts.length) return embeddings;
  } catch (error) {
    console.warn('pack_items.embedding.fallback', {
      error: error instanceof Error ? error.message : 'Unknown embedding error',
    });
  }
  // Same fallback as single-item add: the item is saved without an embedding.
  return texts.map(() => null);
}

export async function applyPackTemplate({
  packId,
  templateId,
  userId,
  env,
}: {
  packId: string;
  templateId: string;
  userId: string;
  env: ReturnType<typeof getEnv>;
}): Promise<ApplyPackTemplateResult> {
  const db = createDb();

  const [pack] = await db
    .tag('packs.applyTemplate.pack')
    .select({ id: packs.id })
    .from(packs)
    .where(and(eq(packs.id, packId), eq(packs.userId, userId), eq(packs.deleted, false)))
    .limit(1);
  if (!pack) return { ok: false, reason: 'pack_not_found' };

  const template = await db.tag('packs.applyTemplate.template').query.packTemplates.findFirst({
    columns: { id: true },
    where: and(
      eq(packTemplates.id, templateId),
      eq(packTemplates.deleted, false),
      or(eq(packTemplates.userId, userId), eq(packTemplates.isAppTemplate, true)),
    ),
    with: { items: { where: eq(packTemplateItems.deleted, false) } },
  });
  if (!template) return { ok: false, reason: 'template_not_found' };
  if (template.items.length === 0) return { ok: true, items: [] };

  const embeddings = await embedAll({
    texts: template.items.map((item) => getEmbeddingText({ item })),
    env,
  });

  // Timestamps and defaults are set here rather than read back with
  // `.returning()`, which would ship every 1536-dim embedding back from Neon.
  const now = new Date();
  const items: AppliedPackItem[] = template.items.map((item) => ({
    id: crypto.randomUUID(),
    packId,
    userId,
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
    templateItemId: item.id,
    deleted: false,
    isAIGenerated: false,
    createdAt: now,
    updatedAt: now,
  }));
  const rows: NewPackItem[] = items.map((item, index) => ({
    ...item,
    embedding: embeddings[index] ?? null,
  }));

  await db.transaction(async (tx) => {
    await tx.insert(packItems).values(rows);
    await tx.update(packs).set({ updatedAt: now }).where(eq(packs.id, packId));
  });

  return { ok: true, items };
}
