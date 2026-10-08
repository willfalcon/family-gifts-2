'use node';

import { v } from 'convex/values';
import { render, pretty } from '@react-email/render';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { resend } from './resend';
import { SecretSantaAssignmentEmail } from './emails/SecretSantaAssignmentEmail';

// React Email's renderer needs Node, so it can't live in secretSanta.ts
// alongside the mutations/queries there. Sends one email per giver, each
// only naming that giver's own recipient - never the full matchup list.
export const sendSecretSantaAssignmentEmails = internalAction({
  args: { secretSantaId: v.id('secretSantas') },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.secretSanta.getAssignmentEmailData, { secretSantaId: args.secretSantaId });
    if (!data) return null;

    const eventUrl = `${process.env.SITE_URL}/dashboard/events/${data.eventId}`;

    for (const { toEmail, toName, assigneeName } of data.emails) {
      const html = await pretty(
        await render(<SecretSantaAssignmentEmail eventName={data.eventName} toName={toName} assigneeName={assigneeName} eventUrl={eventUrl} />)
      );

      await resend.sendEmail(ctx, {
        from: process.env.FROM_EMAIL_ADDRESS!,
        to: toEmail,
        subject: `Your Secret Santa match for ${data.eventName}`,
        html,
      });
    }
    return null;
  },
});
