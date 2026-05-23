import { describe, expect, it } from 'vitest';
import pkg from '../../package.json' with { type: 'json' };
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

  it('has exactly 11 route entries (8 originals + status + 2 well-known)', () => {
    expect(Object.keys(WorkerRoute)).toHaveLength(11);
  });

  it('defines the status endpoint', () => {
    expect(WorkerRoute.Status).toBe('/status');
  });

  it('defines the RFC 9728 protected-resource well-known path', () => {
    expect(WorkerRoute.WellKnownProtectedResource).toBe(
      '/.well-known/oauth-protected-resource',
    );
  });

  it('defines the RFC 8414 authorization-server well-known path', () => {
    expect(WorkerRoute.WellKnownAuthorizationServer).toBe(
      '/.well-known/oauth-authorization-server',
    );
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

  it('declares the MCP server display name shown to clients', () => {
    expect(ServiceMeta.McpServerName).toBe('packrat');
  });

  it('has a semver-formatted version', () => {
    expect(ServiceMeta.Version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('keeps Version in lockstep with package.json — single source of truth', () => {
    // ServiceMeta.Version is mirrored from package.json by hand; this test
    // is the only thing that catches drift before /health, McpServer, and
    // the listing surface diverge again.
    expect(ServiceMeta.Version).toBe(pkg.version);
  });

  it('uses streamable-http transport', () => {
    expect(ServiceMeta.Transport).toBe('streamable-http');
  });
});
