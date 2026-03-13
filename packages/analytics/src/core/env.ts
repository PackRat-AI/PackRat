// Bun loads .env files automatically — no dotenv needed.

export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? '';
export const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? '';
export const R2_BUCKET_NAME = process.env.PACKRAT_ITEMS_BUCKET_R2_BUCKET_NAME ?? '';

// Derive endpoint from CLOUDFLARE_ACCOUNT_ID if R2_ENDPOINT_URL isn't set directly
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? '';
export const R2_ENDPOINT_URL =
  process.env.R2_ENDPOINT_URL || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
