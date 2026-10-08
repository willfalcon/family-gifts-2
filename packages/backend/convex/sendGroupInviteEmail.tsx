'use node';

import { v } from 'convex/values';
import { render, pretty } from '@react-email/render';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { resend } from './resend';
import { GroupInviteEmail } from './emails/GroupInviteEmail';

// React Email's renderer needs Node, so it can't live in groups.ts alongside
// the mutations/queries there. Reads go through an internal query since
// actions have no ctx.db.
export const sendGroupInviteEmail = internalAction({
  args: { inviteId: v.id('groupInvites') },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.groups.getInviteEmailData, { inviteId: args.inviteId });
    if (!data) return null;

    const inviteUrl = `${process.env.SITE_URL}/invite/${data.token}`;
    const html = await pretty(
      await render(<GroupInviteEmail groupName={data.groupName} inviterName={data.inviterName} inviteUrl={inviteUrl} />)
    );

    await resend.sendEmail(ctx, {
      from: process.env.FROM_EMAIL_ADDRESS!,
      to: data.email,
      subject: `You're invited to join ${data.groupName} on Family Gifts`,
      html,
    });
    return null;
  },
});
