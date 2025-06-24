import { Hono } from "hono";
import { packTemplateRoutes } from "./packTemplates";
import { packTemplateItemsRoutes } from "./packTemplateItems";

const packTemplatesRoutes = new Hono();

packTemplatesRoutes.route("/", packTemplateRoutes);
packTemplatesRoutes.route("/", packTemplateItemsRoutes);

export { packTemplatesRoutes };
