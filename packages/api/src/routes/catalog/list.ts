import { createDb } from "@/db";
import { catalogItems } from "@/db/schema";
import {
  authenticateRequest,
  unauthorizedResponse,
} from "@/utils/api-middleware";
import { eq } from "drizzle-orm";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

const catalogListRoutes = new OpenAPIHono();

const listGetRoute = createRoute({
  method: 'get',
  path: '/',
  request: {
    query: z.object({ id: z.string().optional() }),
  },
  responses: { 200: { description: 'Get catalog items' } },
});

catalogListRoutes.openapi(listGetRoute, async (c) => {
  try {
    // Authenticate the request
    const auth = await authenticateRequest(c);
    if (!auth) {
      return unauthorizedResponse();
    }

    const db = createDb(c);
    const id = c.req.query("id");

    if (id) {
      // Get a specific catalog item
      const item = await db.query.catalogItems.findFirst({
        where: eq(catalogItems.id, Number.parseInt(id)),
      });

      if (!item) {
        return c.json({ error: "Catalog item not found" }, { status: 404 });
      }

      return c.json(item);
    } else {
      // Get all catalog items
      const items = await db.query.catalogItems.findMany();
      return c.json(items);
    }
  } catch (error) {
    console.error("Error fetching catalog items:", error);
    return c.json({ error: "Failed to fetch catalog items" }, { status: 500 });
  }
});

const listPostRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': { schema: z.any() },
      },
    },
  },
  responses: { 200: { description: 'Create catalog item' } },
});

catalogListRoutes.openapi(listPostRoute, async (c) => {
  try {
    // Only admins should be able to create catalog items
    const auth = await authenticateRequest(c);
    if (!auth) {
      return unauthorizedResponse();
    }

    // In a real app, you would check if the user is an admin
    // For now, we'll just use authentication

    const db = createDb(c);
    const data = await c.req.json();

    // Create the catalog item
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
      })
      .returning();

    return c.json(newItem);
  } catch (error) {
    console.error("Error creating catalog item:", error);
    return c.json({ error: "Failed to create catalog item" }, { status: 500 });
  }
});

export { catalogListRoutes };
