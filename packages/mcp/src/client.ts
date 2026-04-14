/**
 * PackRat API HTTP client used by MCP tool handlers.
 * All requests are authenticated with the user-provided JWT.
 */

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export class PackRatApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getAuthToken: () => string,
  ) {}

  private get headers(): Record<string, string> {
    const token = this.getAuthToken()
    const base: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
    if (token) {
      base['Authorization'] = `Bearer ${token}`
    }
    return base
  }

  async get<T = unknown>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      }
    }
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.headers,
    })
    return this.handleResponse<T>(response)
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return this.handleResponse<T>(response)
  }

  async put<T = unknown>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return this.handleResponse<T>(response)
  }

  async patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return this.handleResponse<T>(response)
  }

  async delete<T = unknown>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.headers,
    })
    return this.handleResponse<T>(response)
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const text = await response.text()
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }

    if (!response.ok) {
      const errorMessage =
        typeof body === 'object' && body !== null && 'error' in body
          ? String((body as Record<string, unknown>)['error'])
          : `HTTP ${response.status}: ${response.statusText}`
      throw new ApiError(errorMessage, response.status, body)
    }

    return body as T
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Format a successful tool result */
export function ok(data: unknown): { content: [{ type: 'text'; text: string }] } {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  }
}

/** Format an error tool result */
export function err(error: unknown): { content: [{ type: 'text'; text: string }]; isError: true } {
  const message =
    error instanceof ApiError
      ? `API Error (${error.status}): ${error.message}`
      : error instanceof Error
        ? error.message
        : String(error)
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  }
}
