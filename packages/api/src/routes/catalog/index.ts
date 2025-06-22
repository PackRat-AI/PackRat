import { OpenAPIHono } from "@hono/zod-openapi";
import { catalogETLQueueRoutes } from "./etl";
import { catalogItemRoutes } from "./id";
import { catalogListRoutes } from "./list";

const catalogRoutes = new OpenAPIHono();

catalogRoutes.route("/", catalogListRoutes);
catalogRoutes.route("/", catalogItemRoutes);
catalogRoutes.route("/", catalogETLQueueRoutes);

export { catalogRoutes };
