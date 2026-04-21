import { defineOpenAPIRoute, OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import {
  addCommentHandler,
  addCommentRoute,
  deleteCommentHandler,
  deleteCommentRoute,
  listCommentsHandler,
  listCommentsRoute,
  toggleCommentLikeHandler,
  toggleCommentLikeRoute,
} from './comments';
import {
  createPostHandler,
  createPostRoute,
  deletePostHandler,
  deletePostRoute,
  getPostHandler,
  getPostRoute,
  listPostsHandler,
  listPostsRoute,
  togglePostLikeHandler,
  togglePostLikeRoute,
} from './posts';

const feedOpenApiRoutes = [
  defineOpenAPIRoute({ route: listPostsRoute, handler: listPostsHandler }),
  defineOpenAPIRoute({ route: createPostRoute, handler: createPostHandler }),
  defineOpenAPIRoute({ route: getPostRoute, handler: getPostHandler }),
  defineOpenAPIRoute({ route: deletePostRoute, handler: deletePostHandler }),
  defineOpenAPIRoute({ route: togglePostLikeRoute, handler: togglePostLikeHandler }),
  defineOpenAPIRoute({ route: listCommentsRoute, handler: listCommentsHandler }),
  defineOpenAPIRoute({ route: addCommentRoute, handler: addCommentHandler }),
  defineOpenAPIRoute({ route: deleteCommentRoute, handler: deleteCommentHandler }),
  defineOpenAPIRoute({ route: toggleCommentLikeRoute, handler: toggleCommentLikeHandler }),
] as const;

const feedRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>().openapiRoutes(
  feedOpenApiRoutes,
);
export { feedRoutes };
