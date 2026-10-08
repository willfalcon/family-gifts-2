/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as avatarColors from "../avatarColors.js";
import type * as emails_EventInviteEmail from "../emails/EventInviteEmail.js";
import type * as emails_GroupInviteEmail from "../emails/GroupInviteEmail.js";
import type * as emails_SecretSantaAssignmentEmail from "../emails/SecretSantaAssignmentEmail.js";
import type * as events from "../events.js";
import type * as favorites from "../favorites.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as items from "../items.js";
import type * as listShares from "../listShares.js";
import type * as lists from "../lists.js";
import type * as permissions from "../permissions.js";
import type * as profiles from "../profiles.js";
import type * as resend from "../resend.js";
import type * as secretSanta from "../secretSanta.js";
import type * as sendEventInviteEmail from "../sendEventInviteEmail.js";
import type * as sendGroupInviteEmail from "../sendGroupInviteEmail.js";
import type * as sendSecretSantaAssignmentEmail from "../sendSecretSantaAssignmentEmail.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  avatarColors: typeof avatarColors;
  "emails/EventInviteEmail": typeof emails_EventInviteEmail;
  "emails/GroupInviteEmail": typeof emails_GroupInviteEmail;
  "emails/SecretSantaAssignmentEmail": typeof emails_SecretSantaAssignmentEmail;
  events: typeof events;
  favorites: typeof favorites;
  groups: typeof groups;
  http: typeof http;
  invites: typeof invites;
  items: typeof items;
  listShares: typeof listShares;
  lists: typeof lists;
  permissions: typeof permissions;
  profiles: typeof profiles;
  resend: typeof resend;
  secretSanta: typeof secretSanta;
  sendEventInviteEmail: typeof sendEventInviteEmail;
  sendGroupInviteEmail: typeof sendGroupInviteEmail;
  sendSecretSantaAssignmentEmail: typeof sendSecretSantaAssignmentEmail;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
