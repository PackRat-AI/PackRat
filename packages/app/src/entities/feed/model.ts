import type { CommentSchema, FeedResponseSchema, PostSchema } from '@packrat/api/schemas/feed';
import type { z } from 'zod';

export type Post = z.infer<typeof PostSchema>;
export type FeedResponse = z.infer<typeof FeedResponseSchema>;
export type Comment = z.infer<typeof CommentSchema>;
