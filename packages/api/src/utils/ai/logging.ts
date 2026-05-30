import type { Env } from '@packrat/api/utils/env-validation';
import { type AIBillingPath, extractCloudflareLogId, getAIBillingPath } from './provider';

export interface AIRequestLog {
  provider: string;
  model: string;
  billingPath: AIBillingPath;
  cloudflareGatewayId?: string;
  cloudflareLogId?: string | null;
  timestamp: Date;
  userId?: string;
  contextType?: string;
  error?: string;
}

export function logAIRequest({
  env,
  opts,
}: {
  env: Env;
  opts: { headers: Headers; log: Partial<AIRequestLog> };
}): AIRequestLog {
  const { headers, log: options } = opts;
  const billingPath = getAIBillingPath({
    openAiApiKey: env.OPENAI_API_KEY,
    cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID,
    cloudflareGatewayId: env.CLOUDFLARE_AI_GATEWAY_ID,
    cloudflareApiToken: env.CLOUDFLARE_API_TOKEN,
    cloudflareAiBinding: env.AI,
  });
  const log: AIRequestLog = {
    ...options,
    provider: env.AI_PROVIDER || 'openai',
    model: options.model || 'gpt-4o',
    billingPath,
    timestamp: new Date(),
  };

  // Extract Cloudflare log ID if using Cloudflare Gateway
  if (billingPath === 'cloudflare-unified') {
    log.cloudflareGatewayId = env.CLOUDFLARE_AI_GATEWAY_ID;
    log.cloudflareLogId = extractCloudflareLogId(headers);
  }

  // Log to console in development
  if (env.ENVIRONMENT === 'development') {
    console.log('AI Request:', log);
  }

  return log;
}
