export type Env = {
  EMAIL_PROVIDER: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  NEON_DATABASE_URL: string;
  JWT_SECRET: string;
  PASSWORD_RESET_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  OPENAI_API_KEY: string;
  OPENWEATHER_KEY: string;
  WEATHER_API_KEY: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  SENTRY_DSN: string;
  CF_VERSION_METADATA: WorkerVersionMetadata;
  ENVIRONMENT: string;
};
