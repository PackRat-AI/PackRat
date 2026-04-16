/**
 * PackRat typed API client
 *
 * Authenticated HTTP client for the PackRat API with structured error handling
 * and MCP tool result helpers. Designed to be imported by packages/mcp and any
 * future consumers that need to call the PackRat REST API.
 *
 * Future work: integrate hc<AppRoutes>() from hono/client once the workspace is
 * configured with TypeScript project references so API declaration files can be
 * consumed without dragging in the full API dependency graph.
 */

// ── Error class ───────────────────────────────────────────────────────────────

export interface ApiErrorOptions {
  status: number;
  body: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, options: ApiErrorOptions) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.body = options.body;
  }
}

// ── HTTP client ───────────────────────────────────────────────────────────────

export type QueryParams = Record<string, string | number | boolean | undefined>;

export class PackRatApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getAuthToken: () => string,
  ) {}

  private get headers(): Record<string, string> {
    const token = this.getAuthToken();
    const base: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) {
      base.Authorization = `Bearer ${token}`;
    }
    return base;
  }

  async get<T = unknown>(path: string, params?: QueryParams): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    const response = await fetch(url.toString(), { method: 'GET', headers: this.headers });
    return this.handleResponse<T>(response);
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async put<T = unknown>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async delete<T = unknown>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    if (!response.ok) {
      const errorMessage =
        typeof body === 'object' && body !== null && 'error' in body
          ? String((body as Record<string, unknown>).error)
          : `HTTP ${response.status}: ${response.statusText}`;
      throw new ApiError(errorMessage, { status: response.status, body });
    }

    return body as T;
  }
}

// ── Client factory ────────────────────────────────────────────────────────────

/**
 * Create an authenticated PackRat API client.
 *
 * @param baseUrl      - API base URL (e.g. "https://packrat.world")
 * @param getAuthToken - Callback that returns the current JWT (may be empty)
 */
export function createPackRatClient(
  baseUrl: string,
  getAuthToken: () => string,
): PackRatApiClient {
  return new PackRatApiClient(baseUrl, getAuthToken);
}

// ── MCP tool result helpers ───────────────────────────────────────────────────

/** Format a successful MCP tool result */
export function ok(data: unknown): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

/** Format an error MCP tool result */
export function err(
  error: unknown,
): { content: [{ type: 'text'; text: string }]; isError: true } {
  const message =
    error instanceof ApiError
      ? `API Error (${error.status}): ${error.message}`
      : error instanceof Error
        ? error.message
        : String(error);
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}
