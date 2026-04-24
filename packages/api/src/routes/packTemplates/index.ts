import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { getContainer } from '@cloudflare/containers';
import { createDb } from '@packrat/api/db';
import { type PackTemplate, packTemplateItems, packTemplates } from '@packrat/api/db/schema';
import { authPlugin } from '@packrat/api/middleware/auth';
import {
  CreatePackTemplateItemRequestSchema,
  CreatePackTemplateRequestSchema,
  GenerateFromOnlineContentRequestSchema,
  UpdatePackTemplateItemRequestSchema,
  UpdatePackTemplateRequestSchema,
} from '@packrat/api/schemas/packTemplates';
import { CatalogService } from '@packrat/api/services/catalogService';
import { getEnv } from '@packrat/api/utils/env-validation';
import { assertDefined } from '@packrat/guards';
import { generateObject } from 'ai';
import { and, eq, or, sql } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { fetchTranscript } from 'youtube-transcript';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Helpers for online-content generation
// ---------------------------------------------------------------------------

const QUERY_STRIP_RE = /[?&].*$/;

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

const SYSTEM_PROMPT = `You are an expert outdoor gear analyst. You will be shown content from TikTok or YouTube featuring packing content (e.g., a gear lay-flat, kit breakdown, or packing list). This content may be either images (slideshow), a video or video transcript. Your task is to:

1. Identify every outdoor gear or equipment item visible in the images/video or mentioned in the caption/transcript.
2. For each item, provide a specific name, description, category, weight estimate (in grams), quantity, and flags for whether it is consumable or worn.
3. Also determine an appropriate pack template name and category (one of: hiking, backpacking, camping, climbing, winter, desert, custom, water sports, skiing) for this overall kit.

For video content: Analyze the video frames to identify gear items shown throughout the video. Pay attention to any gear being packed, displayed, or mentioned.
For slideshow content: Analyze each image to identify all visible gear items.

Focus on items that would realistically appear in an outdoor adventure packing list. Be thorough — identify every item you can see or infer.`;

async function fetchTikTokPostData(
  url: string,
): Promise<{ imageUrls: string[]; videoUrl?: string; caption?: string; contentId?: string }> {
  const { APP_CONTAINER } = getEnv();
  const container = getContainer(APP_CONTAINER);

  const response = await container.fetch(
    new Request('http://container/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tiktokUrl: url }),
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

function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace('www.', '');
    return hostname === 'youtube.com' || hostname === 'youtu.be';
  } catch {
    return false;
  }
}

function getYouTubeId(url: string): string | null {
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

const analysisSchema = z.object({
  templateName: z.string(),
  templateCategory: z.enum([
    'hiking',
    'backpacking',
    'camping',
    'climbing',
    'winter',
    'desert',
    'custom',
    'water sports',
    'skiing',
  ]),
  templateDescription: z.string(),
  items: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      quantity: z.number().int().positive().default(1),
      category: z.string(),
      weightGrams: z.number().nonnegative().default(0),
      consumable: z.boolean().default(false),
      worn: z.boolean().default(false),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const packTemplatesRoutes = new Elysia({ prefix: '/pack-templates' })
  .use(authPlugin)

  // List all templates
  .get(
    '/',
    async ({ user }) => {
      const db = createDb();
      const templates = await db.query.packTemplates.findMany({
        where: or(eq(packTemplates.userId, user.userId), eq(packTemplates.isAppTemplate, true)),
        with: { items: true },
      });
      return templates;
    },
    {
      isAuthenticated: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Get all pack templates',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Create template
  .post(
    '/',
    async ({ body, user }) => {
      const db = createDb();
      const data = body;

      const isAppTemplate = user.role === 'ADMIN' ? data.isAppTemplate : false;

      const [newTemplate] = await db
        .insert(packTemplates)
        .values({
          id: data.id,
          userId: user.userId,
          name: data.name,
          description: data.description,
          category: data.category,
          image: data.image,
          tags: data.tags,
          isAppTemplate,
          localCreatedAt: new Date(data.localCreatedAt),
          localUpdatedAt: new Date(data.localUpdatedAt),
        })
        .returning();

      assertDefined(newTemplate, 'Failed to create pack template');

      const templateWithItems = await db.query.packTemplates.findFirst({
        where: eq(packTemplates.id, newTemplate.id),
        with: { items: true },
      });

      return status(201, templateWithItems);
    },
    {
      body: CreatePackTemplateRequestSchema,
      isAuthenticated: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Create a new pack template',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Generate from online content
  .post(
    '/generate-from-online-content',
    async ({ body, user }) => {
      let contentUrl: string | undefined;
      try {
        if (user.role !== 'ADMIN') {
          return status(403, { error: 'Forbidden: Admin access required' });
        }

        const { isAppTemplate } = body;
        contentUrl = body.contentUrl;

        const { GOOGLE_GENERATIVE_AI_API_KEY } = getEnv();
        const google = createGoogleGenerativeAI({ apiKey: GOOGLE_GENERATIVE_AI_API_KEY });

        let imageUrls: string[] = [];
        let videoUrl: string | undefined;
        let caption: string | undefined;
        let youtubeVideoTranscript: string | undefined;
        let contentId: string | undefined;
        let contentSource: string | undefined;

        try {
          if (isYouTubeUrl(contentUrl)) {
            const youtubeId = getYouTubeId(contentUrl);
            if (!youtubeId) throw new Error('Invalid YouTube URL');
            contentId = youtubeId;
            youtubeVideoTranscript = (await fetchTranscript(youtubeId))
              .reduce((acc, curr) => `${acc} ${curr.text}`, '')
              .trim();
            contentSource = 'youtube';
          } else {
            const data = await fetchTikTokPostData(contentUrl);
            imageUrls = data.imageUrls;
            videoUrl = data.videoUrl;
            caption = data.caption;
            contentId = data.contentId;
            contentSource = 'tiktok';
          }
        } catch (apiError) {
          console.error('Content service call failed:', apiError);
          return status(500, {
            error: `Failed to fetch data from URL: ${apiError instanceof Error ? apiError.message : 'Service unavailable'}`,
            code: 'TIKTOK_SERVICE_ERROR',
          });
        }

        const finalContentId = contentId || generateContentIdFromUrl(contentUrl);

        const db = createDb();
        const existingTemplate = await db
          .select()
          .from(packTemplates)
          .where(
            sql`${packTemplates.contentSource} = ${contentSource} AND ${packTemplates.contentId} = ${finalContentId} AND ${packTemplates.deleted} = false`,
          )
          .limit(1);

        if (existingTemplate.length > 0) {
          const existing = existingTemplate[0];
          assertDefined(existing, 'existingTemplate[0] must be defined after length check');
          return status(409, {
            error: 'Template already exists for this content.',
            code: 'DUPLICATE_TEMPLATE',
            existingTemplateId: existing.id,
          });
        }

        type TextPart = { type: 'text'; text: string };
        type ImagePart = { type: 'image'; image: string };
        type FilePart = { type: 'file'; data: string; mediaType: string };
        const contentParts: Array<TextPart | ImagePart | FilePart> = [];

        let introText: string;
        if (youtubeVideoTranscript) {
          introText =
            'Please analyze the YouTube video transcript below and identify all packing/gear items:';
          contentParts.push({ type: 'text', text: introText });
          contentParts.push({ type: 'text', text: youtubeVideoTranscript });
        } else if (videoUrl) {
          introText = caption
            ? `Retrieved Caption: ${caption}\n\nPlease analyze the following TikTok video and identify all packing/gear items:`
            : 'Please analyze the following TikTok video and identify all packing/gear items:';
          contentParts.push({ type: 'text', text: introText });
          contentParts.push({ type: 'file', data: videoUrl, mediaType: 'video/mp4' });
        } else if (imageUrls.length > 0) {
          introText = caption
            ? `Retrieved Caption: ${caption}\n\nPlease analyze the following slideshow images and identify all packing/gear items:`
            : 'Please analyze the following slideshow images and identify all packing/gear items:';
          contentParts.push({ type: 'text', text: introText });
          for (const imageUrl of imageUrls) {
            contentParts.push({ type: 'image', image: imageUrl });
          }
        } else {
          throw new Error('No content found in TikTok post (no images or video)');
        }

        const { object: analysis } = await generateObject({
          model: google('gemini-3-flash-preview'),
          schema: analysisSchema,
          system: SYSTEM_PROMPT,
          prompt: [{ role: 'user', content: contentParts }],
          temperature: 0.2,
        });

        const catalogService = new CatalogService();
        const searchQueries = analysis.items.map((item) =>
          `${item.name} ${item.description}`.trim(),
        );

        const batchResult =
          searchQueries.length > 0
            ? await catalogService.batchVectorSearch(searchQueries, 1)
            : { items: [] as never[] };

        const now = new Date();
        const templateId = `pt_${crypto.randomUUID().replace(/-/g, '').slice(0, 21)}`;

        const { newTemplate, insertedItems } = await db.transaction(async (tx) => {
          const [createdTemplate] = await tx
            .insert(packTemplates)
            .values({
              id: templateId,
              userId: user.userId,
              name: analysis.templateName,
              description: analysis.templateDescription,
              category: analysis.templateCategory,
              image: null,
              tags: [analysis.templateCategory],
              isAppTemplate: isAppTemplate ?? true,
              deleted: false,
              contentSource,
              contentId: finalContentId,
              localCreatedAt: now,
              localUpdatedAt: now,
            })
            .returning();

          const itemRecords = analysis.items.map((detected, index) => {
            const catalogMatches = batchResult.items[index] ?? [];
            const bestMatch = catalogMatches[0];
            const itemId = `pti_${crypto.randomUUID().replace(/-/g, '').slice(0, 21)}`;

            return {
              id: itemId,
              packTemplateId: templateId,
              userId: user.userId,
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

          const insertedItemsResult =
            itemRecords.length > 0
              ? await tx.insert(packTemplateItems).values(itemRecords).returning()
              : [];

          return { newTemplate: createdTemplate, insertedItems: insertedItemsResult };
        });

        return { ...newTemplate, items: insertedItems };
      } catch (error) {
        console.error('Error generating pack template:', error);
        let errorCode = 'UNKNOWN_ERROR';
        if (error instanceof Error) {
          if (
            error.message.includes('Google') ||
            error.message.includes('Gemini') ||
            error.message.includes('AI')
          ) {
            errorCode = 'AI_ANALYSIS_ERROR';
          } else if (error.message.includes('catalog') || error.message.includes('search')) {
            errorCode = 'CATALOG_SEARCH_ERROR';
          } else if (error.message.includes('database') || error.message.includes('DB')) {
            errorCode = 'DATABASE_ERROR';
          }
        }

        return status(500, {
          error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: errorCode,
        });
      }
    },
    {
      body: GenerateFromOnlineContentRequestSchema,
      isAuthenticated: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Generate a pack template from an online content URL',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Update template item
  .patch(
    '/items/:itemId',
    async ({ params, body, user }) => {
      const db = createDb();
      const itemId = params.itemId;
      const data = body;

      const item = await db.query.packTemplateItems.findFirst({
        where: eq(packTemplateItems.id, itemId),
        with: { template: true },
      });

      if (!item) return status(404, { error: 'Item not found' });
      if (item.template.isAppTemplate && user.role !== 'ADMIN') {
        return status(403, { error: 'Not allowed' });
      }

      const updateData: Partial<typeof packTemplateItems.$inferInsert> = {};
      if ('name' in data) updateData.name = data.name;
      if ('description' in data) updateData.description = data.description;
      if ('weight' in data) updateData.weight = data.weight;
      if ('weightUnit' in data) updateData.weightUnit = data.weightUnit;
      if ('quantity' in data) updateData.quantity = data.quantity;
      if ('category' in data) updateData.category = data.category;
      if ('consumable' in data) updateData.consumable = data.consumable;
      if ('worn' in data) updateData.worn = data.worn;
      if ('image' in data) updateData.image = data.image;
      if ('notes' in data) updateData.notes = data.notes;
      if ('deleted' in data) updateData.deleted = data.deleted;

      const [updatedItem] = await db
        .update(packTemplateItems)
        .set({ ...updateData, updatedAt: new Date() })
        .where(
          item.template.isAppTemplate && user.role === 'ADMIN'
            ? eq(packTemplateItems.id, itemId)
            : and(eq(packTemplateItems.id, itemId), eq(packTemplateItems.userId, user.userId)),
        )
        .returning();

      return updatedItem;
    },
    {
      params: z.object({ itemId: z.string() }),
      body: UpdatePackTemplateItemRequestSchema,
      isAuthenticated: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Update a template item',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Delete template item
  .delete(
    '/items/:itemId',
    async ({ params, user }) => {
      const db = createDb();
      const itemId = params.itemId;

      const item = await db.query.packTemplateItems.findFirst({
        where: eq(packTemplateItems.id, itemId),
        with: { template: true },
      });

      if (!item) return status(404, { error: 'Item not found' });
      if (item.template.isAppTemplate && user.role !== 'ADMIN') {
        return status(403, { error: 'Not allowed' });
      }

      const canDelete =
        (item.template.isAppTemplate && user.role === 'ADMIN') || item.userId === user.userId;
      if (!canDelete) return status(403, { error: 'Not allowed' });

      await db.delete(packTemplateItems).where(eq(packTemplateItems.id, itemId));
      await db
        .update(packTemplates)
        .set({ updatedAt: new Date() })
        .where(eq(packTemplates.id, item.packTemplateId));

      return { success: true };
    },
    {
      params: z.object({ itemId: z.string() }),
      isAuthenticated: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Delete a template item',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Get template
  .get(
    '/:templateId',
    async ({ params, user }) => {
      const db = createDb();
      const templateId = params.templateId;

      const template = await db.query.packTemplates.findFirst({
        where: and(
          eq(packTemplates.id, templateId),
          or(eq(packTemplates.userId, user.userId), eq(packTemplates.isAppTemplate, true)),
          eq(packTemplates.deleted, false),
        ),
        with: { items: true },
      });

      if (!template) return status(404, { error: 'Template not found' });
      return template;
    },
    {
      params: z.object({ templateId: z.string() }),
      isAuthenticated: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Get a specific pack template',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Update template
  .put(
    '/:templateId',
    async ({ params, body, user }) => {
      const db = createDb();
      const templateId = params.templateId;
      const data = body;

      const updateData: Partial<PackTemplate> = {};
      if ('name' in data) updateData.name = data.name;
      if ('description' in data) updateData.description = data.description;
      if ('category' in data) updateData.category = data.category;
      if ('image' in data) updateData.image = data.image;
      if ('tags' in data) updateData.tags = data.tags;
      if ('isAppTemplate' in data && user.role === 'ADMIN')
        updateData.isAppTemplate = data.isAppTemplate;
      if ('deleted' in data) updateData.deleted = data.deleted;
      if ('localUpdatedAt' in data && data.localUpdatedAt)
        updateData.localUpdatedAt = new Date(data.localUpdatedAt);

      await db
        .update(packTemplates)
        .set(updateData)
        .where(
          data.isAppTemplate && user.role === 'ADMIN'
            ? eq(packTemplates.id, templateId)
            : and(eq(packTemplates.id, templateId), eq(packTemplates.userId, user.userId)),
        );

      const updated = await db.query.packTemplates.findFirst({
        where:
          data.isAppTemplate && user.role === 'ADMIN'
            ? eq(packTemplates.id, templateId)
            : and(eq(packTemplates.id, templateId), eq(packTemplates.userId, user.userId)),
        with: { items: true },
      });

      if (!updated) return status(404, { error: 'Template not found' });
      return updated;
    },
    {
      params: z.object({ templateId: z.string() }),
      body: UpdatePackTemplateRequestSchema,
      isAuthenticated: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Update a pack template',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Delete template
  .delete(
    '/:templateId',
    async ({ params, user }) => {
      const db = createDb();
      const templateId = params.templateId;

      const packTemplate = await db.query.packTemplates.findFirst({
        where: eq(packTemplates.id, templateId),
      });

      if (!packTemplate) return status(404, { error: 'Template not found' });
      if (packTemplate.isAppTemplate && user.role !== 'ADMIN') {
        return status(403, { error: 'Not allowed' });
      }

      await db
        .delete(packTemplates)
        .where(
          packTemplate.isAppTemplate && user.role === 'ADMIN'
            ? eq(packTemplates.id, templateId)
            : and(eq(packTemplates.id, templateId), eq(packTemplates.userId, user.userId)),
        );

      return { success: true };
    },
    {
      params: z.object({ templateId: z.string() }),
      isAuthenticated: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Delete a pack template',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // List template items
  .get(
    '/:templateId/items',
    async ({ params, user }) => {
      const db = createDb();
      const templateId = params.templateId;

      const template = await db.query.packTemplates.findFirst({
        where: eq(packTemplates.id, templateId),
      });

      if (!template) return status(404, { error: 'Template not found' });

      const hasAccess = template.isAppTemplate || template.userId === user.userId;
      if (!hasAccess) return status(403, { error: 'Access denied to this template' });

      const items = await db
        .select()
        .from(packTemplateItems)
        .where(eq(packTemplateItems.packTemplateId, templateId));

      return items;
    },
    {
      params: z.object({ templateId: z.string() }),
      isAuthenticated: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Get all items for a template',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Add template item
  .post(
    '/:templateId/items',
    async ({ params, body, user }) => {
      const db = createDb();
      const templateId = params.templateId;
      const data = body;

      const packTemplate = await db.query.packTemplates.findFirst({
        where: eq(packTemplates.id, templateId),
      });

      if (!packTemplate) return status(404, { error: 'Template not found' });
      if (packTemplate.isAppTemplate && user.role !== 'ADMIN') {
        return status(403, { error: 'Not allowed' });
      }

      const [newItem] = await db
        .insert(packTemplateItems)
        .values({
          id: data.id,
          packTemplateId: templateId,
          name: data.name,
          description: data.description,
          weight: data.weight,
          weightUnit: data.weightUnit,
          quantity: data.quantity || 1,
          category: data.category,
          consumable: data.consumable,
          worn: data.worn,
          image: data.image,
          notes: data.notes,
          userId: user.userId,
        })
        .returning();

      await db
        .update(packTemplates)
        .set({ updatedAt: new Date() })
        .where(eq(packTemplates.id, templateId));

      return status(201, newItem);
    },
    {
      params: z.object({ templateId: z.string() }),
      body: CreatePackTemplateItemRequestSchema,
      isAuthenticated: true,
      detail: {
        tags: ['Pack Templates'],
        summary: 'Add item to template',
        security: [{ bearerAuth: [] }],
      },
    },
  );
