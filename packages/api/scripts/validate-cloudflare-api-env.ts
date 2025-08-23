#!/usr/bin/env bun
import { validateCloudflareApiEnv } from '../src/utils/env-validation';

console.log('🔍 Validating Cloudflare API environment variables...');

try {
  validateCloudflareApiEnv(process.env);
  console.log('✅ Cloudflare API environment validation passed');
} catch (error) {
  console.error('❌ Cloudflare API environment validation failed!');
  console.error(error);
  process.exit(1);
}
