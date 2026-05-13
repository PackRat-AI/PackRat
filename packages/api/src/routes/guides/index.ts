import { authPlugin } from '@packrat/api/middleware/auth';
import {
  GuideCategoriesResponseSchema,
  GuideDetailSchema,
  GuideSearchQuerySchema,
  GuideSearchResponseSchema,
  GuidesQuerySchema,
  GuidesResponseSchema,
} from '@packrat/api/schemas/guides';
import { R2BucketService } from '@packrat/api/services/r2-bucket';
import { getEnv } from '@packrat/api/utils/env-validation';
import { asNumber, asString, isArray } from '@packrat/guards';

const MDX_EXT_RE = /\.(mdx?|md)$/;
const DASH_RE = /-/g;

import { Elysia, NotFoundError } from 'elysia';
import matter from 'gray-matter';
import { z } from 'zod';

export const guidesRoutes = new Elysia({ prefix: '/guides' })
  .use(authPlugin)

  // -- List guides
  .get(
    '/',
    async ({ query, request }) => {
      const { page, limit, category } = query;

      // Manually parse `sort[field]` / `sort[order]` from the raw query string.
      // Elysia's query parser leaves bracketed keys as-is rather than
      // unflattening them into a nested object, so the schema's `sort` field
      // is never populated. Match dev's getGuidesRoute behavior.
      const searchParams = new URL(request.url).searchParams;
      const sortField = searchParams.get('sort[field]');
      const sortOrder = searchParams.get('sort[order]');
      const validSortFields = ['title', 'category', 'createdAt', 'updatedAt'] as const;
      const validSortOrders = ['asc', 'desc'] as const;
      const sort =
        sortField &&
        sortOrder &&
        validSortFields.includes(sortField as (typeof validSortFields)[number]) &&
        validSortOrders.includes(sortOrder as (typeof validSortOrders)[number])
          ? {
              field: sortField as (typeof validSortFields)[number],
              order: sortOrder as (typeof validSortOrders)[number],
            }
          : undefined;

      try {
        const bucket = new R2BucketService({
          env: getEnv(),
          bucketType: 'guides',
        });

        const list = await bucket.list();

        const guides = await Promise.all(
          list.objects.map(async (obj) => {
            let frontmatter: Record<string, unknown> = {};
            try {
              const response = await bucket.get(obj.key);
              if (response) {
                const text = await response.text();
                const { data } = matter(text);
                frontmatter = data;
              }
            } catch (error) {
              console.error(`Error parsing frontmatter for ${obj.key}:`, error);
            }

            return {
              id: obj.key.replace(MDX_EXT_RE, ''),
              key: obj.key,
              title:
                asString(frontmatter.title) ||
                obj.customMetadata?.title ||
                obj.key.replace(MDX_EXT_RE, '').replace(DASH_RE, ' '),
              category: obj.customMetadata?.category || 'general',
              categories: (frontmatter.categories as string[]) || [],
              description:
                asString(frontmatter.description) || obj.customMetadata?.description || '',
              author: asString(frontmatter.author),
              readingTime: asNumber(frontmatter.readingTime),
              difficulty: asString(frontmatter.difficulty),
              createdAt: obj.uploaded.toISOString(),
              updatedAt: obj.uploaded.toISOString(),
            };
          }),
        );

        let filteredGuides = guides;
        if (category) {
          filteredGuides = guides.filter(
            (guide) =>
              guide.category === category ||
              (isArray(guide.categories) && guide.categories.includes(category)),
          );
        }

        if (sort) {
          filteredGuides.sort((a, b) => {
            const aValue = String(a[sort.field as keyof typeof a]);
            const bValue = String(b[sort.field as keyof typeof b]);
            if (sort.order === 'asc') {
              return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            }
            return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
          });
        } else {
          // Default sort by title
          filteredGuides.sort((a, b) => String(a.title).localeCompare(String(b.title)));
        }

        const total = filteredGuides.length;
        const offset = (page - 1) * limit;
        const paginatedGuides = filteredGuides.slice(offset, offset + limit);
        const totalPages = Math.ceil(total / limit);

        return GuidesResponseSchema.parse({
          items: paginatedGuides,
          totalCount: total,
          page,
          limit,
          totalPages,
        });
      } catch (error) {
        console.error('Error listing guides:', error);
        throw error;
      }
    },
    {
      query: GuidesQuerySchema,
      response: { 200: GuidesResponseSchema },
      isAuthenticated: true,
      detail: {
        tags: ['Guides'],
        summary: 'Get all guides',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // -- Categories
  .get(
    '/categories',
    async () => {
      try {
        const bucket = new R2BucketService({
          env: getEnv(),
          bucketType: 'guides',
        });

        const list = await bucket.list();
        const categoriesSet = new Set<string>();

        const promises = list.objects.map(async (obj) => {
          try {
            const response = await bucket.get(obj.key);
            if (response) {
              const text = await response.text();
              const { data } = matter(text);
              if (data.categories && Array.isArray(data.categories)) {
                return data.categories as string[];
              }
            }
          } catch (error) {
            console.error(`Error processing guide ${obj.key}:`, error);
          }
          return [];
        });

        const results = await Promise.all(promises);
        for (const categories of results) {
          for (const category of categories) {
            categoriesSet.add(category);
          }
        }

        const categories = Array.from(categoriesSet).sort();
        return GuideCategoriesResponseSchema.parse({ categories, count: categories.length });
      } catch (error) {
        console.error('Error getting guide categories:', error);
        throw error;
      }
    },
    {
      response: { 200: GuideCategoriesResponseSchema },
      isAuthenticated: true,
      detail: {
        tags: ['Guides'],
        summary: 'Get all unique guide categories',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // -- Search
  .get(
    '/search',
    async ({ query }) => {
      const { q, page, limit, category } = query;
      if (!q || q.trim() === '') {
        throw new Error('Search query parameter q is required');
      }
      const searchQuery = q.toLowerCase();

      try {
        const bucket = new R2BucketService({
          env: getEnv(),
          bucketType: 'guides',
        });
        const list = await bucket.list({ limit: 1000 });

        const searchResults = await Promise.all(
          list.objects
            .filter((obj) => obj.key.endsWith('.mdx'))
            .map(async (obj) => {
              const guide = {
                id: obj.key.replace('.mdx', ''),
                key: obj.key,
                title:
                  obj.customMetadata?.title || obj.key.replace('.mdx', '').replace(DASH_RE, ' '),
                category: obj.customMetadata?.category || 'general',
                description: obj.customMetadata?.description || '',
                createdAt: obj.uploaded.toISOString(),
                updatedAt: obj.uploaded.toISOString(),
                score: 0,
              };

              if (category && guide.category !== category) {
                return null;
              }

              if (guide.title.toLowerCase().includes(searchQuery)) {
                guide.score += 10;
              }
              if (guide.description.toLowerCase().includes(searchQuery)) {
                guide.score += 5;
              }

              if (guide.score > 0) {
                return guide;
              }

              try {
                const object = await bucket.get(obj.key);
                if (object) {
                  const content = await object.text();
                  if (content.toLowerCase().includes(searchQuery)) {
                    guide.score += 1;
                    return guide;
                  }
                }
              } catch (error) {
                console.error(`Error reading guide ${obj.key}:`, error);
              }

              return null;
            }),
        );

        const guides = searchResults
          .filter((guide): guide is NonNullable<typeof guide> => guide !== null)
          .sort((a, b) => b.score - a.score)
          .map(({ score: _score, ...guide }) => guide);

        const total = guides.length;
        const offset = (page - 1) * limit;
        const paginatedGuides = guides.slice(offset, offset + limit);
        const totalPages = Math.ceil(total / limit);

        return GuideSearchResponseSchema.parse({
          items: paginatedGuides,
          totalCount: total,
          page,
          limit,
          totalPages,
          query: q,
        });
      } catch (error) {
        console.error('Error searching guides:', error);
        throw error;
      }
    },
    {
      query: GuideSearchQuerySchema,
      response: { 200: GuideSearchResponseSchema },
      isAuthenticated: true,
      detail: {
        tags: ['Guides'],
        summary: 'Search guides',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // -- Get by id
  .get(
    '/:id',
    async ({ params }) => {
      const { id } = params;

      try {
        const bucket = new R2BucketService({
          env: getEnv(),
          bucketType: 'guides',
        });

        let key = `${id}.mdx`;
        let object = await bucket.get(key);

        if (!object) {
          key = `${id}.md`;
          object = await bucket.get(key);
        }

        if (!object) {
          throw new NotFoundError('Guide not found');
        }

        const headResult = await bucket.head(key);
        const metadata = headResult?.customMetadata || {};
        const rawContent = await object.text();
        const { data: frontmatter, content } = matter(rawContent);

        return GuideDetailSchema.parse({
          id,
          key,
          title: frontmatter.title || metadata.title || id.replace(DASH_RE, ' '),
          category: metadata.category || 'general',
          categories: frontmatter.categories || [],
          description: frontmatter.description || metadata.description || '',
          author: frontmatter.author,
          readingTime: frontmatter.readingTime,
          difficulty: frontmatter.difficulty,
          content,
          createdAt: object.uploaded.toISOString(),
          updatedAt: object.uploaded.toISOString(),
        });
      } catch (error) {
        console.error('Error fetching guide:', error);
        throw error;
      }
    },
    {
      params: z.object({ id: z.string() }),
      response: { 200: GuideDetailSchema },
      isAuthenticated: true,
      detail: {
        tags: ['Guides'],
        summary: 'Get a specific guide',
        security: [{ bearerAuth: [] }],
      },
    },
  );
