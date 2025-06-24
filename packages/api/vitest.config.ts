import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const bindings = {
  NEON_DATABASE_URL: 'postgres://user:pass@localhost/db',
  JWT_SECRET: 'secret',
  OPENAI_API_KEY: 'key',
  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 'key',
  EMAIL_FROM: 'test@example.com',
  PASSWORD_RESET_SECRET: 'secret',
  WEATHER_API_KEY: 'key',
  OPENWEATHER_KEY: 'key',
  CLOUDFLARE_ACCOUNT_ID: 'id',
  PACKRAT_BUCKET_R2_ACCESS_KEY_ID: 'key',
  PACKRAT_BUCKET_R2_SECRET_ACCESS_KEY: 'key',
  PACKRAT_BUCKET_R2_BUCKET_NAME: 'bucket',
  PACKRAT_ITEMS_BUCKET_R2_ACCESS_KEY_ID: 'key',
  PACKRAT_ITEMS_BUCKET_R2_SECRET_ACCESS_KEY: 'key',
  PACKRAT_ITEMS_BUCKET_R2_BUCKET_NAME: 'bucket',
  ETL_QUEUE: 'queue'
}

Object.assign(process.env, bindings)

export default defineWorkersConfig(
  defineConfig({
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    test: {
      setupFiles: ['./test/setup.ts'],
      pool: '@cloudflare/vitest-pool-workers',
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.toml' }
        }
      }
    }
  })
)
