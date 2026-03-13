import { resolve } from 'node:path';
import dotenv from 'dotenv';

// Load .env from the analytics package root
dotenv.config({ path: resolve(import.meta.dirname, '../../.env') });

export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? '';
export const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? '';
export const R2_ENDPOINT_URL = process.env.R2_ENDPOINT_URL ?? '';
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? 'packrat-scrapy-bucket';
