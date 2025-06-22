import { routes } from "@/routes";
import { processQueueBatch } from "@/services/queue";
import { Env } from "@/types/env";
import { MessageBatch } from "@cloudflare/workers-types";
import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new OpenAPIHono<{ Bindings: Env }>();

// Apply global middleware
app.use(logger());
app.use(cors());

// Mount routes
app.route("/api", routes);

// OpenAPI documentation and UI
app.doc("/doc", {
  openapi: "3.0.0",
  info: { title: "PackRat API", version: "1.0.0" },
});
app.get("/scalar", Scalar({ url: "/doc" }));

// Health check endpoint
app.get("/", (c) => {
  return c.text("PackRat API is running!");
});

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    if (!env.ETL_QUEUE) {
      throw new Error("ETL_QUEUE is not configured");
    }
    await processQueueBatch({ batch, env });
  },
};
