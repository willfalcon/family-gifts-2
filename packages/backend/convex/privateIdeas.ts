import { ConvexError, v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { mutation, query, type QueryCtx } from './_generated/server';
import { authComponent } from './auth';
import { canViewProfile } from './permissions';

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;

// Trims and checks the fields. A blank description is stored as unset.
function cleanFields(args: { title: string; description?: string }) {
  const title = args.title.trim();
  const description = args.description?.trim() || undefined;
  if (!title) throw new ConvexError('Give your idea a title.');
  if (title.length > TITLE_MAX) throw new ConvexError(`Keep the title under ${TITLE_MAX} characters.`);
  if (description && description.length > DESCRIPTION_MAX) {
    throw new ConvexError(`Keep the description under ${DESCRIPTION_MAX} characters.`);
  }
  return { title, description };
}

// Loads one of the caller's own ideas, or throws.
async function getOwnIdea(ctx: QueryCtx, id: Id<'privateIdeas'>, userId: string) {
  const idea = await ctx.db.get(id);
  if (!idea || idea.userId !== userId) throw new Error('Idea not found');
  return idea;
}

// The caller's private ideas for one person, newest first. `forUserId` comes
// from a URL param, so it's a plain string; an unknown id just returns [].
export const forPerson = query({
  args: { forUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    return await ctx.db
      .query('privateIdeas')
      .withIndex('by_user_forUser', q => q.eq('userId', user._id).eq('forUserId', args.forUserId))
      .order('desc')
      .collect();
  },
});

export const create = mutation({
  args: { forUserId: v.string(), title: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (args.forUserId === user._id) {
      throw new ConvexError("Private ideas are for other people - add it to one of your lists instead.");
    }
    if (!canViewProfile(ctx, user._id, args.forUserId) || !(await authComponent.getAnyUserById(ctx, args.forUserId))) {
      throw new Error('Person not found');
    }

    return await ctx.db.insert('privateIdeas', {
      userId: user._id,
      forUserId: args.forUserId,
      ...cleanFields(args),
    });
  },
});

export const update = mutation({
  args: { id: v.id('privateIdeas'), title: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await getOwnIdea(ctx, args.id, user._id);
    // Patching `description` to undefined clears it.
    await ctx.db.patch(args.id, cleanFields(args));
  },
});

export const remove = mutation({
  args: { id: v.id('privateIdeas') },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await getOwnIdea(ctx, args.id, user._id);
    await ctx.db.delete(args.id);
  },
});
