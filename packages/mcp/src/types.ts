/**
 * Minimal agent interface expected by tool/resource/prompt registration functions.
 *
 * Using a structural interface rather than the concrete PackRatMCP class avoids
 * the circular dependency: index.ts → tools/* → index.ts.
 * PackRatMCP satisfies this interface structurally via its `server` and `api` fields.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PackRatApiClient } from './client';

export interface AgentContext {
  server: McpServer;
  api: PackRatApiClient;
}
