import { z } from 'zod';

export const PostAuthorSchema = z.object({
  id: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  avatarUrl: z.string().nullable().optional(),
});

export const PostSchema = z.object({
  id: z.number().int(),
  userId: z.string(),
  caption: z.string().nullable(),
  images: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  author: PostAuthorSchema.optional(),
  likeCount: z.number().int(),
  commentCount: z.number().int(),
  likedByMe: z.boolean(),
  publicId: z.string().optional(),
  captionEditedAt: z.string().datetime().nullable().optional(),
  savedByMe: z.boolean().optional(),
  tags: z.array(PostAuthorSchema).optional(),
});

export const FeedPageQuerySchema = z.object({
  // Defaults applied in handler so Treaty types these as truly optional.
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export const FeedPostParamsSchema = z.object({ postId: z.coerce.number().int() });
export const FeedCommentParamsSchema = z.object({
  postId: z.coerce.number().int(),
  commentId: z.coerce.number().int(),
});

export const MAX_POST_IMAGES = 10;
export const MAX_CAPTION_LENGTH = 500;

const TaggedUserIdsSchema = z.array(z.string()).max(20).optional();

export const CreatePostRequestSchema = z
  .object({
    caption: z.string().max(MAX_CAPTION_LENGTH).optional(),
    images: z.array(z.string().min(1)).max(MAX_POST_IMAGES).default([]),
    taggedUserIds: TaggedUserIdsSchema,
  })
  .refine((b) => b.images.length > 0 || (b.caption ?? '').trim().length > 0, {
    message: 'A post needs at least one photo or a caption',
  });

export const UpdatePostRequestSchema = z.object({
  caption: z.string().max(MAX_CAPTION_LENGTH).nullable(),
  taggedUserIds: TaggedUserIdsSchema,
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
  userId: z.string(),
  content: z.string(),
  parentCommentId: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  author: PostAuthorSchema.optional(),
  likeCount: z.number().int(),
  likedByMe: z.boolean(),
  editedAt: z.string().datetime().nullable().optional(),
});

export const CreateCommentRequestSchema = z.object({
  content: z.string().min(1).max(1000),
  parentCommentId: z.number().int().optional(),
  taggedUserIds: TaggedUserIdsSchema,
});

export const UpdateCommentRequestSchema = z.object({
  content: z.string().min(1).max(1000),
  taggedUserIds: TaggedUserIdsSchema,
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

export const SaveToggleResponseSchema = z.object({ saved: z.boolean() });

export const FeedReportReasonSchema = z.enum(['spam', 'harassment', 'inappropriate']);

export const CreateFeedReportRequestSchema = z
  .object({
    postId: z.number().int().optional(),
    commentId: z.number().int().optional(),
    reason: FeedReportReasonSchema,
  })
  .refine((b) => (b.postId === undefined) !== (b.commentId === undefined), {
    message: 'Report exactly one post or one comment',
  });

export const MentionSuggestionsResponseSchema = z.object({
  items: z.array(PostAuthorSchema),
});

export const BlockedUsersResponseSchema = z.object({
  items: z.array(PostAuthorSchema),
});

export const SocialSettingsSchema = z.object({
  allowTagging: z.boolean(),
  notifyTags: z.boolean(),
  notifyComments: z.boolean(),
  notifyReplies: z.boolean(),
});

export const UpdateSocialSettingsRequestSchema = SocialSettingsSchema.partial();

export const PublicPostSchema = z.object({
  publicId: z.string(),
  caption: z.string().nullable(),
  images: z.array(z.string()),
  createdAt: z.string().datetime(),
  authorName: z.string(),
  authorAvatarUrl: z.string().nullable(),
});

// Admin moderation
export const AdminFeedReportSchema = z.object({
  targetType: z.enum(['post', 'comment']),
  targetId: z.number().int(),
  postId: z.number().int(),
  content: z.string().nullable(),
  images: z.array(z.string()),
  author: PostAuthorSchema,
  authorSuspended: z.boolean(),
  reportCount: z.number().int(),
  reasons: z.array(FeedReportReasonSchema),
  reporters: z.array(PostAuthorSchema),
  firstReportedAt: z.string().datetime(),
  lastReportedAt: z.string().datetime(),
});

export const AdminFeedReportsResponseSchema = z.object({
  items: z.array(AdminFeedReportSchema),
});

export const AdminReportTargetParamsSchema = z.object({
  targetType: z.enum(['post', 'comment']),
  targetId: z.coerce.number().int(),
});

export type FeedPost = z.infer<typeof PostSchema>;
export type FeedComment = z.infer<typeof CommentSchema>;
export type FeedReportReason = z.infer<typeof FeedReportReasonSchema>;
export type SocialSettingsValues = z.infer<typeof SocialSettingsSchema>;
export type PublicPost = z.infer<typeof PublicPostSchema>;
export type AdminFeedReport = z.infer<typeof AdminFeedReportSchema>;
