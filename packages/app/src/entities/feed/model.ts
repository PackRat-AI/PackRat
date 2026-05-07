import type { z } from 'zod';
import type { CommentSchema, FeedResponseSchema, PostSchema } from './schema';

export type Post = z.infer<typeof PostSchema>;
export type FeedResponse = z.infer<typeof FeedResponseSchema>;
export type Comment = z.infer<typeof CommentSchema>;
