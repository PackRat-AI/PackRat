import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  authenticateRequest,
  unauthorizedResponse,
} from "@/utils/api-middleware";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Env } from "@/types/env";
import { env } from "hono/adapter";

const uploadRoutes = new OpenAPIHono();

// Generate a presigned URL for uploading to R2
const presignedRoute = createRoute({
  method: 'get',
  path: '/presigned',
  request: {
    query: z.object({ fileName: z.string().optional(), contentType: z.string().optional() }),
  },
  responses: { 200: { description: 'Generate presigned upload URL' } },
});

uploadRoutes.openapi(presignedRoute, async (c) => {
  // Authenticate the request
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const {
      R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY,
      CLOUDFLARE_ACCOUNT_ID,
      R2_BUCKET_NAME,
    } = env<Env>(c);
    const { fileName, contentType } = c.req.query();

    if (!fileName || !contentType) {
      return c.json({ error: 'fileName and contentType are required' }, 400);
    }

    // Initialize S3 client for R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID || '',
        secretAccessKey: R2_SECRET_ACCESS_KEY || '',
      },
    });

    // Security check: Ensure the filename starts with the user's ID
    // This prevents users from overwriting other users' images
    if (!fileName.startsWith(`${auth.userId}-`)) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Create the command for putting an object in the bucket
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
      ContentType: contentType,
    });

    // Generate the presigned URL
    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    return c.json({
      url: presignedUrl,
    });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return c.json({ error: "Failed to generate upload URL" }, 500);
  }
});

export { uploadRoutes };
