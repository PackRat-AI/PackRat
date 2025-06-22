import { Queue } from "@cloudflare/workers-types";

export type Env = {
  EMAIL_PROVIDER: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  NEON_DATABASE_URL: string;
  JWT_SECRET: string;
  PASSWORD_RESET_SECRET: string;
  OPENAI_API_KEY: string;
  OPENWEATHER_KEY: string;
  WEATHER_API_KEY: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  PACKRAT_BUCKET_R2_BUCKET_NAME: string;
  PACKRAT_ITEMS_BUCKET_R2_BUCKET_NAME: string;
  ETL_QUEUE: Queue;
  PACKRAT_API_KEY: string;
};
