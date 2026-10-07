import { authPlugin } from '@packrat/api/middleware/auth';
import * as feed from '@packrat/api/services/feedService';
import {
  BlockedUsersResponseSchema,
  CreateCommentRequestSchema,
  CreateFeedReportRequestSchema,
  CreatePostRequestSchema,
  FeedResponseSchema,
  MentionSuggestionsResponseSchema,
  PublicPostSchema,
  SocialSettingsSchema,
  UpdateCommentRequestSchema,
  UpdatePostRequestSchema,
  UpdateSocialSettingsRequestSchema,
} from '@packrat/schemas/feed';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

const PageQuerySchema = z.object({
  // Defaults applied in handler so Treaty types these as truly optional.
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
const PostParamsSchema = z.object({ postId: z.coerce.number().int() });
const CommentParamsSchema = z.object({
  postId: z.coerce.number().int(),
  commentId: z.coerce.number().int(),
});

function unwrap<T>(result: feed.ServiceResult<T>) {
  return result.ok ? result.value : status(result.status, { error: result.error });
}

const security = [{ bearerAuth: [] }];

export const feedRoutes = new Elysia({ prefix: '/feed' })
  .model({
    'feed.CreateCommentRequest': CreateCommentRequestSchema,
    'feed.CreatePostRequest': CreatePostRequestSchema,
    'feed.FeedResponse': FeedResponseSchema,
  })
  .use(authPlugin)

  // public-route: the shared-post web page; returns only live posts by non-suspended authors
  .get(
    '/public/:publicId',
    async ({ params }) => {
      const result = await feed.getPublicPost({ publicId: params.publicId });
      return result.ok ? result.value : status(404, { error: result.error });
    },
    {
      params: z.object({ publicId: z.string().uuid() }),
      response: { 200: PublicPostSchema, 404: z.object({ error: z.string() }) },
      detail: { tags: ['Feed'], summary: 'Get a shared post for its public page' },
    },
  )

  // List posts
  .get(
    '/',
    async ({ query, user }) =>
      FeedResponseSchema.parse(
        await feed.listPosts({
          viewerId: user.userId,
          page: query.page ?? 1,
          limit: query.limit ?? 20,
          scope: 'all',
        }),
      ),
    {
      query: PageQuerySchema,
      response: { 200: 'feed.FeedResponse' },
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'List social feed posts', security },
    },
  )

  .get(
    '/saved',
    async ({ query, user }) =>
      FeedResponseSchema.parse(
        await feed.listPosts({
          viewerId: user.userId,
          page: query.page ?? 1,
          limit: query.limit ?? 20,
          scope: 'saved',
        }),
      ),
    {
      query: PageQuerySchema,
      response: { 200: 'feed.FeedResponse' },
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'List posts I saved', security },
    },
  )

  .get(
    '/tagged',
    async ({ query, user }) =>
      FeedResponseSchema.parse(
        await feed.listPosts({
          viewerId: user.userId,
          page: query.page ?? 1,
          limit: query.limit ?? 20,
          scope: 'tagged',
        }),
      ),
    {
      query: PageQuerySchema,
      response: { 200: 'feed.FeedResponse' },
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'List posts I am tagged in', security },
    },
  )

  // Open a shared link in the app
  .get(
    '/shared/:publicId',
    async ({ params, user }) =>
      unwrap(await feed.getPostByPublicId({ viewerId: user.userId, publicId: params.publicId })),
    {
      params: z.object({ publicId: z.string().uuid() }),
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Get a post by its share-link id', security },
    },
  )

  // Mention suggestions for @ autocomplete
  .get(
    '/mentions',
    async ({ query, user }) =>
      MentionSuggestionsResponseSchema.parse({
        items: await feed.mentionSuggestions({ userId: user.userId, query: query.q }),
      }),
    {
      query: z.object({ q: z.string().max(100) }),
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Suggest people to mention', security },
    },
  )

  // Blocks
  .get(
    '/blocks',
    async ({ user }) =>
      BlockedUsersResponseSchema.parse({ items: await feed.listBlocked({ userId: user.userId }) }),
    {
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'List people I blocked', security },
    },
  )
  .post(
    '/blocks',
    async ({ body, user }) =>
      unwrap(await feed.blockUser({ userId: user.userId, blockedId: body.userId })),
    {
      body: z.object({ userId: z.string().min(1) }),
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Block a person', security },
    },
  )
  .delete(
    '/blocks/:userId',
    async ({ params, user }) =>
      unwrap(await feed.unblockUser({ userId: user.userId, blockedId: params.userId })),
    {
      params: z.object({ userId: z.string().min(1) }),
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Unblock a person', security },
    },
  )

  // Settings
  .get('/settings', async ({ user }) => feed.getSettings({ userId: user.userId }), {
    response: { 200: SocialSettingsSchema },
    isAuthenticated: true,
    detail: { tags: ['Feed'], summary: 'Get my social settings', security },
  })
  .patch(
    '/settings',
    async ({ body, user }) => feed.updateSettings({ userId: user.userId, changes: body }),
    {
      body: UpdateSocialSettingsRequestSchema,
      response: { 200: SocialSettingsSchema },
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Update my social settings', security },
    },
  )

  // Reports
  .post(
    '/reports',
    async ({ body, user }) =>
      unwrap(
        await feed.reportContent({
          userId: user.userId,
          postId: body.postId,
          commentId: body.commentId,
          reason: body.reason,
        }),
      ),
    {
      body: CreateFeedReportRequestSchema,
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Report a post or comment', security },
    },
  )

  // Create post
  .post(
    '/',
    async ({ body, user }) => {
      const result = await feed.createPost({
        userId: user.userId,
        caption: body.caption,
        images: body.images,
        taggedUserIds: body.taggedUserIds,
      });
      return result.ok ? status(201, result.value) : status(result.status, { error: result.error });
    },
    {
      body: 'feed.CreatePostRequest',
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Create a post', security },
    },
  )

  // Get single post
  .get(
    '/:postId',
    async ({ params, user }) =>
      unwrap(await feed.getPost({ viewerId: user.userId, postId: params.postId })),
    {
      params: PostParamsSchema,
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Get a post by ID', security },
    },
  )

  // Edit caption (and add tags)
  .patch(
    '/:postId',
    async ({ params, body, user }) =>
      unwrap(
        await feed.updatePost({
          userId: user.userId,
          postId: params.postId,
          caption: body.caption,
          taggedUserIds: body.taggedUserIds,
        }),
      ),
    {
      params: PostParamsSchema,
      body: UpdatePostRequestSchema,
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Edit a post caption', security },
    },
  )

  // Delete post
  .delete(
    '/:postId',
    async ({ params, user }) =>
      unwrap(await feed.deletePost({ userId: user.userId, postId: params.postId })),
    {
      params: PostParamsSchema,
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Delete a post', security },
    },
  )

  // Toggle post like
  .post(
    '/:postId/like',
    async ({ params, user }) =>
      unwrap(await feed.togglePostLike({ userId: user.userId, postId: params.postId })),
    {
      params: PostParamsSchema,
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Toggle like on a post', security },
    },
  )

  // Save / unsave
  .post(
    '/:postId/save',
    async ({ params, user }) =>
      unwrap(await feed.setPostSaved({ userId: user.userId, postId: params.postId, saved: true })),
    {
      params: PostParamsSchema,
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Save a post', security },
    },
  )
  .delete(
    '/:postId/save',
    async ({ params, user }) =>
      unwrap(await feed.setPostSaved({ userId: user.userId, postId: params.postId, saved: false })),
    {
      params: PostParamsSchema,
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Unsave a post', security },
    },
  )

  // Remove my own tag from a post
  .delete(
    '/:postId/tags/me',
    async ({ params, user }) =>
      unwrap(await feed.removeOwnTag({ userId: user.userId, postId: params.postId })),
    {
      params: PostParamsSchema,
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Remove my tag from a post', security },
    },
  )

  // List comments
  .get(
    '/:postId/comments',
    async ({ params, query, user }) =>
      unwrap(
        await feed.listComments({
          viewerId: user.userId,
          postId: params.postId,
          page: query.page ?? 1,
          limit: query.limit ?? 50,
        }),
      ),
    {
      params: PostParamsSchema,
      query: PageQuerySchema,
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'List comments on a post', security },
    },
  )

  // Add comment
  .post(
    '/:postId/comments',
    async ({ params, body, user }) => {
      const result = await feed.createComment({
        userId: user.userId,
        postId: params.postId,
        content: body.content,
        parentCommentId: body.parentCommentId,
        taggedUserIds: body.taggedUserIds,
      });
      return result.ok ? status(201, result.value) : status(result.status, { error: result.error });
    },
    {
      params: PostParamsSchema,
      body: 'feed.CreateCommentRequest',
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Add a comment to a post', security },
    },
  )

  // Edit comment
  .patch(
    '/:postId/comments/:commentId',
    async ({ params, body, user }) =>
      unwrap(
        await feed.updateComment({
          userId: user.userId,
          postId: params.postId,
          commentId: params.commentId,
          content: body.content,
          taggedUserIds: body.taggedUserIds,
        }),
      ),
    {
      params: CommentParamsSchema,
      body: UpdateCommentRequestSchema,
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Edit a comment', security },
    },
  )

  // Delete comment (commenter or post author)
  .delete(
    '/:postId/comments/:commentId',
    async ({ params, user }) =>
      unwrap(
        await feed.deleteComment({
          userId: user.userId,
          postId: params.postId,
          commentId: params.commentId,
        }),
      ),
    {
      params: CommentParamsSchema,
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Delete a comment', security },
    },
  )

  // Toggle comment like
  .post(
    '/:postId/comments/:commentId/like',
    async ({ params, user }) =>
      unwrap(
        await feed.toggleCommentLike({
          userId: user.userId,
          postId: params.postId,
          commentId: params.commentId,
        }),
      ),
    {
      params: CommentParamsSchema,
      isAuthenticated: true,
      detail: { tags: ['Feed'], summary: 'Toggle like on a comment', security },
    },
  );
