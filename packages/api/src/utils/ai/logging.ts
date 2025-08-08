import type { Env } from '@packrat/api/types/env';
import { extractCloudflareLogId } from './provider';

export interface AIRequestLog {
  provider: string;
  model: string;
  cloudflareLogId?: string | null;
  timestamp: Date;
  userId?: string;
  contextType?: string;
  error?: string;
}

export function logAIRequest(
  env: Env,
  headers: Headers,
  options: Partial<AIRequestLog>
): AIRequestLog {
  const log: AIRequestLog = {
    provider: env.AI_PROVIDER || 'openai',
    model: options.model || 'gpt-4o',
    timestamp: new Date(),
    ...options,
  };

  // Extract Cloudflare log ID if using Cloudflare Gateway
  if (env.AI_PROVIDER === 'cloudflare-workers-ai') {
    log.cloudflareLogId = extractCloudflareLogId(headers);
  }

  // Log to console in development
  if (env.ENVIRONMENT === 'development') {
    console.log('AI Request:', log);
  }

  return log;
}