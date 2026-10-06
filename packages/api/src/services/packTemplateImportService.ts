import { createDb } from '@packrat/api/db';
import { CatalogService } from '@packrat/api/services/catalogService';
import { createGoogleAIProvider } from '@packrat/api/utils/ai/provider';
import { getEnv } from '@packrat/api/utils/env-validation';
import { setQueryTag } from '@packrat/api/utils/queryMetrics';
import {
  type PackTemplateWithItems,
  packTemplateItems,
  packTemplates,
  users,
} from '@packrat/db/schema';
import { AIPackAnalysisSchema } from '@packrat/schemas/packTemplates';
import { safeJsonStringify } from '@packrat/utils';
import { and, asc, eq } from 'drizzle-orm';
import { fetchTranscript } from 'youtube-transcript';

// Imports a creator "what I pack" post (TikTok slideshow/video or YouTube
// transcript) into a pack template: fetch → Gemini gear extraction → catalog
// match per item → one template + items in a transaction. Shared by the
// user-facing route and the admin curation route.

const QUERY_STRIP_RE = /[?&].*$/;
const STRIP_HYPHENS = /-/g;

const SYSTEM_PROMPT = `You are an expert outdoor gear analyst. You will be shown content from TikTok or YouTube featuring packing content (e.g., a gear lay-flat, kit breakdown, or packing list). This content may be either images (slideshow), a video or video transcript. Your task is to:

1. Identify every outdoor gear or equipment item visible in the images/video or mentioned in the caption/transcript.
2. For each item, provide a specific name, description, category, weight estimate (in grams), quantity, and flags for whether it is consumable or worn.
3. Also determine an appropriate pack template name and category (one of: hiking, backpacking, camping, climbing, winter, desert, custom, water sports, skiing) for this overall kit.

For video content: Analyze the video frames to identify gear items shown throughout the video. Pay attention to any gear being packed, displayed, or mentioned.
For slideshow content: Analyze each image to identify all visible gear items.

Focus on items that would realistically appear in an outdoor adventure packing list. Be thorough — identify every item you can see or infer.`;

function generateContentIdFromUrl(url: string): string {
  const normalizedUrl = url.toLowerCase().replace(QUERY_STRIP_RE, '');
  let hash = 0;
  for (let i = 0; i < normalizedUrl.length; i++) {
    const char = normalizedUrl.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `url_${Math.abs(hash).toString(16)}`;
}

async function fetchTikTokPostData(
  url: string,
): Promise<{ imageUrls: string[]; videoUrl?: string; caption?: string; contentId?: string }> {
  // Lazy-imported so `bun generate:openapi` can walk the routes' schemas in plain
  // Bun (outside the Workers runtime) without `@cloudflare/containers` trying to
  // resolve the `cloudflare:workers` virtual module at module-load time.
  const { getContainer } = await import('@cloudflare/containers');
  const { APP_CONTAINER } = getEnv();
  const container = getContainer(APP_CONTAINER);

  const response = await container.fetch(
    new Request('http://container/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: safeJsonStringify({ tiktokUrl: url }),
    }),
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TikTok container error (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as {
    success: boolean;
    data?: { imageUrls: string[]; videoUrl?: string; caption?: string; contentId?: string };
    error?: string;
  };

  if (!result.success) {
    throw new Error(result.error || 'TikTok container returned failure');
  }

  return {
    imageUrls: result.data?.imageUrls || [],
    videoUrl: result.data?.videoUrl,
    caption: result.data?.caption,
    contentId: result.data?.contentId,
  };
}

export function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace('www.', '');
    return hostname === 'youtube.com' || hostname === 'youtu.be';
  } catch {
    return false;
  }
}

export function getYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace('www.', '');
    if (host === 'youtu.be') return parsed.pathname.slice(1);
    if (host === 'youtube.com') return parsed.searchParams.get('v');
    return null;
  } catch {
    return null;
  }
}

type FetchedContent = {
  contentSource: 'youtube' | 'tiktok';
  contentId?: string | undefined;
  transcript?: string | undefined;
  imageUrls: string[];
  videoUrl?: string | undefined;
  caption?: string | undefined;
};

async function fetchOnlineContent(contentUrl: string): Promise<FetchedContent> {
  if (isYouTubeUrl(contentUrl)) {
    const youtubeId = getYouTubeId(contentUrl);
    if (!youtubeId) throw new Error('Invalid YouTube URL');
    const transcript = (await fetchTranscript(youtubeId))
      .reduce((acc, curr) => `${acc} ${curr.text}`, '')
      .trim();
    return { contentSource: 'youtube', contentId: youtubeId, transcript, imageUrls: [] };
  }
  const data = await fetchTikTokPostData(contentUrl);
  return { contentSource: 'tiktok', ...data };
}

type TextPart = { type: 'text'; text: string };
type ImagePart = { type: 'image'; image: string };
type FilePart = { type: 'file'; data: string; mediaType: string };

function buildPromptParts(content: FetchedContent): Array<TextPart | ImagePart | FilePart> {
  const { transcript, videoUrl, imageUrls, caption } = content;
  const captionPrefix = caption ? `Retrieved Caption: ${caption}\n\n` : '';
  if (transcript) {
    return [
      {
        type: 'text',
        text: 'Please analyze the YouTube video transcript below and identify all packing/gear items:',
      },
      { type: 'text', text: transcript },
    ];
  }
  if (videoUrl) {
    return [
      {
        type: 'text',
        text: `${captionPrefix}Please analyze the following TikTok video and identify all packing/gear items:`,
      },
      { type: 'file', data: videoUrl, mediaType: 'video/mp4' },
    ];
  }
  if (imageUrls.length > 0) {
    return [
      {
        type: 'text',
        text: `${captionPrefix}Please analyze the following slideshow images and identify all packing/gear items:`,
      },
      ...imageUrls.map((image): ImagePart => ({ type: 'image', image })),
    ];
  }
  throw new Error('No content found in TikTok post (no images or video)');
}

export type ImportFromOnlineContentResult =
  | { ok: true; template: PackTemplateWithItems }
  | { ok: false; reason: 'invalid_url' }
  | { ok: false; reason: 'fetch_failed'; message: string }
  | { ok: false; reason: 'duplicate'; existingTemplateId: string };

/**
 * Throws on AI, catalog and DB failures — callers map them with
 * `classifyImportError`. Expected outcomes (bad URL, unreachable post,
 * already-imported post) come back as `{ ok: false }`.
 */
export async function importPackTemplateFromOnlineContent({
  contentUrl,
  ownerUserId,
  isAppTemplate,
}: {
  contentUrl: string;
  ownerUserId: string;
  isAppTemplate: boolean;
}): Promise<ImportFromOnlineContentResult> {
  try {
    new URL(contentUrl);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }

  let content: FetchedContent;
  try {
    content = await fetchOnlineContent(contentUrl);
  } catch (error) {
    console.error('Content service call failed:', error);
    return {
      ok: false,
      reason: 'fetch_failed',
      message: error instanceof Error ? error.message : 'Service unavailable',
    };
  }

  const contentId = content.contentId || generateContentIdFromUrl(contentUrl);
  const db = createDb();
  const [existing] = await db
    .tag('packTemplates.checkDuplicate')
    .select({ id: packTemplates.id })
    .from(packTemplates)
    .where(
      and(
        eq(packTemplates.contentSource, content.contentSource),
        eq(packTemplates.contentId, contentId),
        eq(packTemplates.deleted, false),
      ),
    )
    .limit(1);
  if (existing) return { ok: false, reason: 'duplicate', existingTemplateId: existing.id };

  const {
    GOOGLE_GENERATIVE_AI_API_KEY,
    CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_AI_GATEWAY_ID,
    CLOUDFLARE_API_TOKEN,
    AI,
  } = getEnv();
  const google = createGoogleAIProvider({
    googleApiKey: GOOGLE_GENERATIVE_AI_API_KEY,
    cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID,
    cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID,
    cloudflareApiToken: CLOUDFLARE_API_TOKEN,
    cloudflareAiBinding: AI,
  });

  const { generateObject } = await import('ai');
  const { object: analysis } = await generateObject({
    model: google('gemini-3-flash-preview'),
    schema: AIPackAnalysisSchema,
    system: SYSTEM_PROMPT,
    prompt: [{ role: 'user', content: buildPromptParts(content) }],
    temperature: 0.2,
  });

  const searchQueries = analysis.items.map((item) => `${item.name} ${item.description}`.trim());
  const batchResult =
    searchQueries.length > 0
      ? await new CatalogService().batchVectorSearch({ queries: searchQueries, limit: 1 })
      : { items: [] as never[] };

  const now = new Date();
  const templateId = `pt_${crypto.randomUUID().replace(STRIP_HYPHENS, '').slice(0, 21)}`;

  const template = await db.transaction(async (tx) => {
    setQueryTag('packTemplates.createFromContent');
    const [createdTemplate] = await tx
      .insert(packTemplates)
      .values({
        id: templateId,
        userId: ownerUserId,
        name: analysis.templateName,
        description: analysis.templateDescription,
        category: analysis.templateCategory,
        image: null,
        tags: [analysis.templateCategory],
        isAppTemplate,
        deleted: false,
        contentSource: content.contentSource,
        contentId,
        localCreatedAt: now,
        localUpdatedAt: now,
      })
      .returning();
    if (!createdTemplate) throw new Error('Failed to create pack template in database');

    const itemRecords = analysis.items.map((detected, index) => {
      const bestMatch = batchResult.items[index]?.[0];
      return {
        id: `pti_${crypto.randomUUID().replace(STRIP_HYPHENS, '').slice(0, 21)}`,
        packTemplateId: templateId,
        userId: ownerUserId,
        name: bestMatch?.name ?? detected.name,
        description: (bestMatch?.description ?? detected.description) || null,
        weight: bestMatch?.weight ?? detected.weightGrams,
        weightUnit: bestMatch?.weightUnit ?? 'g',
        quantity: detected.quantity,
        category: detected.category,
        consumable: detected.consumable,
        worn: detected.worn,
        image: bestMatch?.images?.[0] ?? null,
        notes: null,
        catalogItemId: bestMatch?.id ?? null,
        deleted: false,
      };
    });

    setQueryTag('packTemplates.createItem');
    const items =
      itemRecords.length > 0
        ? await tx.insert(packTemplateItems).values(itemRecords).returning()
        : [];
    return { ...createdTemplate, items };
  });

  return { ok: true, template };
}

export function classifyImportError(error: unknown): string {
  if (!(error instanceof Error)) return 'UNKNOWN_ERROR';
  const { message } = error;
  if (message.includes('Google') || message.includes('Gemini') || message.includes('AI')) {
    return 'AI_ANALYSIS_ERROR';
  }
  if (message.includes('catalog') || message.includes('search')) return 'CATALOG_SEARCH_ERROR';
  if (message.includes('database') || message.includes('DB')) return 'DATABASE_ERROR';
  return 'UNKNOWN_ERROR';
}

/**
 * Owner for templates created from the admin console. The admin JWT carries
 * no PackRat user, and `pack_templates.user_id` is a required FK — so app
 * templates belong to the first ADMIN user, the same rule `db/seed.ts` uses.
 */
export async function resolveAppTemplateOwnerId(): Promise<string | null> {
  const db = createDb();
  const [owner] = await db
    .tag('packTemplates.appTemplateOwner')
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'ADMIN'))
    .orderBy(asc(users.id))
    .limit(1);
  return owner?.id ?? null;
}
