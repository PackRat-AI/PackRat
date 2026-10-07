import { createDb } from '@packrat/api/db';
import { publishCommentsChanged } from '@packrat/api/services/feedLive';
import { notifyFeedRecipients, runAfterResponse } from '@packrat/api/services/push/notifyFeed';
import { getEnv } from '@packrat/api/utils/env-validation';
import {
  commentLikes,
  feedReports,
  postComments,
  postLikes,
  postSaves,
  posts,
  postTags,
  socialSettings,
  userBlocks,
  users,
} from '@packrat/db/schema';
import type {
  AdminFeedReport,
  FeedComment,
  FeedPost,
  FeedReportReason,
  PublicPost,
  SocialSettingsValues,
} from '@packrat/schemas/feed';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  notInArray,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

type Db = ReturnType<typeof createDb>;

const ABSOLUTE_URL_REGEX = /^https?:\/\//;
const TRAILING_SLASH_REGEX = /\/$/;
const LIKE_SPECIAL_CHARS_REGEX = /[\\%_]/g;

// Accounts created by email sign-up carry only a display name; fall back to it.
const userFirstName = sql<string | null>`coalesce(nullif(${users.firstName}, ''), ${users.name})`;

export type ServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 403 | 404; error: string };

const ok = <T>(value: T): ServiceResult<T> => ({ ok: true, value });
const fail = (status: 400 | 403 | 404, error: string): ServiceResult<never> => ({
  ok: false,
  status,
  error,
});

const DEFAULT_SETTINGS: SocialSettingsValues = Object.freeze({
  allowTagging: true,
  notifyTags: true,
  notifyComments: true,
  notifyReplies: true,
});

type Person = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl?: string | null;
};

export function displayName(person: {
  firstName: string | null;
  lastName: string | null;
  name?: string | null;
}): string {
  const full = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  return full || person.name?.trim() || 'Someone';
}

// ── Visibility ────────────────────────────────────────────────────────────────

/**
 * Hides content authored by anyone the viewer blocked, anyone who blocked the
 * viewer, and anyone a moderator suspended.
 */
function visibleAuthor({
  db,
  viewerId,
  column,
}: {
  db: Db;
  viewerId: string | null;
  column: AnyPgColumn;
}): SQL {
  const suspended = db
    .select({ id: socialSettings.userId })
    .from(socialSettings)
    .where(isNotNull(socialSettings.suspendedAt));
  if (!viewerId) return notInArray(column, suspended);

  const blockedByMe = db
    .select({ id: userBlocks.blockedId })
    .from(userBlocks)
    .where(eq(userBlocks.blockerId, viewerId));
  const blockingMe = db
    .select({ id: userBlocks.blockerId })
    .from(userBlocks)
    .where(eq(userBlocks.blockedId, viewerId));
  // biome-ignore lint/style/noNonNullAssertion: and() of defined conditions is never undefined
  return and(
    notInArray(column, suspended),
    notInArray(column, blockedByMe),
    notInArray(column, blockingMe),
  )!;
}

function livePost(): SQL {
  // biome-ignore lint/style/noNonNullAssertion: and() of defined conditions is never undefined
  return and(isNull(posts.deletedAt), isNull(posts.removedAt))!;
}

/** Posts and comments the viewer reported disappear for them straight away. */
function notReportedPost({ db, viewerId }: { db: Db; viewerId: string }): SQL {
  return notInArray(
    posts.id,
    db
      .select({ id: sql<number>`${feedReports.postId}` })
      .from(feedReports)
      .where(and(eq(feedReports.reporterId, viewerId), isNotNull(feedReports.postId))),
  );
}

function notReportedComment({ db, viewerId }: { db: Db; viewerId: string }): SQL {
  return notInArray(
    postComments.id,
    db
      .select({ id: sql<number>`${feedReports.commentId}` })
      .from(feedReports)
      .where(and(eq(feedReports.reporterId, viewerId), isNotNull(feedReports.commentId))),
  );
}

function liveComment(): SQL {
  // biome-ignore lint/style/noNonNullAssertion: and() of defined conditions is never undefined
  return and(isNull(postComments.deletedAt), isNull(postComments.removedAt))!;
}

async function isSuspended({ db, userId }: { db: Db; userId: string }): Promise<boolean> {
  const [row] = await db
    .tag('feed.checkSuspended')
    .select({ suspendedAt: socialSettings.suspendedAt })
    .from(socialSettings)
    .where(eq(socialSettings.userId, userId))
    .limit(1);
  return Boolean(row?.suspendedAt);
}

/** Loads a post the viewer is allowed to see, or null. */
async function findVisiblePost({
  db,
  viewerId,
  postId,
}: {
  db: Db;
  viewerId: string;
  postId: number;
}) {
  const [post] = await db
    .tag('feed.getVisiblePost')
    .select({ id: posts.id, userId: posts.userId, caption: posts.caption })
    .from(posts)
    .where(
      and(
        eq(posts.id, postId),
        livePost(),
        visibleAuthor({ db, viewerId, column: posts.userId }),
        notReportedPost({ db, viewerId }),
      ),
    )
    .limit(1);
  return post ?? null;
}

// ── Hydration ─────────────────────────────────────────────────────────────────

const postColumns = {
  id: posts.id,
  userId: posts.userId,
  caption: posts.caption,
  images: posts.images,
  publicId: posts.publicId,
  captionEditedAt: posts.captionEditedAt,
  createdAt: posts.createdAt,
  updatedAt: posts.updatedAt,
  firstName: userFirstName,
  lastName: users.lastName,
  avatarUrl: users.avatarUrl,
};

type PostRow = {
  id: number;
  userId: string;
  caption: string | null;
  images: string[];
  publicId: string;
  captionEditedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

async function hydratePosts({
  db,
  viewerId,
  rows,
}: {
  db: Db;
  viewerId: string;
  rows: PostRow[];
}): Promise<FeedPost[]> {
  if (rows.length === 0) return [];
  const postIds = rows.map((p) => p.id);

  const [likeCounts, myLikes, commentCounts, mySaves, tagRows] = await Promise.all([
    db
      .tag('feed.countPostLikes')
      .select({ postId: postLikes.postId, cnt: count() })
      .from(postLikes)
      .where(inArray(postLikes.postId, postIds))
      .groupBy(postLikes.postId),
    db
      .tag('feed.myPostLikes')
      .select({ postId: postLikes.postId })
      .from(postLikes)
      .where(and(inArray(postLikes.postId, postIds), eq(postLikes.userId, viewerId))),
    db
      .tag('feed.countComments')
      .select({ postId: postComments.postId, cnt: count() })
      .from(postComments)
      .where(
        and(
          inArray(postComments.postId, postIds),
          liveComment(),
          visibleAuthor({ db, viewerId, column: postComments.userId }),
          notReportedComment({ db, viewerId }),
        ),
      )
      .groupBy(postComments.postId),
    db
      .tag('feed.mySaves')
      .select({ postId: postSaves.postId })
      .from(postSaves)
      .where(and(inArray(postSaves.postId, postIds), eq(postSaves.userId, viewerId))),
    db
      .tag('feed.listTags')
      .select({
        postId: postTags.postId,
        id: users.id,
        firstName: userFirstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
      })
      .from(postTags)
      .innerJoin(users, eq(postTags.userId, users.id))
      .where(
        and(
          inArray(postTags.postId, postIds),
          visibleAuthor({ db, viewerId, column: postTags.userId }),
        ),
      ),
  ]);

  const likeCountMap = new Map(likeCounts.map((l) => [l.postId, l.cnt]));
  const myLikeSet = new Set(myLikes.map((l) => l.postId));
  const commentCountMap = new Map(commentCounts.map((c) => [c.postId, c.cnt]));
  const mySaveSet = new Set(mySaves.map((s) => s.postId));
  const tagsByPost = new Map<number, Person[]>();
  for (const t of tagRows) {
    const list = tagsByPost.get(t.postId) ?? [];
    list.push({ id: t.id, firstName: t.firstName, lastName: t.lastName, avatarUrl: t.avatarUrl });
    tagsByPost.set(t.postId, list);
  }

  return rows.map((p) => ({
    id: p.id,
    userId: p.userId,
    caption: p.caption,
    images: Array.isArray(p.images) ? p.images : [],
    publicId: p.publicId,
    captionEditedAt: p.captionEditedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    author: {
      id: p.userId,
      firstName: p.firstName,
      lastName: p.lastName,
      avatarUrl: p.avatarUrl,
    },
    likeCount: likeCountMap.get(p.id) ?? 0,
    commentCount: commentCountMap.get(p.id) ?? 0,
    likedByMe: myLikeSet.has(p.id),
    savedByMe: mySaveSet.has(p.id),
    tags: tagsByPost.get(p.id) ?? [],
  }));
}

// ── Tagging ───────────────────────────────────────────────────────────────────

/**
 * Tags whichever of `candidateIds` may be tagged by `taggerId` on `postId`
 * (exists, isn't the tagger, allows tagging, no block either way) and returns
 * the ids that were newly tagged — the ones to notify.
 */
async function applyTags({
  db,
  postId,
  taggerId,
  candidateIds,
}: {
  db: Db;
  postId: number;
  taggerId: string;
  candidateIds: string[] | undefined;
}): Promise<string[]> {
  const ids = [...new Set(candidateIds ?? [])].filter((id) => id !== taggerId);
  if (ids.length === 0) return [];

  const allowed = await db
    .tag('feed.filterTaggable')
    .select({ id: users.id })
    .from(users)
    .leftJoin(socialSettings, eq(socialSettings.userId, users.id))
    .where(
      and(
        inArray(users.id, ids),
        or(isNull(socialSettings.allowTagging), eq(socialSettings.allowTagging, true)),
        visibleAuthor({ db, viewerId: taggerId, column: users.id }),
      ),
    );
  if (allowed.length === 0) return [];

  const inserted = await db
    .tag('feed.insertTags')
    .insert(postTags)
    .values(allowed.map((u) => ({ postId, userId: u.id, taggedBy: taggerId })))
    .onConflictDoNothing()
    .returning();
  return inserted.map((r) => r.userId);
}

async function authorName({ db, userId }: { db: Db; userId: string }): Promise<string> {
  const [row] = await db
    .tag('feed.getAuthorName')
    .select({ firstName: userFirstName, lastName: users.lastName, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ? displayName(row) : 'Someone';
}

function preview(text: string | null | undefined, max = 80): string {
  const t = (text ?? '').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

async function notifyTagged({
  db,
  postId,
  taggerId,
  taggedIds,
}: {
  db: Db;
  postId: number;
  taggerId: string;
  taggedIds: string[];
}): Promise<void> {
  if (taggedIds.length === 0) return;
  const name = await authorName({ db, userId: taggerId });
  await runAfterResponse(() =>
    notifyFeedRecipients({
      recipientIds: taggedIds,
      kind: 'tag',
      title: `${name} tagged you`,
      body: 'Tap to see the post.',
      postId,
    }),
  );
}

// ── Posts ─────────────────────────────────────────────────────────────────────

export type FeedScope = 'all' | 'saved' | 'tagged';

export async function listPosts({
  viewerId,
  page,
  limit,
  scope,
}: {
  viewerId: string;
  page: number;
  limit: number;
  scope: FeedScope;
}) {
  const db = createDb();
  const offset = (page - 1) * limit;

  const scopeFilter =
    scope === 'saved'
      ? inArray(
          posts.id,
          db.select({ id: postSaves.postId }).from(postSaves).where(eq(postSaves.userId, viewerId)),
        )
      : scope === 'tagged'
        ? inArray(
            posts.id,
            db.select({ id: postTags.postId }).from(postTags).where(eq(postTags.userId, viewerId)),
          )
        : undefined;

  const where = and(
    livePost(),
    visibleAuthor({ db, viewerId, column: posts.userId }),
    notReportedPost({ db, viewerId }),
    scopeFilter,
  );

  const [totalResult, rows] = await Promise.all([
    db.tag('feed.countPosts').select({ count: count() }).from(posts).where(where),
    db
      .tag('feed.listPosts')
      .select(postColumns)
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .where(where)
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .limit(limit)
      .offset(offset),
  ]);

  const total = totalResult[0]?.count ?? 0;
  const items = await hydratePosts({ db, viewerId, rows });
  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function getPost({
  viewerId,
  postId,
}: {
  viewerId: string;
  postId: number;
}): Promise<ServiceResult<FeedPost>> {
  const db = createDb();
  const rows = await db
    .tag('feed.getPost')
    .select(postColumns)
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .where(
      and(
        eq(posts.id, postId),
        livePost(),
        visibleAuthor({ db, viewerId, column: posts.userId }),
        notReportedPost({ db, viewerId }),
      ),
    )
    .limit(1);
  const [post] = await hydratePosts({ db, viewerId, rows });
  return post ? ok(post) : fail(404, 'Post not found');
}

/** Resolves a shared link's public id to the post, for a signed-in viewer. */
export async function getPostByPublicId({
  viewerId,
  publicId,
}: {
  viewerId: string;
  publicId: string;
}): Promise<ServiceResult<FeedPost>> {
  const db = createDb();
  const [row] = await db
    .tag('feed.getPostIdByPublicId')
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.publicId, publicId))
    .limit(1);
  if (!row) return fail(404, 'Post not found');
  return getPost({ viewerId, postId: row.id });
}

/** Image keys must be objects this user uploaded (`{userId}-…`, no path). */
function ownsImageKeys(userId: string, images: string[]): boolean {
  return images.every((key) => key.startsWith(`${userId}-`) && !key.includes('/'));
}

export async function createPost({
  userId,
  caption,
  images,
  taggedUserIds,
}: {
  userId: string;
  caption: string | undefined;
  images: string[];
  taggedUserIds: string[] | undefined;
}): Promise<ServiceResult<FeedPost>> {
  const db = createDb();
  if (await isSuspended({ db, userId })) return fail(403, 'Posting is suspended for this account');
  if (!ownsImageKeys(userId, images)) return fail(400, 'Images must be uploaded by the poster');

  const trimmed = caption?.trim() || null;
  const [created] = await db
    .tag('feed.createPost')
    .insert(posts)
    .values({ userId, caption: trimmed, images })
    .returning();
  if (!created) return fail(400, 'Failed to create post');

  const taggedIds = await applyTags({
    db,
    postId: created.id,
    taggerId: userId,
    candidateIds: taggedUserIds,
  });
  await notifyTagged({ db, postId: created.id, taggerId: userId, taggedIds });

  return getPost({ viewerId: userId, postId: created.id });
}

export async function updatePost({
  userId,
  postId,
  caption,
  taggedUserIds,
}: {
  userId: string;
  postId: number;
  caption: string | null;
  taggedUserIds: string[] | undefined;
}): Promise<ServiceResult<FeedPost>> {
  const db = createDb();
  const [post] = await db
    .tag('feed.getOwnPost')
    .select({ id: posts.id, userId: posts.userId, images: posts.images })
    .from(posts)
    .where(and(eq(posts.id, postId), livePost()))
    .limit(1);
  if (!post) return fail(404, 'Post not found');
  if (post.userId !== userId) return fail(403, 'Forbidden');

  const trimmed = caption?.trim() || null;
  if (!trimmed && (post.images ?? []).length === 0) {
    return fail(400, 'A post needs at least one photo or a caption');
  }

  const now = new Date();
  await db
    .tag('feed.updatePostCaption')
    .update(posts)
    .set({ caption: trimmed, captionEditedAt: now, updatedAt: now })
    .where(eq(posts.id, postId));

  const taggedIds = await applyTags({ db, postId, taggerId: userId, candidateIds: taggedUserIds });
  await notifyTagged({ db, postId, taggerId: userId, taggedIds });

  return getPost({ viewerId: userId, postId });
}

export async function deletePost({
  userId,
  postId,
}: {
  userId: string;
  postId: number;
}): Promise<ServiceResult<{ success: true }>> {
  const db = createDb();
  const [post] = await db
    .tag('feed.getOwnPost')
    .select({ userId: posts.userId })
    .from(posts)
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
    .limit(1);
  if (!post) return fail(404, 'Post not found');
  if (post.userId !== userId) return fail(403, 'Forbidden');

  await db
    .tag('feed.softDeletePost')
    .update(posts)
    .set({ deletedAt: new Date() })
    .where(eq(posts.id, postId));
  return ok({ success: true });
}

export async function togglePostLike({
  userId,
  postId,
}: {
  userId: string;
  postId: number;
}): Promise<ServiceResult<{ liked: boolean; likeCount: number }>> {
  const db = createDb();
  if (!(await findVisiblePost({ db, viewerId: userId, postId }))) {
    return fail(404, 'Post not found');
  }

  const removed = await db
    .tag('feed.unlikePost')
    .delete(postLikes)
    .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
    .returning();
  if (removed.length === 0) {
    await db
      .tag('feed.likePost')
      .insert(postLikes)
      .values({ postId, userId })
      .onConflictDoNothing();
  }

  const [likeCount] = await db
    .tag('feed.countLikes')
    .select({ cnt: count() })
    .from(postLikes)
    .where(eq(postLikes.postId, postId));
  return ok({ liked: removed.length === 0, likeCount: likeCount?.cnt ?? 0 });
}

export async function setPostSaved({
  userId,
  postId,
  saved,
}: {
  userId: string;
  postId: number;
  saved: boolean;
}): Promise<ServiceResult<{ saved: boolean }>> {
  const db = createDb();
  if (saved) {
    if (!(await findVisiblePost({ db, viewerId: userId, postId }))) {
      return fail(404, 'Post not found');
    }
    await db
      .tag('feed.savePost')
      .insert(postSaves)
      .values({ postId, userId })
      .onConflictDoNothing();
  } else {
    await db
      .tag('feed.unsavePost')
      .delete(postSaves)
      .where(and(eq(postSaves.postId, postId), eq(postSaves.userId, userId)));
  }
  return ok({ saved });
}

export async function removeOwnTag({
  userId,
  postId,
}: {
  userId: string;
  postId: number;
}): Promise<ServiceResult<{ success: true }>> {
  const db = createDb();
  await db
    .tag('feed.removeOwnTag')
    .delete(postTags)
    .where(and(eq(postTags.postId, postId), eq(postTags.userId, userId)));
  return ok({ success: true });
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function listComments({
  viewerId,
  postId,
  page,
  limit,
}: {
  viewerId: string;
  postId: number;
  page: number;
  limit: number;
}) {
  const db = createDb();
  if (!(await findVisiblePost({ db, viewerId, postId }))) return fail(404, 'Post not found');

  const offset = (page - 1) * limit;
  const where = and(
    eq(postComments.postId, postId),
    liveComment(),
    visibleAuthor({ db, viewerId, column: postComments.userId }),
    notReportedComment({ db, viewerId }),
  );

  const [totalResult, rows] = await Promise.all([
    db.tag('feed.countComments').select({ count: count() }).from(postComments).where(where),
    db
      .tag('feed.listComments')
      .select({
        id: postComments.id,
        postId: postComments.postId,
        userId: postComments.userId,
        content: postComments.content,
        parentCommentId: postComments.parentCommentId,
        editedAt: postComments.editedAt,
        createdAt: postComments.createdAt,
        updatedAt: postComments.updatedAt,
        firstName: userFirstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
      })
      .from(postComments)
      .innerJoin(users, eq(postComments.userId, users.id))
      .where(where)
      // Oldest first, so a thread reads top to bottom.
      .orderBy(asc(postComments.createdAt), asc(postComments.id))
      .limit(limit)
      .offset(offset),
  ]);

  const total = totalResult[0]?.count ?? 0;
  const ids = rows.map((r) => r.id);
  const [likeCounts, myLikes] = ids.length
    ? await Promise.all([
        db
          .tag('feed.countCommentLikes')
          .select({ commentId: commentLikes.commentId, cnt: count() })
          .from(commentLikes)
          .where(inArray(commentLikes.commentId, ids))
          .groupBy(commentLikes.commentId),
        db
          .tag('feed.myCommentLikes')
          .select({ commentId: commentLikes.commentId })
          .from(commentLikes)
          .where(and(inArray(commentLikes.commentId, ids), eq(commentLikes.userId, viewerId))),
      ])
    : [[], []];
  const likeCountMap = new Map(likeCounts.map((l) => [l.commentId, l.cnt]));
  const myLikeSet = new Set(myLikes.map((l) => l.commentId));

  const items: FeedComment[] = rows.map((r) => ({
    id: r.id,
    postId: r.postId,
    userId: r.userId,
    content: r.content,
    parentCommentId: r.parentCommentId,
    editedAt: r.editedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    author: { id: r.userId, firstName: r.firstName, lastName: r.lastName, avatarUrl: r.avatarUrl },
    likeCount: likeCountMap.get(r.id) ?? 0,
    likedByMe: myLikeSet.has(r.id),
  }));

  return ok({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
}

export async function createComment({
  userId,
  postId,
  content,
  parentCommentId,
  taggedUserIds,
}: {
  userId: string;
  postId: number;
  content: string;
  parentCommentId: number | undefined;
  taggedUserIds: string[] | undefined;
}): Promise<ServiceResult<FeedComment>> {
  const db = createDb();
  if (await isSuspended({ db, userId })) {
    return fail(403, 'Commenting is suspended for this account');
  }
  const post = await findVisiblePost({ db, viewerId: userId, postId });
  if (!post) return fail(404, 'Post not found');

  // Threads are one level deep: a reply to a reply joins the top-level thread.
  let threadParentId: number | null = null;
  let replyToUserId: string | null = null;
  if (parentCommentId !== undefined) {
    const [parent] = await db
      .tag('feed.getParentComment')
      .select({
        id: postComments.id,
        userId: postComments.userId,
        parentCommentId: postComments.parentCommentId,
      })
      .from(postComments)
      .where(
        and(eq(postComments.id, parentCommentId), eq(postComments.postId, postId), liveComment()),
      )
      .limit(1);
    if (!parent) return fail(404, 'Comment not found');
    threadParentId = parent.parentCommentId ?? parent.id;
    replyToUserId = parent.userId;
  }

  const [created] = await db
    .tag('feed.createComment')
    .insert(postComments)
    .values({ postId, userId, content: content.trim(), parentCommentId: threadParentId })
    .returning();
  if (!created) return fail(400, 'Failed to create comment');
  await signalCommentsChanged(postId);

  const taggedIds = await applyTags({ db, postId, taggerId: userId, candidateIds: taggedUserIds });
  await notifyTagged({ db, postId, taggerId: userId, taggedIds });

  const name = await authorName({ db, userId });
  const body = preview(content);
  const alreadyNotified = new Set([userId, ...taggedIds]);
  if (replyToUserId && !alreadyNotified.has(replyToUserId)) {
    alreadyNotified.add(replyToUserId);
    const recipient = replyToUserId;
    await runAfterResponse(() =>
      notifyFeedRecipients({
        recipientIds: [recipient],
        kind: 'reply',
        title: `${name} replied to you`,
        body,
        postId,
      }),
    );
  }
  if (!alreadyNotified.has(post.userId)) {
    await runAfterResponse(() =>
      notifyFeedRecipients({
        recipientIds: [post.userId],
        kind: 'comment',
        title: `${name} commented on your post`,
        body,
        postId,
      }),
    );
  }

  const [row] = await db
    .tag('feed.getCreatedComment')
    .select({
      createdAt: postComments.createdAt,
      updatedAt: postComments.updatedAt,
      firstName: userFirstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
    })
    .from(postComments)
    .innerJoin(users, eq(postComments.userId, users.id))
    .where(eq(postComments.id, created.id))
    .limit(1);

  const createdAt = row?.createdAt ?? new Date();
  return ok({
    id: created.id,
    postId,
    userId,
    content: content.trim(),
    parentCommentId: threadParentId,
    editedAt: null,
    createdAt: createdAt.toISOString(),
    updatedAt: (row?.updatedAt ?? createdAt).toISOString(),
    author: {
      id: userId,
      firstName: row?.firstName ?? null,
      lastName: row?.lastName ?? null,
      avatarUrl: row?.avatarUrl ?? null,
    },
    likeCount: 0,
    likedByMe: false,
  });
}

/** Tells anyone watching the post's comments to refetch them. */
async function signalCommentsChanged(postId: number): Promise<void> {
  await runAfterResponse(() => publishCommentsChanged({ postId }));
}

async function findLiveComment({
  db,
  postId,
  commentId,
}: {
  db: Db;
  postId: number;
  commentId: number;
}) {
  const [comment] = await db
    .tag('feed.getComment')
    .select({ id: postComments.id, userId: postComments.userId })
    .from(postComments)
    .where(and(eq(postComments.id, commentId), eq(postComments.postId, postId), liveComment()))
    .limit(1);
  return comment ?? null;
}

export async function updateComment({
  userId,
  postId,
  commentId,
  content,
  taggedUserIds,
}: {
  userId: string;
  postId: number;
  commentId: number;
  content: string;
  taggedUserIds: string[] | undefined;
}): Promise<ServiceResult<{ id: number; content: string; editedAt: string }>> {
  const db = createDb();
  const comment = await findLiveComment({ db, postId, commentId });
  if (!comment) return fail(404, 'Comment not found');
  if (comment.userId !== userId) return fail(403, 'Forbidden');

  const now = new Date();
  await db
    .tag('feed.updateComment')
    .update(postComments)
    .set({ content: content.trim(), editedAt: now, updatedAt: now })
    .where(eq(postComments.id, commentId));
  await signalCommentsChanged(postId);

  const taggedIds = await applyTags({ db, postId, taggerId: userId, candidateIds: taggedUserIds });
  await notifyTagged({ db, postId, taggerId: userId, taggedIds });

  return ok({ id: commentId, content: content.trim(), editedAt: now.toISOString() });
}

/** The commenter, or the author of the post, can delete a comment. */
export async function deleteComment({
  userId,
  postId,
  commentId,
}: {
  userId: string;
  postId: number;
  commentId: number;
}): Promise<ServiceResult<{ success: true }>> {
  const db = createDb();
  const comment = await findLiveComment({ db, postId, commentId });
  if (!comment) return fail(404, 'Comment not found');

  if (comment.userId !== userId) {
    const [post] = await db
      .tag('feed.getPostOwner')
      .select({ userId: posts.userId })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);
    if (post?.userId !== userId) return fail(403, 'Forbidden');
  }

  await db
    .tag('feed.softDeleteComment')
    .update(postComments)
    .set({ deletedAt: new Date() })
    .where(eq(postComments.id, commentId));
  await signalCommentsChanged(postId);
  return ok({ success: true });
}

export async function toggleCommentLike({
  userId,
  postId,
  commentId,
}: {
  userId: string;
  postId: number;
  commentId: number;
}): Promise<ServiceResult<{ liked: boolean; likeCount: number }>> {
  const db = createDb();
  if (!(await findVisiblePost({ db, viewerId: userId, postId }))) {
    return fail(404, 'Post not found');
  }
  if (!(await findLiveComment({ db, postId, commentId }))) return fail(404, 'Comment not found');

  const removed = await db
    .tag('feed.unlikeComment')
    .delete(commentLikes)
    .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)))
    .returning();
  if (removed.length === 0) {
    await db
      .tag('feed.likeComment')
      .insert(commentLikes)
      .values({ commentId, userId })
      .onConflictDoNothing();
  }

  const [likeCount] = await db
    .tag('feed.countCommentLikes')
    .select({ cnt: count() })
    .from(commentLikes)
    .where(eq(commentLikes.commentId, commentId));
  await signalCommentsChanged(postId);
  return ok({ liked: removed.length === 0, likeCount: likeCount?.cnt ?? 0 });
}

// ── Reports, blocks, mentions, settings ───────────────────────────────────────

export async function reportContent({
  userId,
  postId,
  commentId,
  reason,
}: {
  userId: string;
  postId: number | undefined;
  commentId: number | undefined;
  reason: FeedReportReason;
}): Promise<ServiceResult<{ success: true }>> {
  const db = createDb();
  if (postId !== undefined) {
    const [post] = await db
      .tag('feed.getReportedPost')
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);
    if (!post) return fail(404, 'Post not found');
  } else if (commentId !== undefined) {
    const [comment] = await db
      .tag('feed.getReportedComment')
      .select({ id: postComments.id })
      .from(postComments)
      .where(eq(postComments.id, commentId))
      .limit(1);
    if (!comment) return fail(404, 'Comment not found');
  }

  const target =
    postId !== undefined
      ? eq(feedReports.postId, postId)
      : eq(feedReports.commentId, commentId ?? -1);
  const [existing] = await db
    .tag('feed.findOwnReport')
    .select({ id: feedReports.id })
    .from(feedReports)
    .where(and(eq(feedReports.reporterId, userId), target, eq(feedReports.status, 'pending')))
    .limit(1);
  if (!existing) {
    await db
      .tag('feed.createReport')
      .insert(feedReports)
      .values({ reporterId: userId, postId: postId ?? null, commentId: commentId ?? null, reason });
  }
  return ok({ success: true });
}

export async function mentionSuggestions({
  userId,
  query,
}: {
  userId: string;
  query: string;
}): Promise<Person[]> {
  const db = createDb();
  const q = query.trim();
  if (q.length === 0) return [];
  const pattern = `%${q.replace(LIKE_SPECIAL_CHARS_REGEX, (c) => `\\${c}`)}%`;

  return db
    .tag('feed.mentionSuggestions')
    .select({
      id: users.id,
      firstName: userFirstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .leftJoin(socialSettings, eq(socialSettings.userId, users.id))
    .where(
      and(
        ne(users.id, userId),
        or(isNull(socialSettings.allowTagging), eq(socialSettings.allowTagging, true)),
        visibleAuthor({ db, viewerId: userId, column: users.id }),
        or(
          ilike(users.name, pattern),
          ilike(users.firstName, pattern),
          ilike(users.lastName, pattern),
          ilike(sql`concat_ws(' ', ${users.firstName}, ${users.lastName})`, pattern),
        ),
      ),
    )
    .orderBy(asc(userFirstName), asc(users.lastName))
    .limit(8);
}

export async function listBlocked({ userId }: { userId: string }): Promise<Person[]> {
  const db = createDb();
  return db
    .tag('feed.listBlocked')
    .select({
      id: users.id,
      firstName: userFirstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
    })
    .from(userBlocks)
    .innerJoin(users, eq(userBlocks.blockedId, users.id))
    .where(eq(userBlocks.blockerId, userId))
    .orderBy(desc(userBlocks.createdAt));
}

export async function blockUser({
  userId,
  blockedId,
}: {
  userId: string;
  blockedId: string;
}): Promise<ServiceResult<{ success: true }>> {
  if (userId === blockedId) return fail(400, 'You cannot block yourself');
  const db = createDb();
  const [target] = await db
    .tag('feed.getBlockTarget')
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, blockedId))
    .limit(1);
  if (!target) return fail(404, 'User not found');

  await db
    .tag('feed.blockUser')
    .insert(userBlocks)
    .values({ blockerId: userId, blockedId })
    .onConflictDoNothing();
  // Neither can be tagged by the other once blocked.
  await db
    .tag('feed.removeTagsBetween')
    .delete(postTags)
    .where(
      or(
        and(eq(postTags.taggedBy, userId), eq(postTags.userId, blockedId)),
        and(eq(postTags.taggedBy, blockedId), eq(postTags.userId, userId)),
      ),
    );
  return ok({ success: true });
}

export async function unblockUser({
  userId,
  blockedId,
}: {
  userId: string;
  blockedId: string;
}): Promise<ServiceResult<{ success: true }>> {
  const db = createDb();
  await db
    .tag('feed.unblockUser')
    .delete(userBlocks)
    .where(and(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, blockedId)));
  return ok({ success: true });
}

export async function getSettings({ userId }: { userId: string }): Promise<SocialSettingsValues> {
  const db = createDb();
  const [row] = await db
    .tag('feed.getSettings')
    .select({
      allowTagging: socialSettings.allowTagging,
      notifyTags: socialSettings.notifyTags,
      notifyComments: socialSettings.notifyComments,
      notifyReplies: socialSettings.notifyReplies,
    })
    .from(socialSettings)
    .where(eq(socialSettings.userId, userId))
    .limit(1);
  return row ?? { ...DEFAULT_SETTINGS };
}

export async function updateSettings({
  userId,
  changes,
}: {
  userId: string;
  changes: Partial<SocialSettingsValues>;
}): Promise<SocialSettingsValues> {
  const db = createDb();
  const current = await getSettings({ userId });
  const next = { ...current, ...changes };
  await db
    .tag('feed.upsertSettings')
    .insert(socialSettings)
    .values({ userId, ...next })
    .onConflictDoUpdate({
      target: socialSettings.userId,
      set: { ...changes, updatedAt: new Date() },
    });
  return next;
}

// ── Public share page ────────────────────────────────────────────────────────

export function resolveImageUrl(key: string): string {
  if (ABSOLUTE_URL_REGEX.test(key)) return key;
  const base = getEnv().R2_PUBLIC_URL.replace(TRAILING_SLASH_REGEX, '');
  return `${base}/${key}`;
}

export async function getPublicPost({
  publicId,
}: {
  publicId: string;
}): Promise<ServiceResult<PublicPost>> {
  const db = createDb();
  const [row] = await db
    .tag('feed.getPublicPost')
    .select({
      publicId: posts.publicId,
      caption: posts.caption,
      images: posts.images,
      createdAt: posts.createdAt,
      firstName: userFirstName,
      lastName: users.lastName,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .where(
      and(
        eq(posts.publicId, publicId),
        livePost(),
        visibleAuthor({ db, viewerId: null, column: posts.userId }),
      ),
    )
    .limit(1);
  if (!row) return fail(404, 'Post not found');

  return ok({
    publicId: row.publicId,
    caption: row.caption,
    images: (row.images ?? []).map(resolveImageUrl),
    createdAt: row.createdAt.toISOString(),
    authorName: displayName(row),
    authorAvatarUrl: row.avatarUrl ? resolveImageUrl(row.avatarUrl) : null,
  });
}

// ── Admin moderation ─────────────────────────────────────────────────────────

/** Pending reports, grouped one row per reported post or comment. */
export async function listPendingReports(): Promise<AdminFeedReport[]> {
  const db = createDb();
  const reports = await db
    .tag('feed.admin.listPendingReports')
    .select({
      postId: feedReports.postId,
      commentId: feedReports.commentId,
      reason: feedReports.reason,
      createdAt: feedReports.createdAt,
      reporterId: users.id,
      reporterFirstName: userFirstName,
      reporterLastName: users.lastName,
    })
    .from(feedReports)
    .innerJoin(users, eq(feedReports.reporterId, users.id))
    .where(eq(feedReports.status, 'pending'))
    .orderBy(asc(feedReports.createdAt));
  if (reports.length === 0) return [];

  const postIds = [...new Set(reports.flatMap((r) => (r.postId ? [r.postId] : [])))];
  const commentIds = [...new Set(reports.flatMap((r) => (r.commentId ? [r.commentId] : [])))];

  // inArray on an empty list compiles to `false`, so empty sides return no rows.
  const [postRows, commentRows] = await Promise.all([
    db
      .tag('feed.admin.getReportedPosts')
      .select({
        id: posts.id,
        userId: posts.userId,
        caption: posts.caption,
        images: posts.images,
        firstName: userFirstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .where(inArray(posts.id, postIds)),
    db
      .tag('feed.admin.getReportedComments')
      .select({
        id: postComments.id,
        postId: postComments.postId,
        userId: postComments.userId,
        content: postComments.content,
        firstName: userFirstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
      })
      .from(postComments)
      .innerJoin(users, eq(postComments.userId, users.id))
      .where(inArray(postComments.id, commentIds)),
  ]);

  const authorIds = [...postRows.map((p) => p.userId), ...commentRows.map((c) => c.userId)];
  const suspendedRows = authorIds.length
    ? await db
        .tag('feed.admin.getSuspended')
        .select({ userId: socialSettings.userId })
        .from(socialSettings)
        .where(
          and(inArray(socialSettings.userId, authorIds), isNotNull(socialSettings.suspendedAt)),
        )
    : [];
  const suspended = new Set(suspendedRows.map((s) => s.userId));
  const postById = new Map(postRows.map((p) => [p.id, p]));
  const commentById = new Map(commentRows.map((c) => [c.id, c]));

  const groups = new Map<string, AdminFeedReport>();
  for (const r of reports) {
    const reporter = {
      id: r.reporterId,
      firstName: r.reporterFirstName,
      lastName: r.reporterLastName,
    };
    const at = r.createdAt.toISOString();
    const key = r.postId ? `post:${r.postId}` : `comment:${r.commentId}`;
    const existing = groups.get(key);
    if (existing) {
      existing.reportCount += 1;
      if (!existing.reasons.includes(r.reason)) existing.reasons.push(r.reason);
      if (!existing.reporters.some((p) => p.id === reporter.id)) existing.reporters.push(reporter);
      existing.lastReportedAt = at;
      continue;
    }

    if (r.postId) {
      const p = postById.get(r.postId);
      if (!p) continue;
      groups.set(key, {
        targetType: 'post',
        targetId: p.id,
        postId: p.id,
        content: p.caption,
        images: (p.images ?? []).map(resolveImageUrl),
        author: {
          id: p.userId,
          firstName: p.firstName,
          lastName: p.lastName,
          avatarUrl: p.avatarUrl,
        },
        authorSuspended: suspended.has(p.userId),
        reportCount: 1,
        reasons: [r.reason],
        reporters: [reporter],
        firstReportedAt: at,
        lastReportedAt: at,
      });
    } else if (r.commentId) {
      const c = commentById.get(r.commentId);
      if (!c) continue;
      groups.set(key, {
        targetType: 'comment',
        targetId: c.id,
        postId: c.postId,
        content: c.content,
        images: [],
        author: {
          id: c.userId,
          firstName: c.firstName,
          lastName: c.lastName,
          avatarUrl: c.avatarUrl,
        },
        authorSuspended: suspended.has(c.userId),
        reportCount: 1,
        reasons: [r.reason],
        reporters: [reporter],
        firstReportedAt: at,
        lastReportedAt: at,
      });
    }
  }

  // Most-reported first, then oldest.
  return [...groups.values()].sort(
    (a, b) => b.reportCount - a.reportCount || a.firstReportedAt.localeCompare(b.firstReportedAt),
  );
}

/** Dismiss leaves the item up; remove hides it for everyone. Resolves every pending report on it. */
export async function resolveReports({
  targetType,
  targetId,
  action,
}: {
  targetType: 'post' | 'comment';
  targetId: number;
  action: 'dismiss' | 'remove';
}): Promise<ServiceResult<{ success: true }>> {
  const db = createDb();
  const now = new Date();
  const target =
    targetType === 'post' ? eq(feedReports.postId, targetId) : eq(feedReports.commentId, targetId);

  if (action === 'remove') {
    const updated =
      targetType === 'post'
        ? await db
            .tag('feed.admin.removePost')
            .update(posts)
            .set({ removedAt: now })
            .where(eq(posts.id, targetId))
            .returning()
        : await db
            .tag('feed.admin.removeComment')
            .update(postComments)
            .set({ removedAt: now })
            .where(eq(postComments.id, targetId))
            .returning();
    const [removed] = updated;
    if (!removed) return fail(404, 'Not found');
    if (targetType === 'comment' && 'postId' in removed) {
      await signalCommentsChanged(removed.postId);
    }
  }

  await db
    .tag('feed.admin.resolveReports')
    .update(feedReports)
    .set({ status: action === 'remove' ? 'removed' : 'dismissed', reviewedAt: now })
    .where(and(target, eq(feedReports.status, 'pending')));
  return ok({ success: true });
}

export async function setUserSuspended({
  userId,
  suspended,
}: {
  userId: string;
  suspended: boolean;
}): Promise<ServiceResult<{ suspended: boolean }>> {
  const db = createDb();
  const [target] = await db
    .tag('feed.admin.getUser')
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) return fail(404, 'User not found');

  const suspendedAt = suspended ? new Date() : null;
  await db
    .tag('feed.admin.setSuspended')
    .insert(socialSettings)
    .values({ userId, suspendedAt })
    .onConflictDoUpdate({
      target: socialSettings.userId,
      set: { suspendedAt, updatedAt: new Date() },
    });
  return ok({ suspended });
}
