import { useState, type FormEvent } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { z } from 'zod';

import { fullName } from '@convex/names';
import { confirmPassword, DevUserSwitcher, ErrorText, Field } from '@/components/auth-forms';
import { BackButton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient, reloadTo } from '@/lib/auth-client';
import { safeRedirect } from '@/lib/utils';

export const Route = createFileRoute('/_auth/sign-in')({
  validateSearch: z.object({ mode: z.enum(['signIn', 'signUp']).optional(), redirect: z.string().optional() }),
  head: () => ({ meta: [{ title: 'Log in · Family Gifts' }] }),
  component: SignIn,
});

function SignIn() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const isSignIn = search.mode !== 'signUp';
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const done = () => reloadTo(safeRedirect(search.redirect));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    if (!isSignIn && !(await confirmPassword(password))) {
      setSubmitting(false);
      return;
    }
    const { error } = isSignIn
      ? await authClient.signIn.email({ email, password })
      : // `name` is the full name the app shows. The parts are saved on the
        // profile (see databaseHooks in convex/auth.ts).
        await authClient.signUp.email({
          email,
          password,
          name: fullName(firstName, lastName),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        });
    if (error) {
      setSubmitting(false);
      setError(error.message ?? 'Something went wrong');
      return;
    }
    done();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <BackButton fallback="/welcome" />
          <h1 className="font-display-bold text-4xl tracking-tight text-ink">
            {isSignIn ? 'Log in' : 'Create account'}
          </h1>
        </div>
        <p className="px-4 text-[15px] text-muted-foreground">
          {isSignIn ? 'Welcome back.' : 'It’s free. You’ll log in with your email and password.'}
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {!isSignIn && (
          <div className="flex gap-3">
            <div className="flex-1">
              <Field label="First name" htmlFor="first-name">
                <Input
                  id="first-name"
                  autoComplete="given-name"
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Last name" htmlFor="last-name">
                <Input
                  id="last-name"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              placeholder="Password"
              autoComplete={isSignIn ? 'current-password' : 'new-password'}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </Field>
          {isSignIn && (
            <Link
              to="/forgot-password"
              search={{ email: email.trim() || undefined }}
              className="self-end pt-1 text-sm font-semibold text-accent"
            >
              Forgot password?
            </Link>
          )}
        </div>
        <ErrorText>{error}</ErrorText>
      </div>

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" className="h-12" disabled={submitting}>
          {isSignIn ? 'Log In' : 'Create Account'}
        </Button>
        <button
          type="button"
          className="text-center text-sm text-ink-muted"
          onClick={() => navigate({ search: { ...search, mode: isSignIn ? 'signUp' : 'signIn' }, replace: true })}
        >
          {isSignIn ? 'Don’t have an account? ' : 'Already have an account? '}
          <span className="font-semibold text-accent">{isSignIn ? 'Create one' : 'Log in'}</span>
        </button>
      </div>

      <DevUserSwitcher onSignedIn={done} />
    </form>
  );
}
