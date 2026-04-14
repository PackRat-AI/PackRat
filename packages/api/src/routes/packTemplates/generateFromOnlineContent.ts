import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { getContainer } from '@cloudflare/containers';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { packTemplateItems, packTemplates } from '@packrat/api/db/schema';
import {
  ErrorResponseSchema,
  GenerateFromOnlineContentRequestSchema,
  GenerateFromOnlineContentResponseSchema,
} from '@packrat/api/schemas/packTemplates';
import { CatalogService } from '@packrat/api/services/catalogService';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { getEnv } from '@packrat/api/utils/env-validation';
import { assertDefined } from '@packrat/guards';
import { generateObject } from 'ai';
import { sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { fetchTranscript } from 'youtube-transcript';
import { z } from 'zod';

const URL_QUERY_STRIP_RE = /[?&].*$/;

/**
 * Generate a deterministic content ID from a URL for duplicate detection
 * when the TikTok or YouTube service doesn't provide a content ID
 */
function generateContentIdFromUrl(url: string): string {
  // Normalize the URL by removing query parameters and converting to lowercase
  const normalizedUrl = url.toLowerCase().replace(URL_QUERY_STRIP_RE, '');

  // Create a simple hash for deterministic ID generation
  let hash = 0;
  for (let i = 0; i < normalizedUrl.length; i++) {
    const char = normalizedUrl.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
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

/**
 * Fetch TikTok slideshow data using TikTok Container binding
 */
async function fetchTikTokPostData(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  url: string,
): Promise<{ imageUrls: string[]; videoUrl?: string; caption?: string; contentId?: string }> {
  try {
    const { APP_CONTAINER } = getEnv(c);

    // Get the container instance using the binding
    const container = getContainer(APP_CONTAINER);

    // Make request to the container's /import endpoint
    const response = await container.fetch(
      new Request('http://container/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tiktokUrl: url,
        }),
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
  } catch (error) {
    console.error('TikTok container call failed:', error);
    throw new Error(
      `Failed to fetch TikTok data: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Check if a URL is a YouTube URL
 */
function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace('www.', '');

    return hostname === 'youtube.com' || hostname === 'youtu.be';
  } catch {
    return false;
  }
}

/**
 * Extract the YouTube video ID from a URL
 * @param url The YouTube URL
 * @returns The video ID or null if not found
 */
function getYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace('www.', '');

    if (host === 'youtu.be') {
      return parsed.pathname.slice(1);
    }

    if (host === 'youtube.com') {
      return parsed.searchParams.get('v');
    }

    return null;
  } catch {
    return null;
  }
}

const analysisSchema = z.object({
  templateName: z.string().describe('A name for this pack template'),
  templateCategory: z
    .enum([
      'hiking',
      'backpacking',
      'camping',
      'climbing',
      'winter',
      'desert',
      'custom',
      'water sports',
      'skiing',
    ])
    .describe('The most appropriate category for this pack template'),
  templateDescription: z.string().describe('A short description of the pack template'),
  items: z
    .array(
      z.object({
        name: z.string().describe('Specific name of the item'),
        description: z
          .string()
          .describe('Brief description including key characteristics, useful for catalog search'),
        quantity: z.number().int().positive().default(1),
        category: z
          .string()
          .describe('Category of outdoor gear (e.g., Sleep System, Clothing, etc.)'),
        weightGrams: z.number().nonnegative().default(0).describe('Estimated weight in grams'),
        consumable: z.boolean().default(false),
        worn: z.boolean().default(false),
      }),
    )
    .describe('All gear items identified from the content'),
});

const generateFromOnlineContentRoute = createRoute({
  method: 'post',
  path: '/generate-from-online-content',
  tags: ['Pack Templates'],
  summary: 'Generate a pack template from an online content URL',
  description:
    'Admin-only endpoint that retrieves TikTok slideshow images, videos and captions or YouTube video transcripts, then analyzes the content with AI (Gemini-3-Flash-Preview) to build a featured pack template using items from the catalog.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: GenerateFromOnlineContentRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'Pack template generated and created successfully',
      content: {
        'application/json': {
          schema: GenerateFromOnlineContentResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - Admin access required',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'Conflict - Template already exists for this content.',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const generateFromOnlineContentRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

generateFromOnlineContentRoutes.openapi(generateFromOnlineContentRoute, async (c) => {
  let contentUrl: string | undefined;
  try {
    const auth = c.get('user');

    if (auth.role !== 'ADMIN') {
      return c.json({ error: 'Forbidden: Admin access required' }, 403);
    }

    const body = c.req.valid('json');
    const { isAppTemplate } = body;
    contentUrl = body.contentUrl;

    const { GOOGLE_GENERATIVE_AI_API_KEY } = getEnv(c);
    const google = createGoogleGenerativeAI({
      apiKey: GOOGLE_GENERATIVE_AI_API_KEY,
    });

    console.log(`Processing content: ${contentUrl}`);

    let imageUrls: string[] = [];
    let videoUrl: string | undefined;
    let caption: string | undefined;
    let youtubeVideoTranscript: string | undefined;
    let contentId: string | undefined;
    let contentSource: string | undefined;

    try {
      if (isYouTubeUrl(contentUrl)) {
        const youtubeId = getYouTubeId(contentUrl);
        if (!youtubeId) {
          throw new Error('Invalid YouTube URL');
        }

        contentId = youtubeId;

        youtubeVideoTranscript = (await fetchTranscript(youtubeId))
          .reduce((acc, curr) => `${acc} ${curr.text}`, '')
          .trim();

        contentSource = 'youtube';
      } else {
        const data = await fetchTikTokPostData(c, contentUrl);
        imageUrls = data.imageUrls;
        videoUrl = data.videoUrl;
        caption = data.caption;
        contentId = data.contentId;
        contentSource = 'tiktok';
      }
    } catch (apiError) {
      console.error('TikTok service call failed:', apiError);
      c.get('sentry').captureException(apiError, {
        captureContext: {
          extra: { tiktokUrl: contentUrl, errorType: 'tiktok_service_error' },
        },
      });
      return c.json(
        {
          error: `Failed to fetch data from TikTok URL: ${apiError instanceof Error ? apiError.message : 'TikTok service unavailable'}`,
          code: 'TIKTOK_SERVICE_ERROR',
        },
        500,
      );
    }

    // Ensure we have a contentId for reliable duplicate detection
    // Use TikTok service contentId if available, otherwise generate from URL
    const finalContentId = contentId || generateContentIdFromUrl(contentUrl);

    // Check for existing template with same content ID to avoid duplication
    const db = createDb(c);
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
      return c.json(
        {
          error: 'Template already exists for this content.',
          code: 'DUPLICATE_TEMPLATE',
          existingTemplateId: existing.id,
        },
        409,
      );
    }

    // Build message content parts for Gemini
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
        : `Please analyze the following TikTok video and identify all packing/gear items:`;
      contentParts.push({ type: 'text', text: introText });
      contentParts.push({ type: 'file', data: videoUrl, mediaType: 'video/mp4' });
    } else if (imageUrls.length > 0) {
      introText = caption
        ? `Retrieved Caption: ${caption}\n\nPlease analyze the following slideshow images and identify all packing/gear items:`
        : `Please analyze the following slideshow images and identify all packing/gear items:`;
      contentParts.push({ type: 'text', text: introText });
      for (const imageUrl of imageUrls) {
        contentParts.push({ type: 'image', image: imageUrl });
      }
    } else {
      throw new Error('No content found in TikTok post (no images or video)');
    }

    // Analyze content with Gemini-3-Flash-Preview
    const { object: analysis } = await generateObject({
      model: google('gemini-3-flash-preview'),
      schema: analysisSchema,
      system: SYSTEM_PROMPT,
      prompt: [
        {
          role: 'user',
          content: contentParts,
        },
      ],
      temperature: 0.2,
    });

    // Match each detected item to catalog items using vector search
    const catalogService = new CatalogService(c);

    const searchQueries = analysis.items.map((item) => `${item.name} ${item.description}`.trim());

    const batchResult =
      searchQueries.length > 0
        ? await catalogService.batchVectorSearch(searchQueries, 1)
        : { items: [] as never[] };

    // Prepare DB records
    const now = new Date();
    const templateId = `pt_${crypto.randomUUID().replace(/-/g, '')}`;

    // Insert the pack template and its items in a single transaction to ensure atomicity
    const { newTemplate, insertedItems } = await db.transaction(async (tx) => {
      const templateRows = await tx
        .insert(packTemplates)
        .values({
          id: templateId,
          userId: auth.userId,
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
      const createdTemplate = templateRows[0];
      if (!createdTemplate) throw new Error('Pack template insert returned no rows');

      // Insert template items — prefer catalog match, fall back to detected item data
      const itemRecords = analysis.items.map((detected, index) => {
        const catalogMatches = batchResult.items[index] ?? [];
        const bestMatch = catalogMatches[0];
        const itemId = `pti_${crypto.randomUUID().replace(/-/g, '')}`;

        return {
          id: itemId,
          packTemplateId: templateId,
          userId: auth.userId,
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

    return c.json(
      {
        ...newTemplate,
        image: newTemplate.image ?? null,
        contentSource: newTemplate.contentSource ?? null,
        contentId: newTemplate.contentId ?? null,
        items: insertedItems,
      },
      201,
    );
  } catch (error) {
    console.error('Error generating pack template:', error);
    c.get('sentry').captureException(error);

    // Determine specific error type based on error context
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

    return c.json(
      {
        error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: errorCode,
      },
      500,
    );
  }
});

export { generateFromOnlineContentRoutes };
