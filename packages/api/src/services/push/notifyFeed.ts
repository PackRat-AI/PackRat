import { createDb } from '@packrat/api/db';
import { getEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
import { socialSettings, userDeviceTokens } from '@packrat/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { sendApnsPush } from './apnsClient';

export type FeedNotificationKind = 'tag' | 'comment' | 'reply';

const SETTING_FOR_KIND = Object.freeze({
  tag: 'notifyTags',
  comment: 'notifyComments',
  reply: 'notifyReplies',
} as const);

/** Runs `task` after the response is sent. Outside workerd (unit tests, the
 * OpenAPI generator) there is no request context, so it just runs inline. */
export async function runAfterResponse(task: () => Promise<void>): Promise<void> {
  let waitUntil: ((promise: Promise<unknown>) => void) | undefined;
  try {
    // Lazy so plain Bun/Node can load this module without the workerd virtual module.
    ({ waitUntil } = await import('cloudflare:workers'));
  } catch {
    waitUntil = undefined;
  }
  if (waitUntil) waitUntil(task());
  else await task();
}

/**
 * Pushes one feed notification to every device of each recipient who has not
 * turned that kind of notification off. Best-effort: a failed device never
 * aborts the batch, and an expired token is deleted so the table self-cleans.
 */
export async function notifyFeedRecipients({
  recipientIds,
  kind,
  title,
  body,
  postId,
}: {
  recipientIds: string[];
  kind: FeedNotificationKind;
  title: string;
  body: string;
  postId: number;
}): Promise<void> {
  const unique = [...new Set(recipientIds)];
  if (unique.length === 0) return;

  const env = getEnv();
  const db = createDb();
  try {
    const optedOut = await db
      .tag('feed.notify.listSettings')
      .select({
        userId: socialSettings.userId,
        notifyTags: socialSettings.notifyTags,
        notifyComments: socialSettings.notifyComments,
        notifyReplies: socialSettings.notifyReplies,
      })
      .from(socialSettings)
      .where(inArray(socialSettings.userId, unique));
    const setting = SETTING_FOR_KIND[kind];
    const muted = new Set(optedOut.filter((s) => !s[setting]).map((s) => s.userId));
    const recipients = unique.filter((id) => !muted.has(id));
    if (recipients.length === 0) return;

    const tokens = await db
      .tag('feed.notify.listDeviceTokens')
      .select({ id: userDeviceTokens.id, deviceToken: userDeviceTokens.deviceToken })
      .from(userDeviceTokens)
      .where(inArray(userDeviceTokens.userId, recipients));

    for (const token of tokens) {
      try {
        const result = await sendApnsPush({
          env,
          deviceToken: token.deviceToken,
          payload: { alert: { title, body }, postId },
        });
        if (result.outcome === 'invalid-token') {
          await db
            .tag('feed.notify.deleteStaleDeviceToken')
            .delete(userDeviceTokens)
            .where(eq(userDeviceTokens.id, token.id));
        } else if (result.outcome === 'error') {
          captureApiException({
            error: new Error(`APNs push failed: ${result.status} ${result.body}`),
            operation: 'feed.notifyFeedRecipients',
            tags: { feature: 'feed' },
            extra: { postId, kind, httpStatus: result.status },
          });
        }
      } catch (error) {
        captureApiException({
          error,
          operation: 'feed.notifyFeedRecipients',
          tags: { feature: 'feed' },
          extra: { postId, kind },
        });
      }
    }
  } catch (error) {
    captureApiException({
      error,
      operation: 'feed.notifyFeedRecipients',
      tags: { feature: 'feed' },
      extra: { postId, kind },
    });
  }
}
