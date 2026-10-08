import { createFileRoute } from "@tanstack/react-router";
import { handler } from "../../../lib/auth-server";

// Catch-all route: every /api/auth/* request is proxied to Convex by Better Auth.
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
    },
  },
});
