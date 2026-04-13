// Stub for pg-cloudflare used in the test environment (wrangler alias in env.dev).
// Replaces the real pg-cloudflare (which uses cloudflare:sockets) with a Node.js
// net.Socket so that pg can connect to the local test PostgreSQL instance.
import { Socket } from 'node:net';

export class CloudflareSocket extends Socket {
  constructor(_ssl: boolean) {
    super();
  }

  // pg's getSecureStream calls socket.startTls() for TLS upgrades.
  // No TLS is needed for local test connections.
  startTls(_options: unknown): this {
    return this;
  }
}
