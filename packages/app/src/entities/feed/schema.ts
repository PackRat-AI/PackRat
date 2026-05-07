import { z } from 'zod';
import { dateField } from '../../shared/lib/date';

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
  createdAt: dateField,
  updatedAt: dateField,
  author: PostAuthorSchema.optional(),
  likeCount: z.number().int(),
  commentCount: z.number().int(),
  likedByMe: z.boolean(),
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
  createdAt: dateField,
  updatedAt: dateField,
  author: PostAuthorSchema.optional(),
  likeCount: z.number().int(),
  likedByMe: z.boolean(),
});
