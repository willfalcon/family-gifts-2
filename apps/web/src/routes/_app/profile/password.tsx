import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';

import { showAlert } from '@/components/alerts';
import { confirmPassword, ErrorText, Field, ResetPasswordForm } from '@/components/auth-forms';
import { SheetPage, useGoBack } from '@/components/page';
import { Input } from '@/components/ui/input';
import { useUser } from '@/hooks/data';
import { authClient } from '@/lib/auth-client';

export const Route = createFileRoute('/_app/profile/password')({
  head: () => ({ meta: [{ title: 'Change Password · Family Gifts' }] }),
  component: ChangePassword,
});

// Change your password with the current one, or ("Forgot it?") with a code
// emailed to you, like mobile's change-password and change-password/reset.
function ChangePassword() {
  const goBack = useGoBack('/profile');
  const user = useUser();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [resetting, setResetting] = useState(false);

  function done() {
    goBack();
    showAlert('Password changed', 'You’ve been signed out on your other devices.');
  }

  async function forgotPassword() {
    if (!user?.email) return;
    setError(null);
    setSendingCode(true);
    const { error } = await authClient.emailOtp.requestPasswordReset({ email: user.email });
    setSendingCode(false);
    if (error) {
      setError(error.message ?? 'Something went wrong. Try again.');
      return;
    }
    setResetting(true);
  }

  async function save(e?: FormEvent) {
    e?.preventDefault();
    if (!current || !next) {
      setError('Enter your current password and a new one.');
      return;
    }
    if (current === next) {
      setError('That’s your current password. Choose a new one.');
      return;
    }
    setError(null);
    setSaving(true);
    if (!(await confirmPassword(next))) {
      setSaving(false);
      return;
    }
    // Keeps this browser signed in and signs out everywhere else, like a reset.
    const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setSaving(false);
    if (error) {
      setError(error.code === 'INVALID_PASSWORD' ? 'Your current password is incorrect.' : (error.message ?? 'Something went wrong. Try again.'));
      return;
    }
    done();
  }

  if (resetting) {
    return (
      <SheetPage title="Reset Password" cancelIcon="back" onCancel={() => setResetting(false)}>
        <p className="text-[15px] text-muted-foreground">
          We’ve emailed a 6-digit code to <span className="font-semibold">{user?.email}</span>. It expires in 5 minutes.
        </p>
        {user?.email && <ResetPasswordForm email={user.email} onSuccess={done} />}
      </SheetPage>
    );
  }

  return (
    <SheetPage title="Change Password" action={{ label: 'Save', form: 'change-password', disabled: saving }}>
      <form id="change-password" onSubmit={save} className="flex flex-col gap-6">
        {/* Lets password managers match the account. */}
        <input type="email" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
        <div className="flex flex-col gap-1.5">
          <Field label="Current password" htmlFor="current-password">
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              placeholder="Current password"
              autoFocus
              value={current}
              onChange={e => setCurrent(e.target.value)}
            />
          </Field>
          <button type="button" className="self-end pt-1 text-sm font-semibold text-accent" onClick={forgotPassword} disabled={sendingCode}>
            {sendingCode ? 'Sending code…' : 'Forgot it?'}
          </button>
        </div>
        <Field label="New password" htmlFor="new-password">
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            value={next}
            onChange={e => setNext(e.target.value)}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        <p className="text-sm text-ink-muted">Changing your password signs you out on your other devices. You’ll stay signed in here.</p>
      </form>
    </SheetPage>
  );
}
