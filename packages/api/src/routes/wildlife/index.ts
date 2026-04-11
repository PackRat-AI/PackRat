import { GetObjectCommand } from '@aws-sdk/client-s3';
import { authPlugin } from '@packrat/api/middleware/auth';
import { WildlifeIdentificationService } from '@packrat/api/services/wildlifeIdentificationService';
import { getEnv } from '@packrat/api/utils/env-validation';
import { getPresignedUrl } from '@packrat/api/utils/getPresignedUrl';
import { Elysia, status } from 'elysia';
import { z } from 'zod';

const IdentifyRequestSchema = z.object({
  image: z.string().describe('Uploaded image key in R2'),
});

export const wildlifeRoutes = new Elysia({ prefix: '/wildlife' })
  .use(authPlugin)
  .post(
    '/identify',
    async ({ body, user }) => {
      const { image } = body;

      if (!image.startsWith(`${user.userId}-`)) {
        return status(403, { error: 'Unauthorized' });
      }

      const { PACKRAT_BUCKET_R2_BUCKET_NAME, PACKRAT_BUCKET } = getEnv();
      const command = new GetObjectCommand({
        Bucket: PACKRAT_BUCKET_R2_BUCKET_NAME,
        Key: image,
      });
      const imageUrl = await getPresignedUrl({
        command,
        signOptions: { expiresIn: 3600 },
      });

      const service = new WildlifeIdentificationService();
      let identification: Awaited<ReturnType<typeof service.identifySpecies>>;
      try {
        identification = await service.identifySpecies(imageUrl);
      } catch (error) {
        console.error('Error identifying wildlife:', error);

        // Clean up temp upload on error
        await PACKRAT_BUCKET.delete(image).catch((err: unknown) => {
          console.error('Failed to delete temp upload from R2:', err);
        });

        if (error instanceof Error) {
          if (
            error.message.includes('Invalid image') ||
            error.message.includes('Unsupported image format')
          ) {
            return status(400, { error: error.message });
          }
        }

        return status(500, { error: 'Failed to identify species' });
      }

      // Map AI results with stable IDs derived from scientific name
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

      await PACKRAT_BUCKET.delete(image).catch((err: unknown) => {
        console.error('Failed to delete temp upload from R2:', err);
      });

      return { results };
    },
    {
      body: IdentifyRequestSchema,
      isAuthenticated: true,
      detail: {
        tags: ['Wildlife'],
        summary: 'Identify plant or animal species from an image',
        description: 'Use AI vision to identify plant and animal species in an uploaded image',
        security: [{ bearerAuth: [] }],
      },
    },
  );
