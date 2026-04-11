import { type GetObjectCommand, type PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getEnv } from './env-validation';

type CtxLike = { env?: Record<string, unknown> } | undefined;

type Opts = {
  command: GetObjectCommand | PutObjectCommand;
  signOptions: Parameters<typeof getSignedUrl>[2];
};

/**
 * Generate a presigned URL for R2.
 *
 * Dual-mode signature: can be called as `getPresignedUrl(opts)` (Elysia path)
 * or `getPresignedUrl(c, opts)` (legacy Hono path).
 */
export async function getPresignedUrl(optsOrCtx: Opts | CtxLike, maybeOpts?: Opts): Promise<string> {
  let opts: Opts;
  let c: CtxLike;

  if (maybeOpts !== undefined) {
    // Legacy call style: (c, opts)
    c = optsOrCtx as CtxLike;
    opts = maybeOpts;
  } else {
    opts = optsOrCtx as Opts;
  }

  const { command, signOptions } = opts;
  const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, CLOUDFLARE_ACCOUNT_ID } = getEnv(c);

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
