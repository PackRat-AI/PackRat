import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GoogleGenAI } from '@google/genai';
import Tiktok from '@tobyg74/tiktok-api-dl';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

// Environment validation
const EnvSchema = z.object({
  CLOUDFLARE_ACCOUNT_ID: z.string(),
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  R2_BUCKET_NAME: z.string(),
  R2_PUBLIC_URL: z.string().url(),
  GOOGLE_GENAI_API_KEY: z.string(),
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

// GoogleGenAI client (for video upload)
const googleAi = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY,
});

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

// Request validation schema
const TikTokImportSchema = z.object({
  tiktokUrl: z.string().url('Must be a valid URL'),
});

/**
 * Detect media content type and file extension from response headers or buffer
 */
function detectMediaTypeAndExtension(
  response: Response,
  opts: { buffer?: ArrayBuffer; isVideo?: boolean } = {},
): {
  contentType: string;
  extension: string;
} {
  const { buffer, isVideo = false } = opts;
  const headerContentType = response.headers.get('content-type');

  if (headerContentType) {
    if (isVideo) {
      if (headerContentType.includes('video/mp4'))
        return { contentType: 'video/mp4', extension: 'mp4' };
      if (headerContentType.includes('video/webm'))
        return { contentType: 'video/webm', extension: 'webm' };
      if (headerContentType.includes('video/quicktime'))
        return { contentType: 'video/quicktime', extension: 'mov' };
    } else {
      if (headerContentType.includes('image/jpeg') || headerContentType.includes('image/jpg'))
        return { contentType: 'image/jpeg', extension: 'jpg' };
      if (headerContentType.includes('image/png'))
        return { contentType: 'image/png', extension: 'png' };
      if (headerContentType.includes('image/webp'))
        return { contentType: 'image/webp', extension: 'webp' };
      if (headerContentType.includes('image/gif'))
        return { contentType: 'image/gif', extension: 'gif' };
    }
  }

  if (buffer) {
    const uint8Array = new Uint8Array(buffer.slice(0, 12));

    if (isVideo) {
      if (
        uint8Array[4] === 0x66 &&
        uint8Array[5] === 0x74 &&
        uint8Array[6] === 0x79 &&
        uint8Array[7] === 0x70
      )
        return { contentType: 'video/mp4', extension: 'mp4' };
    } else {
      if (uint8Array[0] === 0xff && uint8Array[1] === 0xd8 && uint8Array[2] === 0xff)
        return { contentType: 'image/jpeg', extension: 'jpg' };
      if (
        uint8Array[0] === 0x89 &&
        uint8Array[1] === 0x50 &&
        uint8Array[2] === 0x4e &&
        uint8Array[3] === 0x47
      )
        return { contentType: 'image/png', extension: 'png' };
      if (
        uint8Array[0] === 0x52 &&
        uint8Array[1] === 0x49 &&
        uint8Array[2] === 0x46 &&
        uint8Array[3] === 0x46 &&
        uint8Array[8] === 0x57 &&
        uint8Array[9] === 0x45 &&
        uint8Array[10] === 0x42 &&
        uint8Array[11] === 0x50
      )
        return { contentType: 'image/webp', extension: 'webp' };
      if (uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46)
        return { contentType: 'image/gif', extension: 'gif' };
    }
  }

  if (isVideo) return { contentType: 'video/mp4', extension: 'mp4' };
  return { contentType: 'image/webp', extension: 'webp' };
}

/**
 * Download image and rehost to R2 with 5-minute expiration
 */
async function downloadAndRehostImage(
  imageUrl: string,
  opts: { contentId: string; index: number },
): Promise<string | null> {
  const { contentId, index } = opts;
  if (!s3Client || !env) {
    console.warn('R2 client not available, skipping image rehosting');
    return null;
  }

  try {
    console.log(`Downloading image ${index + 1}: ${imageUrl}`);

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
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const { contentType, extension } = detectMediaTypeAndExtension(response, {
      buffer: imageBuffer,
    });

    const timestamp = Date.now();
    const imageKey = `tiktok-temp/${contentId}/${timestamp}-${index}.${extension}`;

    console.log(`Uploading image ${index + 1} to R2: ${imageKey} (${contentType})`);

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
 * Download video and upload to Google AI, returning file.uri as videoUrl
 */
async function uploadVideoToGoogle(videoUrl: string): Promise<string | null> {
  try {
    console.log(`Downloading video for Google upload: ${videoUrl}`);
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
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const videoBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'video/mp4';
    const videoBlob = new Blob([videoBuffer], { type: contentType });
    console.log('Uploading video to Google AI...');
    const myfile = await googleAi.files.upload({
      file: videoBlob,
      config: { mimeType: videoBlob.type },
    });
    console.log(`Video uploaded to Google AI. File URI: ${myfile.uri}, name: ${myfile.name}`);
    if (!myfile.name) throw new Error('Google AI upload did not return a file name');
    await waitForFileToBeActiveGoogle(googleAi, { fileName: myfile.name });
    return myfile.uri || null;
  } catch (error) {
    console.error('Failed to upload video to Google:', error);
    return null;
  }
}

/**
 * Wait for uploaded file to become ACTIVE before using it for inference
 */
async function waitForFileToBeActiveGoogle(
  ai: GoogleGenAI,
  opts: { fileName: string; maxWaitTimeMs?: number },
): Promise<void> {
  const { fileName, maxWaitTimeMs = 300000 } = opts;
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitTimeMs) {
    const fileInfo = await ai.files.get({ name: fileName });
    console.log(`File status: ${fileInfo.state}`);
    if (fileInfo.state === 'ACTIVE') {
      console.log('File is now ACTIVE and ready for inference');
      return;
    }
    if (fileInfo.state === 'FAILED') {
      throw new Error(`File processing failed. File state: ${fileInfo.state}`);
    }
    if (fileInfo.state === 'PROCESSING') {
      console.log('File is still processing, waiting...');
      await new Promise((resolve) => setTimeout(resolve, 10000));
    } else {
      console.log(`Unexpected file state: ${fileInfo.state}, continuing to wait...`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  throw new Error(`Timeout: File did not become ACTIVE within ${maxWaitTimeMs / 1000} seconds`);
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

  const results = await Promise.allSettled(
    imageUrls.map((url, index) => downloadAndRehostImage(url, { contentId, index })),
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

    const result = await Tiktok.Downloader(url, { version: 'v1' });

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

    if (result.result?.desc) caption = result.result.desc;
    if (result.result?.id) contentId = result.result.id;

    if (result.result?.type === 'video' && result.result.video?.playAddr) {
      if (Array.isArray(result.result.video.playAddr) && result.result.video.playAddr.length > 0) {
        videoUrl = result.result.video.playAddr[0];
      }
    } else if (result.result?.type === 'image' && result.result.images) {
      imageUrls.push(...result.result.images);
    }

    if (imageUrls.length === 0 && !videoUrl) {
      throw new Error('No content found in TikTok post');
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

// ---------------------------------------------------------------------------
// Elysia app
// ---------------------------------------------------------------------------

const app = new Elysia()
  .onError(({ error }) => {
    console.error('Unhandled error:', error);
    return status(500, { success: false, error: 'Internal server error' });
  })
  .get('/', () => {
    const instanceId = process.env.CLOUDFLARE_CONTAINER_ID || 'unknown';
    return {
      service: 'tiktok-container',
      instanceId,
      timestamp: new Date().toISOString(),
    };
  })
  .get('/health', () => ({
    status: 'ok',
    service: 'tiktok-container',
    timestamp: new Date().toISOString(),
  }))
  .post('/import', async ({ body }) => {
    try {
      const validation = TikTokImportSchema.safeParse(body);
      if (!validation.success) {
        return status(400, {
          success: false,
          error: `Invalid request: ${validation.error.issues.map((i) => i.message).join(', ')}`,
        });
      }

      const { tiktokUrl } = validation.data;

      console.log(`Processing TikTok URL: ${tiktokUrl}`);

      const fetchedData = await fetchTikTokPostData(tiktokUrl);

      const hasImages = fetchedData.imageUrls.length > 0;
      const hasVideo = !!fetchedData.videoUrl;

      console.log(
        `Successfully retrieved TikTok content: ${hasImages ? `${fetchedData.imageUrls.length} images` : 'no images'}${hasVideo ? ', 1 video' : ''}`,
      );

      const [imageResult, videoResult] = await Promise.allSettled([
        hasImages
          ? downloadAndRehostImages(fetchedData.imageUrls, fetchedData.contentId || 'unknown')
          : Promise.resolve({ rehostedUrls: [], failedCount: 0, expiresAt: '' }),
        hasVideo && fetchedData.videoUrl
          ? uploadVideoToGoogle(fetchedData.videoUrl)
          : Promise.resolve(null),
      ]);

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

      let finalVideoUrl = fetchedData.videoUrl;
      let videoFailed = false;

      if (hasVideo) {
        if (videoResult.status === 'fulfilled' && videoResult.value) {
          finalVideoUrl = videoResult.value;
        } else {
          videoFailed = true;
          if (videoResult.status === 'rejected') {
            console.error('Video upload to Google failed:', videoResult.reason);
          }
        }
      }

      const responseData: Record<string, unknown> = {
        imageUrls: finalImageUrls,
        ...(finalVideoUrl && { videoUrl: finalVideoUrl }),
        caption: fetchedData.caption,
        contentId: fetchedData.contentId,
      };

      if ((s3Client && env && hasImages) || hasVideo) {
        responseData.expiresAt = expiresAt;
        if (imageFailedCount > 0) responseData.failedImages = imageFailedCount;
        if (videoFailed) responseData.failedVideo = true;
      }

      return { success: true, data: responseData };
    } catch (error) {
      console.error('TikTok import error:', error);
      return status(500, {
        success: false,
        error: `Failed to import content: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  });

const port = process.env.PORT || 8080;

console.log(`TikTok container service starting on port ${port}`);

export default {
  port: Number(port),
  fetch: app.fetch,
};
