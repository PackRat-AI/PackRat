import { z } from 'zod';

export const PostAuthorSchema = z.object({
  id: z.number().int(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
});

export const PostSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  caption: z.string().nullable(),
  images: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  author: PostAuthorSchema.optional(),
  likeCount: z.number().int(),
  commentCount: z.number().int(),
  likedByMe: z.boolean(),
});

export const CreatePostRequestSchema = z.object({
  caption: z.string().max(2000).optional(),
  images: z.array(z.string()).min(1).max(10),
});

export const FeedResponseSchema = z.object({
  items: z.array(PostSchema),
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export const CommentSchema = z.object({
  id: z.number().int(),
  postId: z.number().int(),
  userId: z.number().int(),
  content: z.string(),
  parentCommentId: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  author: PostAuthorSchema.optional(),
  likeCount: z.number().int(),
  likedByMe: z.boolean(),
});

export const CreateCommentRequestSchema = z.object({
  content: z.string().min(1).max(1000),
  parentCommentId: z.number().int().optional(),
});

export const CommentsResponseSchema = z.object({
  items: z.array(CommentSchema),
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export const LikeToggleResponseSchema = z.object({
  liked: z.boolean(),
  likeCount: z.number().int(),
});
