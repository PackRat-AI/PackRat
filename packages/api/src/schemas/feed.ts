import { z } from '@hono/zod-openapi';

export const PostAuthorSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    firstName: z.string().nullable().openapi({ example: 'Jane' }),
    lastName: z.string().nullable().openapi({ example: 'Doe' }),
  })
  .openapi('PostAuthor');

export const PostSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    userId: z.number().int().openapi({ example: 1 }),
    caption: z.string().nullable().openapi({ example: 'Amazing hike today!' }),
    images: z.array(z.string()).openapi({ example: ['1-photo.jpg'] }),
    createdAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
    author: PostAuthorSchema.optional(),
    likeCount: z.number().int().openapi({ example: 5 }),
    commentCount: z.number().int().openapi({ example: 3 }),
    likedByMe: z.boolean().openapi({ example: false }),
  })
  .openapi('Post');

export const CreatePostRequestSchema = z
  .object({
    caption: z.string().max(2000).optional().openapi({ example: 'Amazing hike today!' }),
    images: z
      .array(z.string())
      .min(1)
      .max(10)
      .openapi({ example: ['1-photo.jpg'] }),
  })
  .openapi('CreatePostRequest');

export const FeedResponseSchema = z
  .object({
    items: z.array(PostSchema),
    page: z.number().int().openapi({ example: 1 }),
    limit: z.number().int().openapi({ example: 20 }),
    total: z.number().int().openapi({ example: 100 }),
    totalPages: z.number().int().openapi({ example: 5 }),
  })
  .openapi('FeedResponse');

export const CommentSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    postId: z.number().int().openapi({ example: 1 }),
    userId: z.number().int().openapi({ example: 1 }),
    content: z.string().openapi({ example: 'Looks amazing!' }),
    parentCommentId: z.number().int().nullable().openapi({ example: null }),
    createdAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2024-01-01T00:00:00Z' }),
    author: PostAuthorSchema.optional(),
    likeCount: z.number().int().openapi({ example: 2 }),
    likedByMe: z.boolean().openapi({ example: false }),
  })
  .openapi('Comment');

export const CreateCommentRequestSchema = z
  .object({
    content: z.string().min(1).max(1000).openapi({ example: 'Looks amazing!' }),
    parentCommentId: z.number().int().nullable().optional().openapi({ example: null }),
  })
  .openapi('CreateCommentRequest');

export const CommentsResponseSchema = z
  .object({
    items: z.array(CommentSchema),
    page: z.number().int().openapi({ example: 1 }),
    limit: z.number().int().openapi({ example: 20 }),
    total: z.number().int().openapi({ example: 10 }),
    totalPages: z.number().int().openapi({ example: 1 }),
  })
  .openapi('CommentsResponse');

export const LikeToggleResponseSchema = z
  .object({
    liked: z.boolean().openapi({ example: true }),
    likeCount: z.number().int().openapi({ example: 6 }),
  })
  .openapi('LikeToggleResponse');
