import { describe, expect, it } from 'vitest';
import { ServiceMeta, WorkerRoute } from '../constants';

describe('WorkerRoute', () => {
  it('defines the root path', () => {
    expect(WorkerRoute.Root).toBe('/');
  });

  it('defines the health endpoint', () => {
    expect(WorkerRoute.Health).toBe('/health');
  });

  it('defines the MCP endpoint', () => {
    expect(WorkerRoute.Mcp).toBe('/mcp');
  });

  it('defines the OAuth authorize endpoint', () => {
    expect(WorkerRoute.Authorize).toBe('/authorize');
  });

  it('defines the login endpoint', () => {
    expect(WorkerRoute.Login).toBe('/login');
  });

  it('defines the OAuth callback endpoint', () => {
    expect(WorkerRoute.Callback).toBe('/callback');
  });

  it('defines the token endpoint', () => {
    expect(WorkerRoute.Token).toBe('/token');
  });

  it('defines the register endpoint', () => {
    expect(WorkerRoute.Register).toBe('/register');
  });

  it('has exactly 8 route entries', () => {
    expect(Object.keys(WorkerRoute)).toHaveLength(8);
  });

  it('all routes start with /', () => {
    for (const route of Object.values(WorkerRoute)) {
      expect(route.startsWith('/')).toBe(true);
    }
  });

  it('all route values are unique', () => {
    const values = Object.values(WorkerRoute);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('ServiceMeta', () => {
  it('has the correct service name', () => {
    expect(ServiceMeta.Name).toBe('packrat-mcp');
  });

  it('has a semver-formatted version', () => {
    expect(ServiceMeta.Version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('uses streamable-http transport', () => {
    expect(ServiceMeta.Transport).toBe('streamable-http');
  });
});
