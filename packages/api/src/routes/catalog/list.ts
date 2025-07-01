import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { createDb } from "@packrat/api/db";
import { catalogItems } from "@packrat/api/db/schema";
import { CatalogService } from "@packrat/api/services/catalogService";
import { generateEmbedding } from "@packrat/api/services/embeddingService";
import type { Env } from "@packrat/api/types/env";
import {
  authenticateRequest,
  unauthorizedResponse,
} from "@packrat/api/utils/api-middleware";
import { getEmbeddingText } from "@packrat/api/utils/embeddingHelper";
import { eq } from "drizzle-orm";
import { env } from "hono/adapter";

const catalogListRoutes = new OpenAPIHono();

const listGetRoute = createRoute({
  method: "get",
  path: "/",
  request: {
    query: z.object({
      id: z.string().optional(),
      page: z.coerce.number().int().positive().optional().default(1),
      limit: z.coerce.number().int().nonnegative().optional().default(20),
      q: z.string().optional(),
      category: z.string().optional(),
      sort: z
        .object({
          field: z.enum([
            "name",
            "brand",
            "category",
            "price",
            "ratingValue",
            "createdAt",
            "updatedAt",
          ]),
          order: z.enum(["asc", "desc"]),
        })
        .optional(),
    }),
  },
  responses: { 200: { description: "Get catalog items" } },
});

catalogListRoutes.openapi(listGetRoute, async (c) => {
  // Authenticate the request
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { id, page, limit, q, category } = c.req.valid("query");

  // Manually parse sort parameters from raw query
  const url = new URL(c.req.url);
  const sortField = url.searchParams.get("sort[field]");
  const sortOrder = url.searchParams.get("sort[order]");

  // Validate sort parameters
  const validSortFields = [
    "name",
    "brand",
    "category",
    "price",
    "ratingValue",
    "createdAt",
    "updatedAt",
  ] as const;
  const validSortOrders = ["asc", "desc"] as const;

  const sort =
    sortField &&
    sortOrder &&
    validSortFields.includes(sortField as any) &&
    validSortOrders.includes(sortOrder as any)
      ? {
          field: sortField as (typeof validSortFields)[number],
          order: sortOrder as (typeof validSortOrders)[number],
        }
      : undefined;

  if (id) {
    // Get a specific catalog item
    const db = createDb(c);
    const item = await db.query.catalogItems.findFirst({
      where: eq(catalogItems.id, Number.parseInt(id, 10)),
    });

    if (!item) {
      return c.json({ error: "Catalog item not found" }, { status: 404 });
    }

    return c.json(item);
  }

  // Use CatalogService for list queries
  const catalogService = new CatalogService(c);
  const offset = (page - 1) * limit;

  const result = await catalogService.getCatalogItems({
    q,
    limit,
    offset,
    category,
    sort,
  });

  const totalPages = Math.ceil(result.total / limit);

  return c.json({
    items: result.items,
    totalCount: result.total,
    page,
    limit,
    totalPages,
  });
});

const listPostRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": { schema: z.any() },
      },
    },
  },
  responses: { 200: { description: "Create catalog item" } },
});

catalogListRoutes.openapi(listPostRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);
  const data = await c.req.json();
  const { OPENAI_API_KEY } = env<Env>(c);

  if (!OPENAI_API_KEY) {
    return c.json({ error: "OpenAI API key not configured" }, 500);
  }

  // Generate embedding
  const embeddingText = getEmbeddingText(data);
  const embedding = await generateEmbedding({
    openAiApiKey: OPENAI_API_KEY,
    value: embeddingText,
  });

  const [newItem] = await db
    .insert(catalogItems)
    .values({
      name: data.name,
      description: data.description,
      defaultWeight: data.defaultWeight,
      defaultWeightUnit: data.defaultWeightUnit,
      category: data.category,
      image: data.image,
      brand: data.brand,
      model: data.model,
      url: data.url,

      // New fields
      ratingValue: data.ratingValue,
      productUrl: data.productUrl,
      color: data.color,
      size: data.size,
      sku: data.sku,
      price: data.price,
      availability: data.availability,
      seller: data.seller,
      productSku: data.productSku,
      material: data.material,
      currency: data.currency,
      condition: data.condition,
      techs: data.techs,
      links: data.links,
      reviews: data.reviews,
      embedding,
    })
    .returning();

  return c.json(newItem);
});

export { catalogListRoutes };
