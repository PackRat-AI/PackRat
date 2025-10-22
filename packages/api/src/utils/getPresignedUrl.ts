import { type GetObjectCommand, type PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Context } from 'hono';
import { getEnv } from './env-validation';

export async function getPresignedUrl(
  c: Context,
  command: GetObjectCommand | PutObjectCommand,
  options: Parameters<typeof getSignedUrl>[2],
): Promise<string> {
  const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, CLOUDFLARE_ACCOUNT_ID } = getEnv(c);

  // Initialize S3 client for R2
  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID || '',
      secretAccessKey: R2_SECRET_ACCESS_KEY || '',
    },
  }); // Using S3Client because R2 binding doesn't seem to support presigned URLs directly

  // Generate the presigned URL
  const presignedUrl = await getSignedUrl(s3Client, command, options);

  return presignedUrl;
}
