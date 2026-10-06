import { createDb } from '@packrat/api/db';
import { generateManyEmbeddings } from '@packrat/api/services/embeddingService';
import { getEmbeddingText } from '@packrat/api/utils/embeddingHelper';
import type { getEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
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
//
// The items are inserted straight away and the response goes back. Their
// embeddings (search/similarity only, nothing the user sees) are generated
// afterwards in one `embedMany` call via `waitUntil`, so the user waits for the
// insert, not the AI round trip.

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

/** Runs `task` after the response is sent. Outside workerd (unit tests, the
 * OpenAPI generator) there is no request context, so it just runs inline. */
async function runAfterResponse(task: () => Promise<void>): Promise<void> {
  let waitUntil: ((promise: Promise<unknown>) => void) | undefined;
  try {
    // Lazy so plain Bun/Node can load this module without the workerd virtual module.
    ({ waitUntil } = await import('cloudflare:workers'));
  } catch {
    waitUntil = undefined;
  }
  if (waitUntil) waitUntil(task());
  else await task();
}

async function backfillEmbeddings({
  items,
  env,
}: {
  items: { id: string; text: string }[];
  env: ReturnType<typeof getEnv>;
}): Promise<void> {
  try {
    const embeddings = await embedAll({ texts: items.map((i) => i.text), env });
    const db = createDb();
    await Promise.all(
      items.map((item, index) => {
        const embedding = embeddings[index];
        if (!embedding) return Promise.resolve();
        return db
          .tag('packs.applyTemplate.embedding')
          .update(packItems)
          .set({ embedding })
          .where(eq(packItems.id, item.id));
      }),
    );
  } catch (error) {
    // Swallowed: the items are saved; a missing embedding only degrades search.
    captureApiException({
      error,
      operation: 'packs.applyTemplate.backfillEmbeddings',
      extra: { itemCount: items.length },
    });
  }
}

export async function applyPackTemplate({
  packId,
  templateId,
  userId,
  env,
  defer = runAfterResponse,
}: {
  packId: string;
  templateId: string;
  userId: string;
  env: ReturnType<typeof getEnv>;
  /** Injection point for tests; defaults to `waitUntil`. */
  defer?: (task: () => Promise<void>) => Promise<void>;
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

  // Timestamps and defaults are set here rather than read back with
  // `.returning()`, which would ship the row's 1536-dim embedding back from Neon.
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
  const rows: NewPackItem[] = items.map((item) => ({ ...item, embedding: null }));

  await db.transaction(async (tx) => {
    await tx.insert(packItems).values(rows);
    await tx.update(packs).set({ updatedAt: now }).where(eq(packs.id, packId));
  });

  await defer(() =>
    backfillEmbeddings({
      items: items.map((item) => ({ id: item.id, text: getEmbeddingText({ item }) })),
      env,
    }),
  );

  return { ok: true, items };
}
