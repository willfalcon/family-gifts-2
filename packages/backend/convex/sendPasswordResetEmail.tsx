'use node';

import { v } from 'convex/values';
import { render, pretty } from '@react-email/render';
import { internalAction } from './_generated/server';
import { resend } from './resend';
import { PasswordResetCodeEmail } from './emails/PasswordResetCodeEmail';

// Scheduled from the Better Auth emailOTP plugin (see auth.ts). Only called
// when an account with this email exists.
export const sendPasswordResetEmail = internalAction({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const html = await pretty(await render(<PasswordResetCodeEmail code={args.code} />));

    await resend.sendEmail(ctx, {
      from: process.env.FROM_EMAIL_ADDRESS!,
      to: args.email,
      subject: `${args.code} is your Family Gifts password reset code`,
      html,
    });
    return null;
  },
});
