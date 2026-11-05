import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { ErrorText, Field } from '@/components/auth-forms';
import { BackButton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

export const Route = createFileRoute('/_auth/forgot-password')({
  validateSearch: z.object({ email: z.string().optional() }),
  head: () => ({ meta: [{ title: 'Forgot password · Family Gifts' }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [email, setEmail] = useState(search.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email');
      return;
    }
    setError(null);
    setSubmitting(true);
    // Succeeds whether or not an account exists, so this can't be used to
    // check which emails are registered.
    const { error } = await authClient.emailOtp.requestPasswordReset({ email: trimmed });
    setSubmitting(false);
    if (error) {
      setError(error.message ?? 'Something went wrong');
      return;
    }
    navigate({ to: '/reset-password', search: { email: trimmed } });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <BackButton fallback="/sign-in" />
          <h1 className="font-display-bold text-4xl tracking-tight text-ink">Forgot password</h1>
        </div>
        <p className="px-4 text-[15px] text-muted-foreground">
          Enter your email and we’ll send you a 6-digit code to reset your password.
        </p>
      </div>
      <div className="flex flex-col gap-6">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
      </div>
      <Button type="submit" size="lg" className="h-12" disabled={submitting}>
        Send Code
      </Button>
    </form>
  );
}
