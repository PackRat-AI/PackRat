import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import Tiktok from '@tobyg74/tiktok-api-dl';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { z } from 'zod';

const app = new Hono();

// Environment validation
const EnvSchema = z.object({
  CLOUDFLARE_ACCOUNT_ID: z.string(),
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  R2_BUCKET_NAME: z.string(),
  R2_PUBLIC_URL: z.string().url(),
});

type Env = z.infer<typeof EnvSchema>;

function validateEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Missing required environment variables:', result.error.issues);
    throw new Error('Invalid environment configuration');
  }
  return result.data;
}

// Initialize R2 client
let s3Client: S3Client | null = null;
let env: Env | null = null;

try {
  env = validateEnv();
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  console.log('R2 client initialized successfully');
} catch (error) {
  console.warn('R2 client initialization failed:', error);
  console.warn('Image rehosting will be disabled');
}

// Middleware
app.use('*', cors());
app.use('*', logger());

// Request validation schema
const TikTokImportSchema = z.object({
  tiktokUrl: z.string().url('Must be a valid URL'),
});

/**
 * Download image and rehost to R2 with 5-minute expiration
 */
async function downloadAndRehostImage(
  imageUrl: string,
  contentId: string,
  index: number,
): Promise<string | null> {
  if (!s3Client || !env) {
    console.warn('R2 client not available, skipping image rehosting');
    return null;
  }

  try {
    console.log(`Downloading image ${index + 1}: ${imageUrl}`);

    // Download image with TikTok-compatible headers
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Referer: 'https://www.tiktok.com/',
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const timestamp = Date.now();
    const imageKey = `tiktok-temp/${contentId}/${timestamp}-${index}.webp`;

    // Calculate expiration date (5 minutes from now)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    console.log(`Uploading image ${index + 1} to R2: ${imageKey}`);

    // Upload to R2 with 5-minute expiration
    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: imageKey,
        Body: new Uint8Array(imageBuffer),
        ContentType: 'image/webp',
        Expires: expiresAt,
      }),
    );

    const rehostedUrl = `${env.R2_PUBLIC_URL}/${imageKey}`;
    console.log(`Successfully rehosted image ${index + 1}: ${rehostedUrl}`);

    return rehostedUrl;
  } catch (error) {
    console.error(`Failed to rehost image ${index + 1}:`, error);
    return null;
  }
}

/**
 * Download and rehost multiple images with best effort approach
 */
async function downloadAndRehostImages(
  imageUrls: string[],
  contentId: string,
): Promise<{ rehostedUrls: string[]; failedCount: number; expiresAt: string }> {
  if (!s3Client || !env) {
    console.warn('R2 client not available, returning empty results');
    return {
      rehostedUrls: [],
      failedCount: imageUrls.length,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
  }

  console.log(`Starting rehosting of ${imageUrls.length} images`);

  // Process all images in parallel with best effort approach
  const results = await Promise.allSettled(
    imageUrls.map((url, index) => downloadAndRehostImage(url, contentId, index)),
  );

  const rehostedUrls: string[] = [];
  let failedCount = 0;

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      rehostedUrls.push(result.value);
    } else {
      failedCount++;
      if (result.status === 'rejected') {
        console.error(`Image ${index + 1} rehosting failed:`, result.reason);
      }
    }
  });

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  console.log(`Rehosting completed: ${rehostedUrls.length} successful, ${failedCount} failed`);

  return { rehostedUrls, failedCount, expiresAt };
}

/**
 * Fetch TikTok slideshow data using TikTok API library
 */
async function fetchTikTokPostData(
  url: string,
): Promise<{ imageUrls: string[]; caption?: string; contentId?: string }> {
  try {
    const result = await Tiktok.Downloader(url, {
      version: 'v1',
      showOriginalResponse: true,
    });

    console.log(JSON.stringify(result, null, 2));

    if (result.status !== 'success') {
      throw new Error(`TikTok API failed: ${result.status}`);
    }

    const imageUrls: string[] = [];
    let caption: string | undefined;
    let contentId: string | undefined;

    // Extract caption from description
    if (result.resultNotParsed.content?.desc) {
      caption = result.resultNotParsed.content.desc;
    }

    // Extract content ID (aweme_id)
    if (result.resultNotParsed.content?.aweme_id) {
      contentId = result.resultNotParsed.content.aweme_id;
    }

    // Extract slideshow images from image_post_info
    if (result.resultNotParsed.content?.image_post_info?.images) {
      for (const image of result.resultNotParsed.content.image_post_info.images) {
        if (image.display_image?.url_list && image.display_image.url_list.length > 0) {
          // Use the first URL from the list (usually the best quality)
          imageUrls.push(image.display_image.url_list[0]);
        }
      }
    }

    if (imageUrls.length === 0) {
      throw new Error(
        'No slideshow images found in TikTok content - this URL may not contain a slideshow/photo post',
      );
    }

    return {
      imageUrls,
      ...(caption && { caption }),
      ...(contentId && { contentId }),
    };
  } catch (error) {
    console.error('TikTok API failed:', error);
    throw new Error(
      `Failed to fetch TikTok data: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

// Root endpoint
app.get('/', (c) => {
  // Container instance ID (provided by Cloudflare Container runtime)
  const instanceId = process.env.CLOUDFLARE_CONTAINER_ID || 'unknown';
  return c.json({
    service: 'tiktok-container',
    instanceId,
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'tiktok-container',
    timestamp: new Date().toISOString(),
  });
});

// TikTok slideshow import endpoint
app.post('/import', async (c) => {
  try {
    const body = await c.req.json();

    // Validate request
    const validation = TikTokImportSchema.safeParse(body);
    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: `Invalid request: ${validation.error.issues.map((i) => i.message).join(', ')}`,
        },
        400,
      );
    }

    const { tiktokUrl } = validation.data;

    console.log(`Processing TikTok URL: ${tiktokUrl}`);

    // Extract TikTok data
    const extractedData = await fetchTikTokPostData(tiktokUrl);

    console.log(`Successfully extracted ${extractedData.imageUrls.length} images from TikTok`);

    // Rehost images to R2 with best effort approach
    const { rehostedUrls, failedCount, expiresAt } = await downloadAndRehostImages(
      extractedData.imageUrls,
      extractedData.contentId || 'unknown',
    );

    const responseData: {
      imageUrls: string[];
      caption?: string;
      contentId?: string;
      expiresAt?: string;
      failedImages?: number;
    } = {
      imageUrls: rehostedUrls.length > 0 ? rehostedUrls : extractedData.imageUrls,
      caption: extractedData.caption,
      contentId: extractedData.contentId,
    };

    // Add metadata if rehosting was attempted
    if (s3Client && env) {
      responseData.expiresAt = expiresAt;
      if (failedCount > 0) {
        responseData.failedImages = failedCount;
      }
    }

    console.log(
      `Returning ${responseData.imageUrls.length} images (${rehostedUrls.length} rehosted, ${failedCount} failed)`,
    );

    return c.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('TikTok import error:', error);

    return c.json(
      {
        success: false,
        error: `Failed to import slideshow: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      500,
    );
  }
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      success: false,
      error: 'Internal server error',
    },
    500,
  );
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: 'Endpoint not found',
    },
    404,
  );
});

const port = process.env.PORT || 8080;

console.log(`TikTok container service starting on port ${port}`);

export default {
  port: Number(port),
  fetch: app.fetch,
};
