/** Keeps the socket inside the session's 30 s idle timeout. The server answers "ping" without waking the room. */
export const LIVE_KEEPALIVE_MS = 20_000;

/** 1 s, 2 s, 4 s … capped at 30 s. */
export function liveReconnectDelayMs(failures: number): number {
  return Math.min(30, 2 ** Math.min(Math.max(failures - 1, 0), 5)) * 1000;
}

/** Whether a frame from a post's live channel says its comments changed. */
export function isCommentsChangedSignal(data: unknown): boolean {
  if (typeof data !== 'string') return false;
  try {
    const parsed: unknown = JSON.parse(data);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { type?: unknown }).type === 'comments.changed'
    );
  } catch {
    return false;
  }
}

const TRAILING_SLASHES = /\/+$/;
const HTTP_SCHEME = /^http/i;

/** `wss://…/api/feed/{postId}/live` from the API's http(s) base URL. */
export function liveCommentsUrl(apiBaseUrl: string, postId: number): string {
  const base = apiBaseUrl.replace(TRAILING_SLASHES, '').replace(HTTP_SCHEME, 'ws');
  return `${base}/api/feed/${postId}/live`;
}
