import { betterAuth } from "better-auth/minimal";
import { createClient, type AuthFunctions, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import authConfig from "./auth.config";
import { components, internal } from "./_generated/api";
import { query } from "./_generated/server";
import type { DataModel } from "./_generated/dataModel";

const siteUrl = process.env.SITE_URL!;

// Points the component at the trigger mutations exported from this file.
const authFunctions: AuthFunctions = internal.auth;

// Talks to the Better Auth component tables that live in this Convex deployment.
// Triggers run in the same transaction as the auth write, so a profile row
// always exists for a user (and is cleaned up when the user is deleted).
export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, authUser) => {
        await ctx.db.insert("profiles", { userId: authUser._id });
      },
      onDelete: async (ctx, authUser) => {
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_userId", (q) => q.eq("userId", authUser._id))
          .unique();
        if (profile) await ctx.db.delete(profile._id);

        for await (const favorite of ctx.db
          .query("favorites")
          .withIndex("by_user", (q) => q.eq("userId", authUser._id))) {
          await ctx.db.delete(favorite._id);
        }
        for await (const favorite of ctx.db
          .query("favorites")
          .withIndex("by_favoritedUserId", (q) => q.eq("favoritedUserId", authUser._id))) {
          await ctx.db.delete(favorite._id);
        }
      },
    },
  },
});

// Registered mutations the component calls to run the triggers above.
export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    // Add social providers here later, e.g.:
    // socialProviders: { github: { clientId: ..., clientSecret: ... } },
    plugins: [convex({ authConfig })],
  });

// Convenience query for the client: current signed-in user, or null.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => authComponent.safeGetAuthUser(ctx),
});
