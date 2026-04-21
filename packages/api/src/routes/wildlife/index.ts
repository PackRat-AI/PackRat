import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createRoute, defineOpenAPIRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { ErrorResponseSchema } from '@packrat/api/schemas/upload';
import { WildlifeIdentificationService } from '@packrat/api/services/wildlifeIdentificationService';
import type { Env } from '@packrat/api/types/env';
import type { RouteHandler } from '@packrat/api/types/routeHandler';
import type { Variables } from '@packrat/api/types/variables';
import { getEnv } from '@packrat/api/utils/env-validation';
import { getPresignedUrl } from '@packrat/api/utils/getPresignedUrl';

const IdentifyRequestSchema = z
  .object({
    image: z
      .string()
      .openapi({ example: 'userId-filename.jpg', description: 'Uploaded image key in R2' }),
  })
  .openapi('IdentifyRequest');

const SpeciesResultSchema = z
  .object({
    id: z.string(),
    commonName: z.string(),
    scientificName: z.string(),
    category: z.string(),
    description: z.string(),
    habitat: z.array(z.string()),
    regions: z.array(z.string()),
    dangerLevel: z.enum(['safe', 'caution', 'dangerous']),
    characteristics: z.array(z.string()),
    conservationStatus: z.string().optional(),
    interestingFacts: z.array(z.string()).optional(),
  })
  .openapi('SpeciesResult');

const IdentificationResultSchema = z
  .object({
    species: SpeciesResultSchema,
    confidence: z.number().min(0).max(1),
    source: z.literal('online'),
  })
  .openapi('IdentificationResult');

const IdentifyResponseSchema = z
  .object({
    results: z.array(IdentificationResultSchema),
  })
  .openapi('IdentifyResponse');

export const identifyRoute = createRoute({
  method: 'post',
  path: '/identify',
  tags: ['Wildlife'],
  summary: 'Identify plant or animal species from an image',
  description: 'Use AI vision to identify plant and animal species in an uploaded image',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: IdentifyRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Species identified successfully',
      content: {
        'application/json': {
          schema: IdentifyResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Internal server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

export const identifyHandler: RouteHandler<typeof identifyRoute> = async (c) => {
  const auth = c.get('user');
  const { image } = c.req.valid('json');

  if (!image.startsWith(`${auth.userId}-`)) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const { PACKRAT_BUCKET_R2_BUCKET_NAME, PACKRAT_BUCKET } = getEnv(c);
  const command = new GetObjectCommand({
    Bucket: PACKRAT_BUCKET_R2_BUCKET_NAME,
    Key: image,
  });
  const imageUrl = await getPresignedUrl(c, {
    command,
    signOptions: { expiresIn: 3600 },
  });

  const service = new WildlifeIdentificationService(c);
  let identification: Awaited<ReturnType<typeof service.identifySpecies>>;
  try {
    identification = await service.identifySpecies(imageUrl);
  } catch (error) {
    console.error('Error identifying wildlife:', error);
    c.get('sentry').captureException(error);

    // Clean up temp upload before responding on error
    await PACKRAT_BUCKET.delete(image).catch((err: unknown) => {
      console.error('Failed to delete temp upload from R2:', err);
    });

    if (error instanceof Error) {
      if (
        error.message.includes('Invalid image') ||
        error.message.includes('Unsupported image format')
      ) {
        return c.json({ error: error.message }, 400);
      }
    }

    return c.json({ error: 'Failed to identify species' }, 500);
  }

  // Map AI results to the response format with stable IDs derived from scientific name
  const slugify = (name: string) =>
    name
      .toLowerCase()
      .replaceAll(/[\s.]+/g, '-')
      .replaceAll(/[^a-z0-9-]/g, '');

  const results = identification.results.map((r, index) => {
    const id = r.scientificName?.trim()
      ? slugify(r.scientificName)
      : r.commonName?.trim()
        ? slugify(r.commonName)
        : `unknown-${index}`;
    return {
      species: {
        id,
        commonName: r.commonName,
        scientificName: r.scientificName,
        category: r.category,
        description: r.description,
        habitat: r.habitat,
        regions: r.regions,
        dangerLevel: r.dangerLevel,
        characteristics: r.characteristics,
        conservationStatus: r.conservationStatus,
        interestingFacts: r.interestingFacts,
      },
      confidence: r.confidence,
      source: 'online' as const,
    };
  });

  // Clean up temp upload before responding on success
  await PACKRAT_BUCKET.delete(image).catch((err: unknown) => {
    console.error('Failed to delete temp upload from R2:', err);
  });

  return c.json({ results }, 200);
};

const wildlifeOpenApiRoutes = [
  defineOpenAPIRoute({ route: identifyRoute, handler: identifyHandler }),
] as const;

const wildlifeRoutes = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>().openapiRoutes(
  wildlifeOpenApiRoutes,
);

export { wildlifeRoutes };
