import { type GetObjectCommand, type PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getEnv } from './env-validation';

export async function getPresignedUrl(opts: {
  command: GetObjectCommand | PutObjectCommand;
  signOptions: Parameters<typeof getSignedUrl>[2];
}): Promise<string> {
  const { command, signOptions } = opts;
  const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, CLOUDFLARE_ACCOUNT_ID } = getEnv();

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID || '',
      secretAccessKey: R2_SECRET_ACCESS_KEY || '',
    },
  });

  return getSignedUrl(s3Client, command, signOptions);
}
