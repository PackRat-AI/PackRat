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
  filename: z.string().min(1, 'Filename is required'),
  chunks: z.array(z.string()).min(1, 'At least one object key is required'),
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
  summary: 'Queue catalog ETL job from R2 CSV chunk files',
  description: 'Initiates serverless ETL processing of catalog data from multiple R2 chunk files',
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  const { filename, chunks, source, scraperRevision } = c.req.valid('json');
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
    filename,
    scraperRevision,
    startedAt: new Date(),
  });

  // Queue each chunk file as part of the same job
  await queueCatalogETL({
    queue: getEnv(c).ETL_QUEUE,
    objectKeys: chunks,
    jobId,
  });

  console.log(`🚀 Initiated ETL job ${jobId} with ${chunks.length} files for source ${source}`);

  return c.json(
    {
      message: 'Catalog ETL job queued successfully',
      jobId,
      queued: true,
    },
    200,
  );
};
