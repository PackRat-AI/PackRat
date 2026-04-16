import { createDb } from '@packrat/api/db';
import { commentLikes, postComments, postLikes, posts, users } from '@packrat/api/db/schema';
import { authPlugin } from '@packrat/api/middleware/auth';
import { CreateCommentRequestSchema, CreatePostRequestSchema } from '@packrat/api/schemas/feed';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

function parseImages(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  return [];
}

export const feedRoutes = new Elysia({ prefix: '/feed' })
  .use(authPlugin)

  // List posts
  .get(
    '/',
    async ({ query, user }) => {
      const { page, limit } = query;
      const db = createDb();
      const offset = (page - 1) * limit;

      const [totalResult, items] = await Promise.all([
        db.select({ count: count() }).from(posts),
        db
          .select({
            id: posts.id,
            userId: posts.userId,
            caption: posts.caption,
            images: posts.images,
            createdAt: posts.createdAt,
            updatedAt: posts.updatedAt,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(posts)
          .leftJoin(users, eq(posts.userId, users.id))
          .orderBy(desc(posts.createdAt))
          .limit(limit)
          .offset(offset),
      ]);

      const total = totalResult[0]?.count ?? 0;

      if (items.length === 0) {
        return { items: [], page, limit, total, totalPages: Math.ceil(total / limit) };
      }

      const postIds = items.map((p) => p.id);

      const [likeCounts, myLikes, commentCounts] = await Promise.all([
        db
          .select({ postId: postLikes.postId, cnt: count() })
          .from(postLikes)
          .where(inArray(postLikes.postId, postIds))
          .groupBy(postLikes.postId),
        db
          .select({ postId: postLikes.postId })
          .from(postLikes)
          .where(and(inArray(postLikes.postId, postIds), eq(postLikes.userId, user.userId))),
        db
          .select({ postId: postComments.postId, cnt: count() })
          .from(postComments)
          .where(inArray(postComments.postId, postIds))
          .groupBy(postComments.postId),
      ]);

      const likeCountMap = Object.fromEntries(likeCounts.map((l) => [l.postId, l.cnt]));
      const myLikeSet = new Set(myLikes.map((l) => l.postId));
      const commentCountMap = Object.fromEntries(commentCounts.map((cc) => [cc.postId, cc.cnt]));

      const result = items.map((p) => ({
        id: p.id,
        userId: p.userId,
        caption: p.caption,
        images: parseImages(p.images),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        author: { id: p.userId, firstName: p.firstName, lastName: p.lastName },
        likeCount: likeCountMap[p.id] ?? 0,
        commentCount: commentCountMap[p.id] ?? 0,
        likedByMe: myLikeSet.has(p.id),
      }));

      return { items: result, page, limit, total, totalPages: Math.ceil(total / limit) };
    },
    {
      query: z.object({
        page: z.coerce.number().int().min(1).optional().default(1),
        limit: z.coerce.number().int().min(1).max(50).optional().default(20),
      }),
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'List social feed posts', security: [{ bearerAuth: [] }] },
    },
  )

  // Create post
  .post(
    '/',
    async ({ body, user }) => {
      const db = createDb();

      const [newPost] = await db
        .insert(posts)
        .values({
          userId: user.userId,
          caption: body.caption ?? null,
          images: body.images,
        })
        .returning();

      if (!newPost) return status(400, { error: 'Failed to create post' });

      const author = await db.query.users.findFirst({
        where: eq(users.id, user.userId),
        columns: { id: true, firstName: true, lastName: true },
      });

      return status(201, {
        id: newPost.id,
        userId: newPost.userId,
        caption: newPost.caption,
        images: parseImages(newPost.images),
        createdAt: newPost.createdAt.toISOString(),
        updatedAt: newPost.updatedAt.toISOString(),
        author: author
          ? { id: author.id, firstName: author.firstName, lastName: author.lastName }
          : undefined,
        likeCount: 0,
        commentCount: 0,
        likedByMe: false,
      });
    },
    {
      body: CreatePostRequestSchema,
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Create a post', security: [{ bearerAuth: [] }] },
    },
  )

  // Get single post
  .get(
    '/:postId',
    async ({ params, user }) => {
      const postId = Number(params.postId);
      const db = createDb();

      const post = await db.query.posts.findFirst({
        where: eq(posts.id, postId),
        with: {
          user: { columns: { id: true, firstName: true, lastName: true } },
          likes: true,
          comments: true,
        },
      });

      if (!post) return status(404, { error: 'Post not found' });

      return {
        id: post.id,
        userId: post.userId,
        caption: post.caption,
        images: parseImages(post.images),
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        author: post.user
          ? { id: post.user.id, firstName: post.user.firstName, lastName: post.user.lastName }
          : undefined,
        likeCount: post.likes.length,
        commentCount: post.comments.length,
        likedByMe: post.likes.some((l) => l.userId === user.userId),
      };
    },
    {
      params: z.object({ postId: z.coerce.number().int() }),
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Get a post by ID', security: [{ bearerAuth: [] }] },
    },
  )

  // Delete post
  .delete(
    '/:postId',
    async ({ params, user }) => {
      const postId = Number(params.postId);
      const db = createDb();

      const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
      if (!post) return status(404, { error: 'Post not found' });
      if (post.userId !== user.userId) return status(403, { error: 'Forbidden' });

      await db.delete(posts).where(eq(posts.id, postId));
      return { success: true };
    },
    {
      params: z.object({ postId: z.coerce.number().int() }),
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Delete a post', security: [{ bearerAuth: [] }] },
    },
  )

  // Toggle post like
  .post(
    '/:postId/like',
    async ({ params, user }) => {
      const postId = Number(params.postId);
      const db = createDb();

      const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
      if (!post) return status(404, { error: 'Post not found' });

      const existing = await db.query.postLikes.findFirst({
        where: and(eq(postLikes.postId, postId), eq(postLikes.userId, user.userId)),
      });

      if (existing) {
        await db
          .delete(postLikes)
          .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, user.userId)));
      } else {
        await db.insert(postLikes).values({ postId, userId: user.userId });
      }

      const [likeCountResult] = await db
        .select({ cnt: count() })
        .from(postLikes)
        .where(eq(postLikes.postId, postId));

      return { liked: !existing, likeCount: likeCountResult?.cnt ?? 0 };
    },
    {
      params: z.object({ postId: z.coerce.number().int() }),
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Toggle like on a post', security: [{ bearerAuth: [] }] },
    },
  )

  // List comments
  .get(
    '/:postId/comments',
    async ({ params, query, user }) => {
      const postId = Number(params.postId);
      const { page, limit } = query;
      const db = createDb();

      const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
      if (!post) return status(404, { error: 'Post not found' });

      const offset = (page - 1) * limit;

      const [totalResult, items] = await Promise.all([
        db.select({ count: count() }).from(postComments).where(eq(postComments.postId, postId)),
        db
          .select({
            id: postComments.id,
            postId: postComments.postId,
            userId: postComments.userId,
            content: postComments.content,
            parentCommentId: postComments.parentCommentId,
            createdAt: postComments.createdAt,
            updatedAt: postComments.updatedAt,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(postComments)
          .leftJoin(users, eq(postComments.userId, users.id))
          .where(eq(postComments.postId, postId))
          .orderBy(desc(postComments.createdAt))
          .limit(limit)
          .offset(offset),
      ]);

      const total = totalResult[0]?.count ?? 0;

      if (items.length === 0) {
        return { items: [], page, limit, total, totalPages: Math.ceil(total / limit) };
      }

      const commentIds = items.map((c) => c.id);

      const [likeCounts, myLikes] = await Promise.all([
        db
          .select({ commentId: commentLikes.commentId, cnt: count() })
          .from(commentLikes)
          .where(inArray(commentLikes.commentId, commentIds))
          .groupBy(commentLikes.commentId),
        db
          .select({ commentId: commentLikes.commentId })
          .from(commentLikes)
          .where(
            and(inArray(commentLikes.commentId, commentIds), eq(commentLikes.userId, user.userId)),
          ),
      ]);

      const likeCountMap = Object.fromEntries(likeCounts.map((l) => [l.commentId, l.cnt]));
      const myLikeSet = new Set(myLikes.map((l) => l.commentId));

      const result = items.map((item) => ({
        id: item.id,
        postId: item.postId,
        userId: item.userId,
        content: item.content,
        parentCommentId: item.parentCommentId,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        author: { id: item.userId, firstName: item.firstName, lastName: item.lastName },
        likeCount: likeCountMap[item.id] ?? 0,
        likedByMe: myLikeSet.has(item.id),
      }));

      return { items: result, page, limit, total, totalPages: Math.ceil(total / limit) };
    },
    {
      params: z.object({ postId: z.coerce.number().int() }),
      query: z.object({
        page: z.coerce.number().int().min(1).optional().default(1),
        limit: z.coerce.number().int().min(1).max(50).optional().default(20),
      }),
      isAuthenticated: true,
      detail: {
        tags: ['Feed'],
        summary: 'List comments on a post',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Add comment
  .post(
    '/:postId/comments',
    async ({ params, body, user }) => {
      const postId = Number(params.postId);
      const db = createDb();

      const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
      if (!post) return status(404, { error: 'Post not found' });

      const [newComment] = await db
        .insert(postComments)
        .values({
          postId,
          userId: user.userId,
          content: body.content,
          parentCommentId: body.parentCommentId ?? null,
        })
        .returning();

      if (!newComment) return status(400, { error: 'Failed to create comment' });

      const author = await db.query.users.findFirst({
        where: eq(users.id, user.userId),
        columns: { id: true, firstName: true, lastName: true },
      });

      return status(201, {
        id: newComment.id,
        postId: newComment.postId,
        userId: newComment.userId,
        content: newComment.content,
        parentCommentId: newComment.parentCommentId,
        createdAt: newComment.createdAt.toISOString(),
        updatedAt: newComment.updatedAt.toISOString(),
        author: author
          ? { id: author.id, firstName: author.firstName, lastName: author.lastName }
          : undefined,
        likeCount: 0,
        likedByMe: false,
      });
    },
    {
      params: z.object({ postId: z.coerce.number().int() }),
      body: CreateCommentRequestSchema,
      isAuthenticated: true,
      detail: {
        tags: ['Feed'],
        summary: 'Add a comment to a post',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Delete comment
  .delete(
    '/:postId/comments/:commentId',
    async ({ params, user }) => {
      const postId = Number(params.postId);
      const commentId = Number(params.commentId);
      const db = createDb();

      const comment = await db.query.postComments.findFirst({
        where: and(eq(postComments.id, commentId), eq(postComments.postId, postId)),
      });

      if (!comment) return status(404, { error: 'Comment not found' });
      if (comment.userId !== user.userId) return status(403, { error: 'Forbidden' });

      await db.delete(postComments).where(eq(postComments.id, commentId));
      return { success: true };
    },
    {
      params: z.object({
        postId: z.coerce.number().int(),
        commentId: z.coerce.number().int(),
      }),
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Delete a comment', security: [{ bearerAuth: [] }] },
    },
  )

  // Toggle comment like
  .post(
    '/:postId/comments/:commentId/like',
    async ({ params, user }) => {
      const postId = Number(params.postId);
      const commentId = Number(params.commentId);
      const db = createDb();

      const comment = await db.query.postComments.findFirst({
        where: and(eq(postComments.id, commentId), eq(postComments.postId, postId)),
      });

      if (!comment) return status(404, { error: 'Comment not found' });

      const existing = await db.query.commentLikes.findFirst({
        where: and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, user.userId)),
      });

      if (existing) {
        await db
          .delete(commentLikes)
          .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, user.userId)));
      } else {
        await db.insert(commentLikes).values({ commentId, userId: user.userId });
      }

      const [likeCountResult] = await db
        .select({ cnt: count() })
        .from(commentLikes)
        .where(eq(commentLikes.commentId, commentId));

      return { liked: !existing, likeCount: likeCountResult?.cnt ?? 0 };
    },
    {
      params: z.object({
        postId: z.coerce.number().int(),
        commentId: z.coerce.number().int(),
      }),
      isAuthenticated: true,
      detail: {
        tags: ['Feed'],
        summary: 'Toggle like on a comment',
        security: [{ bearerAuth: [] }],
      },
    },
  );
