import { createRoute } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { etlJobs } from '@packrat/api/db/schema';
import { authMiddleware } from '@packrat/api/middleware';
import { queueCatalogETL } from '@packrat/api/services/etl/queue';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { getEnv } from '@packrat/api/utils/env-validation';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const catalogETLSchema = z.object({
  objectKey: z.string().min(1, 'R2 object key is required'),
  source: z.string().min(1, 'Source name is required'),
  scraperRevision: z.string().min(1, 'Scraper revision ID is required'),
});

export const routeDefinition = createRoute({
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
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  const { objectKey, source, scraperRevision } = c.req.valid('json');
  const userId = c.get('jwtPayload')?.userId;
  const db = createDb(c);

  if (!getEnv(c).ETL_QUEUE) {
    throw new HTTPException(400, {
      message: 'ETL_QUEUE is not configured',
    });
  }

  const jobId = crypto.randomUUID();

  await db.insert(etlJobs).values({
    id: jobId,
    status: 'running',
    source,
    objectKey,
    scraperRevision,
    startedAt: new Date(),
  });

  await queueCatalogETL({
    queue: getEnv(c).ETL_QUEUE,
    objectKey,
    userId,
    source,
    scraperRevision,
    jobId,
  });

  return c.json(
    {
      message: 'Catalog ETL job queued successfully',
      jobId,
      queued: true,
    },
    200,
  );
};
