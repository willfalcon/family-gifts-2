import { useState, type FormEvent, type ReactNode } from 'react';

import { MOCK_USERS, MOCK_USER_PASSWORD, type MockUser } from '@shared/mock-users';
import { confirm } from '@/components/alerts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/controls';
import { authClient } from '@/lib/auth-client';
import { countPasswordBreaches } from '@/lib/pwned-password';
import { cn } from '@/lib/utils';

// Checks a password against the breach list and, if it's been leaked, asks
// whether to use it anyway (mobile's BreachedPasswordDialog).
export async function confirmPassword(password: string) {
  const count = await countPasswordBreaches(password);
  if (count === 0) return true;
  return confirm({
    title: 'This password has been leaked',
    message: `It has shown up ${count.toLocaleString()} ${count === 1 ? 'time' : 'times'} in known data breaches, so it’s on lists attackers use to guess passwords. We recommend choosing a different one. (haveibeenpwned.com/Passwords)`,
    confirmText: 'Use It Anyway',
    cancelText: 'Choose a Different Password',
    destructive: true,
  });
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  );
}

// Code + new password for the emailed-code reset. Used signed out (Forgot
// password) and signed in (Change password → Forgot it?).
export function ResetPasswordForm({ email, onSuccess }: { email: string; onSuccess: () => void }) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Enter the 6-digit code from the email');
      return;
    }
    setError(null);
    setNotice(null);
    setSubmitting(true);
    if (!(await confirmPassword(password))) {
      setSubmitting(false);
      return;
    }
    const { error } = await authClient.emailOtp.resetPassword({ email, otp: code, password });
    if (error) {
      setSubmitting(false);
      setError(error.message ?? 'Something went wrong');
      return;
    }
    // A reset signs out every session, so log straight back in with the new password.
    const signIn = await authClient.signIn.email({ email, password });
    setSubmitting(false);
    if (signIn.error) {
      setError(signIn.error.message ?? 'Password reset, but logging in failed');
      return;
    }
    onSuccess();
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    setResending(true);
    const { error } = await authClient.emailOtp.requestPasswordReset({ email });
    setResending(false);
    if (error) setError(error.message ?? 'Something went wrong');
    else {
      setCode('');
      setNotice('A new code is on its way.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <Field label="Code" htmlFor="reset-code">
          <Input
            id="reset-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            autoFocus
            placeholder="123456"
            className="text-center text-2xl tracking-[0.5em]"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </Field>
        <Field label="New password" htmlFor="reset-password">
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        {notice && <p className="text-sm text-ink-muted">{notice}</p>}
      </div>
      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" disabled={submitting}>
          Reset Password
        </Button>
        <button type="button" onClick={handleResend} disabled={resending} className="text-center text-sm text-ink-muted">
          Didn’t get it? <span className="font-semibold text-accent">Send a new code</span>
        </button>
      </div>
    </form>
  );
}

/**
 * Dev-only panel for signing in as one of the mock users in
 * packages/shared/mock-users.ts. Creates the account the first time.
 * Renders nothing in production builds.
 */
export function DevUserSwitcher({ currentEmail, onSignedIn }: { currentEmail?: string | null; onSignedIn: () => void }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!import.meta.env.DEV) return null;

  async function switchTo(user: MockUser) {
    setError(null);
    setPending(user.email);
    try {
      if (currentEmail) await authClient.signOut();
      const signIn = await authClient.signIn.email({ email: user.email, password: MOCK_USER_PASSWORD });
      if (!signIn.error) return onSignedIn();
      const signUp = await authClient.signUp.email({
        email: user.email,
        password: MOCK_USER_PASSWORD,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      if (signUp.error) setError(signUp.error.message ?? signIn.error.message ?? 'Could not sign in');
      else onSignedIn();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-6 flex w-full flex-col gap-2 rounded-2xl border border-dashed border-line p-3">
      <p className="text-xs font-semibold tracking-wider text-slate uppercase">Dev · sign in as</p>
      <div className="flex flex-wrap gap-2">
        {MOCK_USERS.map(user => {
          const isCurrent = user.email === currentEmail;
          return (
            <button
              key={user.email}
              type="button"
              className={cn(
                'rounded-pill border border-line px-3 py-1.5 text-[13px] disabled:opacity-35',
                isCurrent ? 'bg-ink text-paper' : 'text-ink hover:bg-fill',
              )}
              disabled={pending !== null || isCurrent}
              onClick={() => switchTo(user)}
            >
              {pending === user.email ? '…' : user.firstName}
            </button>
          );
        })}
      </div>
      {error && <p className="text-[13px] text-destructive">{error}</p>}
    </div>
  );
}
