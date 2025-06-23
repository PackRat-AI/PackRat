import { authMiddleware } from "@/middleware";
import { OpenAPIHono } from "@hono/zod-openapi";
import { authRoutes } from "./auth";
import { catalogRoutes } from "./catalog";
import { chatRoutes } from "./chat";
import { packsRoutes } from "./packs";
import { weatherRoutes } from "./weather";
import { uploadRoutes } from "./upload";
import { userRoutes } from "./user";
import { packTemplatesRoutes } from "./packTemplates";
import { searchRoutes } from "./search";

const publicRoutes = new OpenAPIHono();

// Mount public routes
publicRoutes.route("/auth", authRoutes);
publicRoutes.route("/weather", weatherRoutes);

const protectedRoutes = new OpenAPIHono();
protectedRoutes.use(authMiddleware);

// Mount protected routes
protectedRoutes.route("/catalog", catalogRoutes);
protectedRoutes.route("/packs", packsRoutes);
protectedRoutes.route("/pack-templates", packTemplatesRoutes);
protectedRoutes.route("/chat", chatRoutes);
protectedRoutes.route("/user", userRoutes);
protectedRoutes.route("/upload", uploadRoutes);
protectedRoutes.route("/search", searchRoutes);

const routes = new OpenAPIHono();

routes.route("/", publicRoutes);
routes.route("/", protectedRoutes);

export { routes };
