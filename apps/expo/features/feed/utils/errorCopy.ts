/** An Eden Treaty error as the feed hooks rethrow it. */
export class FeedApiError extends Error {
  readonly status: number;
  readonly serverMessage: string | null;

  constructor({
    message,
    status,
    serverMessage,
  }: {
    message: string;
    status: number;
    serverMessage: string | null;
  }) {
    super(message);
    this.name = 'FeedApiError';
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

/** The `{ error }` text a refused feed request carries, if it has one. */
export function serverMessage(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'error' in value) {
    const { error } = value as { error: unknown };
    if (typeof error === 'string') return error;
  }
  return null;
}

/**
 * Copy for an action that failed. Server messages for refused actions ("Posting is suspended for
 * this account") are written for people and shown as-is; anything else gets `fallback`.
 */
export function feedErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof FeedApiError)) return fallback;
  const message = error.serverMessage;
  if (
    error.status >= 400 &&
    error.status < 500 &&
    message &&
    message.length <= 160 &&
    !message.includes('{')
  ) {
    return message;
  }
  return fallback;
}
