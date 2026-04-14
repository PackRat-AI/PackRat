import { authPlugin } from '@packrat/api/middleware/auth';
import { GuideSearchQuerySchema, GuidesQuerySchema } from '@packrat/api/schemas/guides';
import { R2BucketService } from '@packrat/api/services/r2-bucket';
import { getEnv } from '@packrat/api/utils/env-validation';
import { asNumber, asString, isArray } from '@packrat/guards';

const MDX_EXT_RE = /\.(mdx?|md)$/;
const DASH_RE = /-/g;

import { Elysia, status } from 'elysia';
import matter from 'gray-matter';
import { z } from 'zod';

export const guidesRoutes = new Elysia({ prefix: '/guides' })
  .use(authPlugin)

  // -- List guides
  .get(
    '/',
    async ({ query }) => {
      const { page, limit, category } = query;

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

        filteredGuides.sort((a, b) => String(a.title).localeCompare(String(b.title)));

        const total = filteredGuides.length;
        const offset = (page - 1) * limit;
        const paginatedGuides = filteredGuides.slice(offset, offset + limit);
        const totalPages = Math.ceil(total / limit);

        return {
          items: paginatedGuides,
          totalCount: total,
          page,
          limit,
          totalPages,
        };
      } catch (error) {
        console.error('Error listing guides:', error);
        return status(500, { error: 'Failed to list guides' });
      }
    },
    {
      query: GuidesQuerySchema,
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
        return { categories, count: categories.length };
      } catch (error) {
        console.error('Error getting guide categories:', error);
        return status(500, { error: 'Failed to get guide categories' });
      }
    },
    {
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

        return {
          items: paginatedGuides,
          totalCount: total,
          page,
          limit,
          totalPages,
          query: q,
        };
      } catch (error) {
        console.error('Error searching guides:', error);
        return status(500, { error: 'Failed to search guides' });
      }
    },
    {
      query: GuideSearchQuerySchema,
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
          return status(404, { error: 'Guide not found' });
        }

        const headResult = await bucket.head(key);
        const metadata = headResult?.customMetadata || {};
        const rawContent = await object.text();
        const { data: frontmatter, content } = matter(rawContent);

        return {
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
        };
      } catch (error) {
        console.error('Error fetching guide:', error);
        return status(500, { error: 'Failed to fetch guide' });
      }
    },
    {
      params: z.object({ id: z.string() }),
      isAuthenticated: true,
      detail: {
        tags: ['Guides'],
        summary: 'Get a specific guide',
        security: [{ bearerAuth: [] }],
      },
    },
  );
