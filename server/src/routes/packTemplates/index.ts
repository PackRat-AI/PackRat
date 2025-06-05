import { Hono } from "hono";
import { packTemplateListRoutes } from "./packTemplateList";
import { packTemplateRoutes } from "./packTemplates";
import { packTemplateItemsRoutes } from "./packTemplateItems";

const packTemplatesRoutes = new Hono();

packTemplatesRoutes.route("/", packTemplateListRoutes);
packTemplatesRoutes.route("/", packTemplateRoutes);
packTemplatesRoutes.route("/", packTemplateItemsRoutes);

export { packTemplatesRoutes };
