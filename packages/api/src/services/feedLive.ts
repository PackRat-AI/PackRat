import { getEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';

/** The only message a post's live room sends. Clients refetch comments on receipt. */
export const COMMENTS_CHANGED_MESSAGE = '{"type":"comments.changed"}';

function roomFor(postId: number) {
  const namespace = getEnv().POST_LIVE_ROOM;
  if (!namespace) return null;
  return namespace.get(namespace.idFromName(String(postId)));
}

/**
 * Elysia rebuilds every response it returns to merge in CORS and request-id
 * headers, and a 101 cannot be rebuilt — it throws. So the route opens the
 * socket and parks the upgrade here, keyed by the request, and the Worker entry
 * returns it in place of Elysia's placeholder reply.
 */
const pendingUpgrades = new WeakMap<Request, Response>();

/** Opens a socket on the post's live room for an already-authorised request. */
export async function connectToPostLive({
  postId,
  request,
}: {
  postId: number;
  request: Request;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const room = roomFor(postId);
  if (!room) return { ok: false, status: 503, error: 'Live updates unavailable' };
  const upgrade = await room.fetch(request);
  if (upgrade.status !== 101) {
    return { ok: false, status: upgrade.status, error: 'Live updates unavailable' };
  }
  pendingUpgrades.set(request, upgrade);
  return { ok: true };
}

/** The WebSocket upgrade the live route opened for this request, if any. */
export function takePendingUpgrade(request: Request): Response | undefined {
  const upgrade = pendingUpgrades.get(request);
  pendingUpgrades.delete(request);
  return upgrade;
}

/**
 * Best effort: a missed signal only delays a comment until the next refresh,
 * so a failure here never fails the write that triggered it.
 */
export async function publishCommentsChanged({ postId }: { postId: number }): Promise<void> {
  const room = roomFor(postId);
  if (!room) return;
  try {
    await room.broadcast(COMMENTS_CHANGED_MESSAGE);
  } catch (error) {
    captureApiException({ error, operation: 'feed.publishCommentsChanged', extra: { postId } });
  }
}
