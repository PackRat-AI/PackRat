import { OpenAPIHono } from "@hono/zod-openapi";
import { catalogItemRoutes } from "./id";
import { catalogListRoutes } from "./list";

const catalogRoutes = new OpenAPIHono();

catalogRoutes.route("/", catalogListRoutes);
catalogRoutes.route("/", catalogItemRoutes);

export { catalogRoutes };
