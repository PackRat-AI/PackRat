import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '@packrat/api/middleware';
import { queueCatalogETL } from '@packrat/api/services/queue';
import { Env } from '@packrat/api/types/env';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const catalogETLSchema = z.object({
  objectKey: z.string().min(1, 'R2 object key is required'),
  filename: z.string().min(1, 'Filename is required'),
});

const catalogETLQueueRoutes = new OpenAPIHono<{ Bindings: Env }>();

catalogETLQueueRoutes.openapi(
  {
    method: 'post',
    path: '/etl',
    middleware: [authMiddleware],
    request: {
      body: {
        content: {
          'application/json': {
            schema: catalogETLSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'ETL job queued successfully',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
              jobId: z.string(),
              queued: z.boolean(),
            }),
          },
        },
      },
      400: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
            }),
          },
        },
      },
    },
    tags: ['Catalog'],
    summary: 'Queue catalog ETL job from R2 CSV file',
    description: 'Initiates serverless ETL processing of catalog data from R2 object storage',
  },
  async (c) => {
    const { objectKey, filename } = c.req.valid('json');
    const userId = c.get('jwtPayload')?.userId;

    if (!c.env.ETL_QUEUE) {
      throw new HTTPException(400, {
        message: 'ETL_QUEUE is not configured',
      });
    }

    const jobId = await queueCatalogETL({
      queue: c.env.ETL_QUEUE,
      objectKey,
      userId,
      filename,
    });

    return c.json({
      message: 'Catalog ETL job queued successfully',
      jobId,
      queued: true,
    });
  },
);

export { catalogETLQueueRoutes };
