import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { ResetPasswordForm } from '@/components/auth-forms';
import { BackButton } from '@/components/page';
import { reloadTo } from '@/lib/auth-client';

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: z.object({ email: z.string().optional() }),
  head: () => ({ meta: [{ title: 'New password · Family Gifts' }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const { email = '' } = Route.useSearch();
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <BackButton fallback="/forgot-password" />
          <h1 className="font-display-bold text-4xl tracking-tight text-ink">New password</h1>
        </div>
        <p className="px-4 text-[15px] text-muted-foreground">
          If an account exists for <span className="font-semibold">{email}</span>, we’ve emailed it a 6-digit code. It
          expires in 5 minutes.
        </p>
      </div>
      <ResetPasswordForm email={email} onSuccess={() => reloadTo('/')} />
    </div>
  );
}
