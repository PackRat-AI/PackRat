type BetterAuthError = {
  message?: string | null;
  status?: number;
  statusText?: string;
  code?: string;
};

// Maps Better Auth error codes to user-facing messages.
// Keep security-neutral where applicable (e.g. don't confirm whether a user exists).
const CODE_MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS: 'An account with this email already exists. Try signing in instead.',
  INVALID_EMAIL_OR_PASSWORD: 'Invalid email or password.',
  INVALID_PASSWORD: 'Invalid email or password.',
  USER_NOT_FOUND: 'Invalid email or password.',
  EMAIL_NOT_VERIFIED: 'Please verify your email before signing in.',
  TOO_MANY_REQUESTS: 'Too many attempts. Please wait a moment and try again.',
  INVALID_TOKEN: 'This link has expired or is invalid. Please request a new one.',
  EXPIRED_TOKEN: 'This link has expired or is invalid. Please request a new one.',
  PASSWORD_TOO_SHORT: 'Password is too short.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
};

/**
 * Error thrown when a Better Auth client call returns an error response.
 * Carries the original HTTP status and error code so Sentry has full context.
 */
export class AuthClientError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor({ message, source }: { message: string; source: BetterAuthError }) {
    super(message);
    this.name = 'AuthClientError';
    this.status = source.status ?? 0;
    this.code = source.code;
  }
}

/**
 * Converts a raw Better Auth error response into an AuthClientError with a
 * user-friendly message. Maps known error codes to clear copy; falls back to
 * the server message or a generic "try again" for 5xx responses.
 */
export function toAuthError({
  source,
  fallback,
}: {
  source: BetterAuthError;
  fallback: string;
}): AuthClientError {
  const code = source.code;
  const status = source.status ?? 0;

  let message: string;
  if (code && CODE_MESSAGES[code]) {
    message = CODE_MESSAGES[code];
  } else if (status >= 500) {
    message = 'Something went wrong on our end. Please try again in a moment.';
  } else if (source.message) {
    message = source.message;
  } else {
    message = fallback;
  }

  return new AuthClientError({ message, source });
}
