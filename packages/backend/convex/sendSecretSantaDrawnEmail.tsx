'use node';

import { v } from 'convex/values';
import { render, pretty } from '@react-email/render';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { resend } from './resend';
import { SecretSantaDrawnEmail } from './emails/SecretSantaDrawnEmail';

// Tells each host that a scheduled Reviewed draw is waiting to be sent.
// Lives apart from secretSanta.ts because React Email's renderer needs Node.
export const sendSecretSantaDrawnEmails = internalAction({
  args: { secretSantaId: v.id('secretSantas') },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.secretSanta.getDrawnEmailData, { secretSantaId: args.secretSantaId });
    if (!data) return null;

    const eventUrl = `${process.env.SITE_URL}/dashboard/events/${data.eventId}`;

    for (const { toEmail, toName } of data.hosts) {
      const html = await pretty(
        await render(<SecretSantaDrawnEmail eventName={data.eventName} toName={toName} eventUrl={eventUrl} />),
      );
      await resend.sendEmail(ctx, {
        from: process.env.FROM_EMAIL_ADDRESS!,
        to: toEmail,
        subject: `Secret Santa names are drawn for ${data.eventName}`,
        html,
      });
    }
    return null;
  },
});
