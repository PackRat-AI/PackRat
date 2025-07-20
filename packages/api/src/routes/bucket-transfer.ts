import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { queueBucketTransfer } from '@packrat/api/services/queue';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Env } from '../types/env';

const bucketTransferSchema = z.object({
  sourceAccountId: z.string().min(1, 'Source account ID is required').optional(),
  sourceAccessKeyId: z.string().min(1, 'Source access key ID is required').optional(),
  sourceSecretAccessKey: z.string().min(1, 'Source secret access key is required').optional(),
  destinationAccountId: z.string().min(1, 'Destination account ID is required').optional(),
  destinationAccessKeyId: z.string().min(1, 'Destination access key ID is required').optional(),
  destinationSecretAccessKey: z
    .string()
    .min(1, 'Destination secret access key is required')
    .optional(),
  bucketNames: z
    .array(z.string())
    .optional()
    .describe(
      'Specific bucket names to transfer. If not provided, all buckets will be transferred.',
    ),
});

export const routeDefinition = createRoute({
  method: 'post',
  path: '/bucket-transfer',
  request: {
    body: {
      content: {
        'application/json': {
          schema: bucketTransferSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Bucket transfer job queued successfully',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
            jobId: z.string(),
            queued: z.boolean(),
            bucketsToTransfer: z.union([z.array(z.string()), z.string()]),
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
  tags: ['Bucket Transfer'],
  summary: 'Queue bucket transfer job between R2 accounts',
  description:
    'Initiates serverless transfer of buckets from source to destination R2 account, including configurations and folder structure',
});

export const handler: RouteHandler<typeof routeDefinition> = async (c) => {
  const {
    sourceAccountId,
    sourceAccessKeyId,
    sourceSecretAccessKey,
    destinationAccountId,
    destinationAccessKeyId,
    destinationSecretAccessKey,
    bucketNames,
  } = c.req.valid('json');

  const userId = c.get('jwtPayload')?.userId;

  if (!c.env.BUCKET_TRANSFER_QUEUE) {
    throw new HTTPException(400, {
      message: 'BUCKET_TRANSFER_QUEUE is not configured',
    });
  }

  const jobId = await queueBucketTransfer({
    queue: c.env.BUCKET_TRANSFER_QUEUE,
    sourceAccountId,
    sourceAccessKeyId,
    sourceSecretAccessKey,
    destinationAccountId,
    destinationAccessKeyId,
    destinationSecretAccessKey,
    bucketNames,
    userId,
  });

  return c.json({
    message: 'Bucket transfer job queued successfully',
    jobId,
    queued: true,
    bucketsToTransfer: bucketNames || 'all buckets',
  });
};

export const bucketTransferRoute = new OpenAPIHono<{ Bindings: Env }>();

bucketTransferRoute.openapi(routeDefinition, handler);