import { createDb, createOsmDb } from '@packrat/api/db';
import { authPlugin } from '@packrat/api/middleware/auth';
import { reportAuthorNames } from '@packrat/api/services/reportAuthors';
import { visibleToViewer } from '@packrat/api/services/reportVisibility';
import { getTrail, searchTrails } from '@packrat/api/services/trailIndex';
import { trailConditionReports } from '@packrat/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';
import { toReportResponse } from './reports';

/** Reports a trail page shows: enough history to see a pattern, not an archive. */
const TRAIL_PAGE_REPORT_LIMIT = 50;

const isNotConfigured = (error: unknown) =>
  error instanceof Error && error.message.includes('not configured');

export const trailIndexRoutes = new Elysia({ prefix: '/trails' })
  .use(authPlugin)

  /**
   * GET /api/trail-conditions/trails
   *
   * The trail picker: names matching `q`, nearest to lat/lon first when given.
   * A location alone lists the trails around it.
   */
  .get(
    '/',
    async ({ query }) => {
      const { q, lat, lon, limit = 20 } = query;
      if (!q?.trim() && (lat === undefined || lon === undefined)) {
        return status(400, { error: 'Provide q and/or lat+lon' });
      }
      try {
        const trails = await searchTrails({ db: createOsmDb(), q, lat, lon, limit });
        return { trails };
      } catch (error) {
        if (isNotConfigured(error)) {
          return status(503, { error: 'Trails are not available on this server' });
        }
        throw error;
      }
    },
    {
      query: z.object({
        q: z.string().max(100).optional(),
        lat: z.coerce.number().min(-90).max(90).optional(),
        lon: z.coerce.number().min(-180).max(180).optional(),
        limit: z.coerce.number().int().min(1).max(50).optional(),
      }),
      isAuthenticated: true,
      detail: {
        tags: ['Trail Conditions'],
        summary: 'Find trails by name and/or nearest to a point',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  /**
   * GET /api/trail-conditions/trails/:trailId
   *
   * One trail with its full geometry, for the trail page and the map.
   */
  .get(
    '/:trailId',
    async ({ params }) => {
      try {
        const trail = await getTrail({ db: createOsmDb(), id: params.trailId });
        if (!trail) return status(404, { error: 'Trail not found' });
        return trail;
      } catch (error) {
        if (isNotConfigured(error)) {
          return status(503, { error: 'Trails are not available on this server' });
        }
        throw error;
      }
    },
    {
      params: z.object({ trailId: z.string().uuid() }),
      isAuthenticated: true,
      detail: {
        tags: ['Trail Conditions'],
        summary: 'Get a trail with its geometry',
        security: [{ bearerAuth: [] }],
      },
    },
  )
  /**
   * GET /api/trail-conditions/trails/:trailId/reports
   *
   * The trail page: every report on the trail, newest first, signed with the
   * author's first name. Served from the main database, so it works even when
   * the trail database is unavailable.
   */
  .get(
    '/:trailId/reports',
    async ({ params, user }) => {
      const db = createDb();
      const reports = await db
        .tag('trailConditions.trailReports')
        .select()
        .from(trailConditionReports)
        .where(
          and(
            eq(trailConditionReports.deleted, false),
            eq(trailConditionReports.trailId, params.trailId),
            visibleToViewer({ db, viewerId: user.userId }),
          ),
        )
        .orderBy(desc(trailConditionReports.localCreatedAt))
        .limit(TRAIL_PAGE_REPORT_LIMIT);
      const authorName = await reportAuthorNames({ db, userIds: reports.map((r) => r.userId) });
      return {
        reports: reports.map((r) => ({
          ...toReportResponse(r),
          authorName: authorName.get(r.userId) ?? null,
        })),
      };
    },
    {
      params: z.object({ trailId: z.string().uuid() }),
      isAuthenticated: true,
      detail: {
        tags: ['Trail Conditions'],
        summary: "A trail's reports, newest first",
        security: [{ bearerAuth: [] }],
      },
    },
  );
