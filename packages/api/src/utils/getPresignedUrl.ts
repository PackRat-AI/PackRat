import type {
  GetObjectCommand,
  PutObjectCommand,
  S3Client as S3ClientType,
} from '@aws-sdk/client-s3';
import type { getSignedUrl as getSignedUrlType } from '@aws-sdk/s3-request-presigner';
import { getEnv } from './env-validation';

type GetSignedUrlOptions = Parameters<typeof getSignedUrlType>[2];

export async function getPresignedUrl(opts: {
  command: GetObjectCommand | PutObjectCommand;
  signOptions: GetSignedUrlOptions;
}): Promise<string> {
  const { command, signOptions } = opts;
  const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, CLOUDFLARE_ACCOUNT_ID } = getEnv();
  const [{ S3Client }, { getSignedUrl }] = (await Promise.all([
    import('@aws-sdk/client-s3'),
    import('@aws-sdk/s3-request-presigner'),
  ])) as [{ S3Client: typeof S3ClientType }, { getSignedUrl: typeof getSignedUrlType }];

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
