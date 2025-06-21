import { OpenAPIHono } from "@hono/zod-openapi";
import { packItemsRoutes } from "./items";
import { packsListRoutes } from "./list";
import { packRoutes } from "./pack";

const packsRoutes = new OpenAPIHono();

packsRoutes.route("/", packsListRoutes);
packsRoutes.route("/", packRoutes);
packsRoutes.route("/", packItemsRoutes);

export { packsRoutes };
