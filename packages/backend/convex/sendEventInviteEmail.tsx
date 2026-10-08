'use node';

import { v } from 'convex/values';
import { render, pretty } from '@react-email/render';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { resend } from './resend';
import { EventInviteEmail } from './emails/EventInviteEmail';

// React Email's renderer needs Node, so it can't live in events.ts alongside
// the mutations/queries there. Reads go through an internal query since
// actions have no ctx.db.
export const sendEventInviteEmail = internalAction({
  args: { inviteId: v.id('eventInvites') },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.events.getInviteEmailData, { inviteId: args.inviteId });
    if (!data) return null;

    const inviteUrl = `${process.env.SITE_URL}/invite/${data.token}`;
    const html = await pretty(
      await render(<EventInviteEmail eventName={data.eventName} inviterName={data.inviterName} inviteUrl={inviteUrl} />)
    );

    await resend.sendEmail(ctx, {
      from: process.env.FROM_EMAIL_ADDRESS!,
      to: data.email,
      subject: `You're invited to ${data.eventName} on Family Gifts`,
      html,
    });
    return null;
  },
});
