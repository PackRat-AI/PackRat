import { describe, expect, it } from 'vitest';
import type { Env } from '../../env-validation';
import { logAIRequest } from '../logging';

const baseEnv = {
  ENVIRONMENT: 'production',
  AI_PROVIDER: 'openai',
  OPENAI_API_KEY: 'sk-test',
  CLOUDFLARE_ACCOUNT_ID: 'test-account',
  CLOUDFLARE_AI_GATEWAY_ID: 'test-gateway',
  CLOUDFLARE_API_TOKEN: 'cf-token',
  AI: {},
} as Env;

describe('logAIRequest', () => {
  it('records Cloudflare unified billing metadata when Cloudflare config is complete', () => {
    const headers = new Headers({ 'cf-aig-log-id': 'log-123' });

    const log = logAIRequest({
      env: baseEnv,
      opts: {
        headers,
        log: { model: 'gpt-4o' },
      },
    });

    expect(log).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o',
      billingPath: 'cloudflare-unified',
      cloudflareGatewayId: 'test-gateway',
      cloudflareLogId: 'log-123',
    });
  });

  it('records direct provider billing path when Cloudflare config is incomplete', () => {
    const log = logAIRequest({
      env: { ...baseEnv, CLOUDFLARE_API_TOKEN: undefined } as Env,
      opts: {
        headers: new Headers(),
        log: { model: 'gpt-4o' },
      },
    });

    expect(log.billingPath).toBe('direct-provider');
    expect(log.cloudflareGatewayId).toBeUndefined();
    expect(log.cloudflareLogId).toBeUndefined();
  });

  it('preserves computed billing metadata over caller-provided log fields', () => {
    const log = logAIRequest({
      env: baseEnv,
      opts: {
        headers: new Headers({ 'cf-aig-log-id': 'log-456' }),
        log: {
          billingPath: 'direct-provider',
          provider: 'manual-provider',
          model: 'gpt-4o-mini',
          timestamp: new Date('2024-01-01T00:00:00.000Z'),
        },
      },
    });

    expect(log).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o-mini',
      billingPath: 'cloudflare-unified',
      cloudflareGatewayId: 'test-gateway',
      cloudflareLogId: 'log-456',
    });
    expect(log.timestamp.toISOString()).not.toBe('2024-01-01T00:00:00.000Z');
  });
});
