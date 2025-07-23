import type { Ai, Queue, R2Bucket } from '@cloudflare/workers-types';

export type Env = {
  // Environment & Deployment
  ENVIRONMENT: string;
  CF_VERSION_METADATA: WorkerVersionMetadata;
  SENTRY_DSN: string;

  // Database
  NEON_DATABASE_URL: string;

  // Authentication & Security
  JWT_SECRET: string;
  PASSWORD_RESET_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  PACKRAT_API_KEY: string;

  // Email Configuration
  EMAIL_PROVIDER: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;

  // AI & External APIs
  OPENAI_API_KEY: string;
  AI: Ai;

  // Weather Services
  OPENWEATHER_KEY: string;
  WEATHER_API_KEY: string;

  // Cloudflare R2 Storage
  CLOUDFLARE_ACCOUNT_ID: string; // For s3Client which is used for generating presigned URLs
  R2_ACCESS_KEY_ID: string; // For s3Client which is used for generating presigned URLs
  R2_SECRET_ACCESS_KEY: string; // For s3Client which is used for generating presigned URLs
  PACKRAT_BUCKET_R2_BUCKET_NAME: string; // For s3Client which is used for generating presigned URLs
  PACKRAT_GUIDES_BUCKET_R2_BUCKET_NAME: string;
  PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME: string;
  PACKRAT_SCRAPY_BUCKET: R2Bucket;
  PACKRAT_BUCKET: R2Bucket; // general bucket
  PACKRAT_GUIDES_BUCKET: R2Bucket;

  // Queue & Background Processing
  ETL_QUEUE: Queue;

  // Content & Guides
  PACKRAT_GUIDES_RAG_NAME: string;
  PACKRAT_GUIDES_BASE_URL: string;
};
