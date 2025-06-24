import { OpenAPIHono } from "@hono/zod-openapi";
import { userItemsRoutes } from "./items";

const userRoutes = new OpenAPIHono();

userRoutes.route("/", userItemsRoutes);

export { userRoutes };
