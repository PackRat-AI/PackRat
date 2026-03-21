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
 * Detect media content type and file extension from response headers or buffer
 */
function detectMediaTypeAndExtension(
  response: Response,
  buffer?: ArrayBuffer,
  isVideo = false,
): {
  contentType: string;
  extension: string;
} {
  // Try to get content type from headers first
  const headerContentType = response.headers.get('content-type');

  if (headerContentType) {
    // Video content types
    if (isVideo) {
      if (headerContentType.includes('video/mp4')) {
        return { contentType: 'video/mp4', extension: 'mp4' };
      }
      if (headerContentType.includes('video/webm')) {
        return { contentType: 'video/webm', extension: 'webm' };
      }
      if (headerContentType.includes('video/quicktime')) {
        return { contentType: 'video/quicktime', extension: 'mov' };
      }
    } else {
      // Image content types
      if (headerContentType.includes('image/jpeg') || headerContentType.includes('image/jpg')) {
        return { contentType: 'image/jpeg', extension: 'jpg' };
      }
      if (headerContentType.includes('image/png')) {
        return { contentType: 'image/png', extension: 'png' };
      }
      if (headerContentType.includes('image/webp')) {
        return { contentType: 'image/webp', extension: 'webp' };
      }
      if (headerContentType.includes('image/gif')) {
        return { contentType: 'image/gif', extension: 'gif' };
      }
    }
  }

  // If buffer is provided, try to detect from magic bytes
  if (buffer) {
    const uint8Array = new Uint8Array(buffer.slice(0, 12));

    if (isVideo) {
      // MP4 magic bytes: starts with ftyp box
      if (
        uint8Array[4] === 0x66 &&
        uint8Array[5] === 0x74 &&
        uint8Array[6] === 0x79 &&
        uint8Array[7] === 0x70
      ) {
        return { contentType: 'video/mp4', extension: 'mp4' };
      }
    } else {
      // JPEG magic bytes: FF D8 FF
      if (uint8Array[0] === 0xff && uint8Array[1] === 0xd8 && uint8Array[2] === 0xff) {
        return { contentType: 'image/jpeg', extension: 'jpg' };
      }

      // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
      if (
        uint8Array[0] === 0x89 &&
        uint8Array[1] === 0x50 &&
        uint8Array[2] === 0x4e &&
        uint8Array[3] === 0x47
      ) {
        return { contentType: 'image/png', extension: 'png' };
      }

      // WebP magic bytes: RIFF ... WEBP
      if (
        uint8Array[0] === 0x52 &&
        uint8Array[1] === 0x49 &&
        uint8Array[2] === 0x46 &&
        uint8Array[3] === 0x46 &&
        uint8Array[8] === 0x57 &&
        uint8Array[9] === 0x45 &&
        uint8Array[10] === 0x42 &&
        uint8Array[11] === 0x50
      ) {
        return { contentType: 'image/webp', extension: 'webp' };
      }

      // GIF magic bytes: GIF87a or GIF89a
      if (uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46) {
        return { contentType: 'image/gif', extension: 'gif' };
      }
    }
  }

  // Default fallbacks
  if (isVideo) {
    return { contentType: 'video/mp4', extension: 'mp4' };
  }
  return { contentType: 'image/webp', extension: 'webp' };
}

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

    // Detect the actual image type and extension
    const { contentType, extension } = detectMediaTypeAndExtension(response, imageBuffer, false);

    const timestamp = Date.now();
    const imageKey = `tiktok-temp/${contentId}/${timestamp}-${index}.${extension}`;

    console.log(`Uploading image ${index + 1} to R2: ${imageKey} (${contentType})`);

    // Upload to R2 with temporary storage
    // Note: Objects are stored under 'tiktok-temp/' prefix and should be cleaned up
    // via R2 bucket lifecycle rules (e.g 5-minute expiration).
    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: imageKey,
        Body: new Uint8Array(imageBuffer),
        ContentType: contentType,
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
 * Download video and rehost to R2 with 5-minute expiration
 */
async function downloadAndRehostVideo(videoUrl: string, contentId: string): Promise<string | null> {
  if (!s3Client || !env) {
    console.warn('R2 client not available, skipping video rehosting');
    return null;
  }

  try {
    console.log(`Downloading video: ${videoUrl}`);

    // Download video with TikTok-compatible headers
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Referer: 'https://www.tiktok.com/',
        Accept: 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: AbortSignal.timeout(60000), // 60 second timeout for videos
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const videoBuffer = await response.arrayBuffer();

    // Detect the actual video type and extension
    const { contentType, extension } = detectMediaTypeAndExtension(response, videoBuffer, true);

    const timestamp = Date.now();
    const videoKey = `tiktok-temp/${contentId}/${timestamp}-video.${extension}`;

    console.log(`Uploading video to R2: ${videoKey} (${contentType})`);

    // Upload to R2 with temporary storage
    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: videoKey,
        Body: new Uint8Array(videoBuffer),
        ContentType: contentType,
      }),
    );

    const rehostedUrl = `${env.R2_PUBLIC_URL}/${videoKey}`;
    console.log(`Successfully rehosted video: ${rehostedUrl}`);

    return rehostedUrl;
  } catch (error) {
    console.error('Failed to rehost video:', error);
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
 * Fetch TikTok content data (images or video) using TikTok API library
 */
async function fetchTikTokPostData(
  url: string,
): Promise<{ imageUrls: string[]; videoUrl?: string; caption?: string; contentId?: string }> {
  try {
    console.log('Attempting TikTok download for URL:', url);

    const result = await Tiktok.Downloader(url, {
      version: 'v1',
      showOriginalResponse: true,
    });

    console.log('TikTok API Raw Response:', JSON.stringify(result, null, 2));

    if (result.status !== 'success') {
      console.error('Response debug:', {
        status: result.status,
        url,
        result: JSON.stringify(result, null, 2),
      });
      throw new Error(`TikTok API failed: ${result.status}`);
    }

    const imageUrls: string[] = [];
    let videoUrl: string | undefined;
    let caption: string | undefined;
    let contentId: string | undefined;

    // Get caption from description
    if (result.resultNotParsed.content?.desc) {
      caption = result.resultNotParsed.content.desc;
    }

    // Get content ID (aweme_id)
    if (result.resultNotParsed.content?.aweme_id) {
      contentId = result.resultNotParsed.content.aweme_id;
    }

    // Check for video content first
    if (
      result.resultNotParsed.content?.video?.play_addr?.url_list &&
      result.resultNotParsed.content.video.play_addr.url_list.length > 0
    ) {
      videoUrl = result.resultNotParsed.content.video.play_addr.url_list[0];
    }

    // Get slideshow images from image_post_info (if no video or as fallback)
    if (result.resultNotParsed.content?.image_post_info?.images) {
      for (const image of result.resultNotParsed.content.image_post_info.images) {
        if (image.display_image?.url_list && image.display_image.url_list.length > 0) {
          // Use the first URL from the list (usually the best quality)
          imageUrls.push(image.display_image.url_list[0]);
        }
      }
    }

    // Check if we have any content
    if (imageUrls.length === 0 && !videoUrl) {
      throw new Error(
        'No content found in TikTok post - this URL may not contain a slideshow/photo post or video',
      );
    }

    return {
      imageUrls,
      ...(videoUrl && { videoUrl }),
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

// TikTok content import endpoint (supports both slideshows and videos)
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

    // Fetch TikTok data
    const fetchedData = await fetchTikTokPostData(tiktokUrl);

    const hasImages = fetchedData.imageUrls.length > 0;
    const hasVideo = !!fetchedData.videoUrl;

    console.log(
      `Successfully retrieved TikTok content: ${hasImages ? `${fetchedData.imageUrls.length} images` : 'no images'}${hasVideo ? ', 1 video' : ''}`,
    );

    let responseData: {
      imageUrls: string[];
      videoUrl?: string;
      caption?: string;
      contentId?: string;
      expiresAt?: string;
      failedImages?: number;
      failedVideo?: boolean;
    };

    // Process images and video rehosting in parallel for efficiency
    const [imageResult, videoResult] = await Promise.allSettled([
      hasImages
        ? downloadAndRehostImages(fetchedData.imageUrls, fetchedData.contentId || 'unknown')
        : Promise.resolve({ rehostedUrls: [], failedCount: 0, expiresAt: '' }),
      hasVideo
        ? downloadAndRehostVideo(fetchedData.videoUrl!, fetchedData.contentId || 'unknown')
        : Promise.resolve(null),
    ]);

    // Process image rehosting results
    let finalImageUrls = fetchedData.imageUrls;
    let imageFailedCount = 0;
    let expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    if (imageResult.status === 'fulfilled' && hasImages) {
      const { rehostedUrls, failedCount, expiresAt: imgExpiresAt } = imageResult.value;
      if (rehostedUrls.length > 0) {
        finalImageUrls = rehostedUrls;
      }
      imageFailedCount = failedCount;
      expiresAt = imgExpiresAt;
    }

    // Process video rehosting results
    let finalVideoUrl = fetchedData.videoUrl;
    let videoFailed = false;

    if (hasVideo) {
      if (videoResult.status === 'fulfilled' && videoResult.value) {
        finalVideoUrl = videoResult.value;
      } else {
        videoFailed = true;
        if (videoResult.status === 'rejected') {
          console.error('Video rehosting failed:', videoResult.reason);
        }
      }
    }

    responseData = {
      imageUrls: finalImageUrls,
      ...(finalVideoUrl && { videoUrl: finalVideoUrl }),
      caption: fetchedData.caption,
      contentId: fetchedData.contentId,
    };

    // Add metadata if rehosting was attempted
    if (s3Client && env && (hasImages || hasVideo)) {
      responseData.expiresAt = expiresAt;
      if (imageFailedCount > 0) {
        responseData.failedImages = imageFailedCount;
      }
      if (videoFailed) {
        responseData.failedVideo = true;
      }
    }

    console.log(
      `Returning ${responseData.imageUrls.length} images${responseData.videoUrl ? ' and 1 video' : ''}${
        responseData.failedImages ? ` (${responseData.failedImages} images failed)` : ''
      }${responseData.failedVideo ? ' (video rehosting failed)' : ''}`,
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
        error: `Failed to import content: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
