import type { Env } from '@packrat/api/types/env';
import { R2BucketService } from './r2-bucket';

export function createR2BucketService(env: Env, bucketType: 'guides' | 'items' | 'general') {
  const config = {
    accountId: env.CLOUDFLARE_ACCOUNT_ID_ORG,
    accessKeyId: env.R2_ACCESS_KEY_ID_ORG,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY_ORG,
    bucketName: '',
  };

  switch (bucketType) {
    case 'guides':
      config.bucketName = env.PACKRAT_GUIDES_BUCKET_R2_BUCKET_NAME;
      break;
    case 'items':
      config.bucketName = env.PACKRAT_ITEMS_BUCKET_R2_BUCKET_NAME;
      break;
    case 'general':
      config.bucketName = env.PACKRAT_BUCKET_R2_BUCKET_NAME;
      break;
  }

  return new R2BucketService(config);
}
