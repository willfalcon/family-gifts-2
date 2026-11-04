import { betterAuth } from "better-auth/minimal";
import { createClient, type AuthFunctions, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { expo } from "@better-auth/expo";
import { emailOTP } from "better-auth/plugins/email-otp";
import authConfig from "./auth.config";
import { components, internal } from "./_generated/api";
import { query } from "./_generated/server";
import type { DataModel } from "./_generated/dataModel";
import { fullName, nameFields, splitName } from "./names";

const siteUrl = process.env.SITE_URL!;

// Points the component at the trigger mutations exported from this file.
const authFunctions: AuthFunctions = internal.auth;

// The profile fields that let someone be found by name or email, copied from
// the Better Auth user by the triggers below.
export function searchFields(user: { name: string; email: string }) {
  const email = user.email.toLowerCase();
  return { email, searchText: `${user.name} ${email}` };
}

function guessedNameFields(name: string) {
  const { firstName, lastName } = splitName(name);
  return nameFields(firstName, lastName);
}

// Talks to the Better Auth component tables that live in this Convex deployment.
// Triggers run in the same transaction as the auth write, so a profile row
// always exists for a user (and is cleaned up when the user is deleted).
export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, authUser) => {
        // The name parts are a guess here. A sign-up form that sent the real
        // ones replaces them right after (see `databaseHooks` below).
        await ctx.db.insert("profiles", {
          userId: authUser._id,
          discoverable: false,
          ...guessedNameFields(authUser.name),
          ...searchFields(authUser),
        });
      },
      // Keeps the profile's search copies of name and email current. If the
      // name was changed without going through profiles.updateName, the
      // saved parts no longer match it, so they're guessed again.
      onUpdate: async (ctx, authUser, oldUser) => {
        if (authUser.name === oldUser.name && authUser.email === oldUser.email) return;
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_userId", (q) => q.eq("userId", authUser._id))
          .unique();
        if (!profile) return;
        const partsMatch = !!profile.firstName && fullName(profile.firstName, profile.lastName) === authUser.name;
        await ctx.db.patch(profile._id, {
          ...searchFields(authUser),
          ...(partsMatch ? {} : guessedNameFields(authUser.name)),
        });
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
    // The web app's own origin, plus the mobile app's deep-link scheme
    // (registered as "scheme" in apps/mobile/app.json) so Better Auth
    // accepts redirects/sessions from both clients. In Expo Go, the
    // expo-origin header is the exp:// dev-server URL instead of our
    // scheme, since Expo Go ignores custom schemes — ALLOW_EXPO_GO_DEV_ORIGIN
    // is set via `npx convex env set` only on the dev deployment (never prod)
    // to additionally trust that pattern. process.env.NODE_ENV is always
    // "production" inside Convex functions, even on a dev deployment, so it
    // can't be used to distinguish dev from prod here.
    trustedOrigins: [
      siteUrl,
      "familygifts://",
      ...(process.env.ALLOW_EXPO_GO_DEV_ORIGIN === "true"
        ? ["exp://", "exp://**", "exp://192.168.*.*:*/**"]
        : []),
    ],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      // Sign the user out on other devices after a password reset.
      revokeSessionsOnPasswordReset: true,
    },
    // Sign-up forms send `firstName` and `lastName` alongside `name` (their
    // two joined). Better Auth has nowhere to keep them, so they're saved on
    // the profile, replacing the guess the user.onCreate trigger made.
    databaseHooks: {
      user: {
        create: {
          after: async (user, context) => {
            const body = context?.body as Record<string, unknown> | undefined;
            const firstName = body?.firstName;
            const lastName = body?.lastName;
            if (typeof firstName !== "string" || !("runMutation" in ctx)) return;
            await ctx.runMutation(internal.profiles.setSignUpNameParts, {
              userId: user.id,
              firstName,
              lastName: typeof lastName === "string" ? lastName : "",
            });
          },
        },
      },
    },
    // Add social providers here later, e.g.:
    // socialProviders: { github: { clientId: ..., clientSecret: ... } },
    plugins: [
      expo(),
      convex({ authConfig }),
      // Password reset via a 6-digit emailed code instead of a link. The plugin
      // stores the code in the verification table, expires it after 5 minutes,
      // allows 3 attempts, and silently skips sending when no account exists.
      emailOTP({
        disableSignUp: true,
        sendVerificationOTP: async ({ email, otp, type }) => {
          // Only the password reset flow is wired up in the apps.
          if (type !== "forget-password") return;
          if (!("scheduler" in ctx)) throw new Error("Cannot send email from a query");
          await ctx.scheduler.runAfter(0, internal.sendPasswordResetEmail.sendPasswordResetEmail, {
            email,
            code: otp,
          });
        },
      }),
    ],
  });

// Convenience query for the client: current signed-in user, or null.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => authComponent.safeGetAuthUser(ctx),
});
