process.env.NEON_DATABASE_URL = 'postgres://user:pass@localhost/db';
process.env.JWT_SECRET = 'secret';
process.env.OPENAI_API_KEY = 'key';
process.env.EMAIL_PROVIDER = 'resend';
process.env.RESEND_API_KEY = 'key';
process.env.EMAIL_FROM = 'test@example.com';
process.env.PASSWORD_RESET_SECRET = 'secret';
process.env.WEATHER_API_KEY = 'key';
process.env.OPENWEATHER_KEY = 'key';
process.env.CLOUDFLARE_ACCOUNT_ID = 'id';
process.env.PACKRAT_BUCKET_R2_ACCESS_KEY_ID = 'key';
process.env.PACKRAT_BUCKET_R2_SECRET_ACCESS_KEY = 'key';
process.env.PACKRAT_BUCKET_R2_BUCKET_NAME = 'bucket';

import { vi } from 'vitest';

vi.mock('hono/adapter', async () => {
  const actual = await vi.importActual<typeof import('hono/adapter')>('hono/adapter');
  return { ...actual, env: () => process.env };
});
