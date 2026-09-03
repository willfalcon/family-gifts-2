import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Mounts the Better Auth HTTP routes (sign-in, sign-out, token, OAuth callbacks)
// on this deployment's .convex.site domain.
authComponent.registerRoutes(http, createAuth);

export default http;
