import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { postComments, postLikes, posts, users } from '@packrat/api/db/schema';
import { ErrorResponseSchema } from '@packrat/api/schemas/catalog';
import {
  CreatePostRequestSchema,
  FeedResponseSchema,
  LikeToggleResponseSchema,
  PostSchema,
} from '@packrat/api/schemas/feed';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { and, count, desc, eq, inArray } from 'drizzle-orm';

function parseImages(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  return [];
}

const postsRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>();

// GET /feed - list paginated posts
const listPostsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Feed'],
  summary: 'List social feed posts',
  description: 'Get a paginated list of posts for the social feed',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      page: z.coerce.number().int().min(1).optional().default(1),
      limit: z.coerce.number().int().min(1).max(50).optional().default(20),
    }),
  },
  responses: {
    200: {
      description: 'Feed posts retrieved successfully',
      content: { 'application/json': { schema: FeedResponseSchema } },
    },
  },
});

postsRoutes.openapi(listPostsRoute, async (c) => {
  const auth = c.get('user');
  const { page, limit } = c.req.valid('query');
  const db = createDb(c);
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
    return c.json({ items: [], page, limit, total, totalPages: Math.ceil(total / limit) }, 200);
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
      .where(and(inArray(postLikes.postId, postIds), eq(postLikes.userId, auth.userId))),
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

  return c.json({ items: result, page, limit, total, totalPages: Math.ceil(total / limit) }, 200);
});

// POST /feed - create a post
const createPostRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Feed'],
  summary: 'Create a post',
  description: 'Create a new social feed post with photos',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: CreatePostRequestSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'Post created successfully',
      content: { 'application/json': { schema: PostSchema } },
    },
    400: {
      description: 'Bad request',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

postsRoutes.openapi(createPostRoute, async (c) => {
  const auth = c.get('user');
  const body = c.req.valid('json');
  const db = createDb(c);

  const [newPost] = await db
    .insert(posts)
    .values({
      userId: auth.userId,
      caption: body.caption ?? null,
      images: body.images,
    })
    .returning();

  if (!newPost) {
    return c.json({ error: 'Failed to create post' }, 400);
  }

  const author = await db.query.users.findFirst({
    where: eq(users.id, auth.userId),
    columns: { id: true, firstName: true, lastName: true },
  });

  return c.json(
    {
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
    },
    201,
  );
});

// GET /feed/:postId - get single post
const getPostRoute = createRoute({
  method: 'get',
  path: '/:postId',
  tags: ['Feed'],
  summary: 'Get a post by ID',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ postId: z.coerce.number().int() }),
  },
  responses: {
    200: {
      description: 'Post retrieved successfully',
      content: { 'application/json': { schema: PostSchema } },
    },
    404: {
      description: 'Post not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

postsRoutes.openapi(getPostRoute, async (c) => {
  const auth = c.get('user');
  const { postId } = c.req.valid('param');
  const db = createDb(c);

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
    with: {
      user: { columns: { id: true, firstName: true, lastName: true } },
      likes: true,
      comments: true,
    },
  });

  if (!post) {
    return c.json({ error: 'Post not found' }, 404);
  }

  return c.json(
    {
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
      likedByMe: post.likes.some((l) => l.userId === auth.userId),
    },
    200,
  );
});

// DELETE /feed/:postId - delete post
const deletePostRoute = createRoute({
  method: 'delete',
  path: '/:postId',
  tags: ['Feed'],
  summary: 'Delete a post',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ postId: z.coerce.number().int() }),
  },
  responses: {
    200: {
      description: 'Post deleted successfully',
      content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Post not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

postsRoutes.openapi(deletePostRoute, async (c) => {
  const auth = c.get('user');
  const { postId } = c.req.valid('param');
  const db = createDb(c);

  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });

  if (!post) {
    return c.json({ error: 'Post not found' }, 404);
  }

  if (post.userId !== auth.userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  await db.delete(posts).where(eq(posts.id, postId));

  return c.json({ success: true }, 200);
});

// POST /feed/:postId/like - toggle like on post
const togglePostLikeRoute = createRoute({
  method: 'post',
  path: '/:postId/like',
  tags: ['Feed'],
  summary: 'Toggle like on a post',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ postId: z.coerce.number().int() }),
  },
  responses: {
    200: {
      description: 'Like toggled',
      content: { 'application/json': { schema: LikeToggleResponseSchema } },
    },
    404: {
      description: 'Post not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

postsRoutes.openapi(togglePostLikeRoute, async (c) => {
  const auth = c.get('user');
  const { postId } = c.req.valid('param');
  const db = createDb(c);

  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
  if (!post) {
    return c.json({ error: 'Post not found' }, 404);
  }

  const existing = await db.query.postLikes.findFirst({
    where: and(eq(postLikes.postId, postId), eq(postLikes.userId, auth.userId)),
  });

  if (existing) {
    await db
      .delete(postLikes)
      .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, auth.userId)));
  } else {
    await db.insert(postLikes).values({ postId, userId: auth.userId });
  }

  const [likeCountResult] = await db
    .select({ cnt: count() })
    .from(postLikes)
    .where(eq(postLikes.postId, postId));

  return c.json({ liked: !existing, likeCount: likeCountResult?.cnt ?? 0 }, 200);
});

export { postsRoutes };
