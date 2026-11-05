import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { Loader2 } from 'lucide-react';

import { api } from '@convex/_generated/api';
import { fullName } from '@convex/names';
import { confirmPassword, ErrorText, Field } from '@/components/auth-forms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient, reloadTo } from '@/lib/auth-client';
import { errorMessage } from '@/lib/utils';

// The page every invite link opens (emails and shareable join links). Tokens
// can be for a group or an event; invites.getPreview says which. Mobile
// doesn't need this page: links open on the web.
export const Route = createFileRoute('/invite/$token')({
  head: () => ({ meta: [{ title: 'You’re invited · Family Gifts' }] }),
  component: InvitePage,
});

type Destination = { kind: 'group'; id: string } | { kind: 'event'; id: string };

function destinationPath(result: Destination) {
  return result.kind === 'group' ? `/groups/${result.id}` : `/events/${result.id}`;
}

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-6 px-4 pt-16 pb-8">
      <img src="/gift-icon.svg" alt="" className="size-16 self-center" />
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-display-bold text-3xl tracking-tight">{title}</h1>
        {subtitle && <p className="text-[15px] text-ink-muted">{subtitle}</p>}
      </div>
      {children}
    </main>
  );
}

function InvitePage() {
  const { token } = Route.useParams();
  const preview = useQuery(api.invites.getPreview, { token });
  const user = useQuery(api.auth.getCurrentUser);
  const accept = useMutation(api.invites.accept);
  const [error, setError] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false);
  const accepted = useRef(false);

  // Accepting makes the preview go null before we've left the page; keep the
  // last real one so that moment doesn't flash "Invite not found".
  const lastPreview = useRef<typeof preview>(undefined);
  if (preview) lastPreview.current = preview;
  const shown = preview ?? lastPreview.current ?? preview;

  // A join link has no invited email: any account can use it.
  const invitedEmail = shown && 'email' in shown ? shown.email : null;
  const emailMismatch = !!user && !!invitedEmail && user.email.toLowerCase() !== invitedEmail.toLowerCase();
  // Events ask "Going or can't go?" first; groups just join.
  const isEvent = shown?.kind === 'event' || shown?.kind === 'eventLink';
  const name = shown ? ('eventName' in shown ? shown.eventName : shown.groupName) : '';

  async function answer(status: 'going' | 'declined') {
    setAnswering(true);
    try {
      reloadTo(destinationPath(await accept({ token, status })));
    } catch (e) {
      setError(errorMessage(e));
      setAnswering(false);
    }
  }

  // Signed in with the right account: join a group straight away.
  useEffect(() => {
    if (!user || !preview || emailMismatch || isEvent || accepted.current) return;
    accepted.current = true;
    accept({ token })
      .then(result => reloadTo(destinationPath(result)))
      .catch(e => setError(errorMessage(e)));
  }, [user, preview, emailMismatch, isEvent, token]);

  if (shown === undefined || user === undefined) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-ink-muted" aria-label="Loading" />
      </main>
    );
  }

  if (shown === null) {
    return <Shell title="Invite not found" subtitle="This invite link is invalid or has already been used." />;
  }

  if (emailMismatch) {
    return (
      <Shell
        title="Wrong account"
        subtitle={`This invite was sent to ${invitedEmail}. Log out and back in with that email to accept it.`}
      >
        <Button
          size="lg"
          onClick={async () => {
            await authClient.signOut();
            window.location.reload();
          }}
        >
          Log out
        </Button>
      </Shell>
    );
  }

  if (!user) return <InviteAuthForm token={token} invitedEmail={invitedEmail} name={name} joinOnAuth={!isEvent} />;

  if (error) return <Shell title={`Couldn’t join ${name}`} subtitle={error} />;

  if (isEvent && !answering) {
    return (
      <Shell title={`You’re invited to ${name}`} subtitle="Can you make it? You can change your answer later.">
        <div className="flex gap-2">
          <Button size="lg" variant="secondary" className="flex-1" onClick={() => answer('declined')}>
            Can’t go
          </Button>
          <Button size="lg" className="flex-1" onClick={() => answer('going')}>
            Going
          </Button>
        </div>
      </Shell>
    );
  }

  return <Shell title={`Joining ${name}…`} />;
}

// Log in or create an account without leaving the invite. Filling in a first
// name means creating an account.
function InviteAuthForm({
  token,
  invitedEmail,
  name,
  joinOnAuth,
}: {
  token: string;
  invitedEmail: string | null;
  name: string;
  // Groups join as soon as you're in. Events reload to ask Going / Can't go.
  joinOnAuth: boolean;
}) {
  const accept = useMutation(api.invites.accept);
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signUp');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState(invitedEmail ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const signingUp = mode === 'signUp';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    if (signingUp && !(await confirmPassword(password))) {
      setSubmitting(false);
      return;
    }
    const { error: authError } = signingUp
      ? await authClient.signUp.email({
          email,
          password,
          name: fullName(first, last),
          firstName: first.trim(),
          lastName: last.trim(),
        })
      : await authClient.signIn.email({ email, password });
    if (authError) {
      setError(authError.message ?? 'Something went wrong');
      setSubmitting(false);
      return;
    }
    if (!joinOnAuth) {
      window.location.reload();
      return;
    }
    try {
      reloadTo(destinationPath(await accept({ token })));
    } catch (e) {
      setError(errorMessage(e));
      setSubmitting(false);
    }
  }

  return (
    <Shell
      title={`Join ${name}`}
      subtitle={
        signingUp
          ? `Create an account${invitedEmail ? ` with ${invitedEmail}` : ''} to join.`
          : 'Log in to join.'
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {signingUp && (
          <div className="flex gap-3">
            <div className="flex-1">
              <Field label="First name" htmlFor="invite-first">
                <Input id="invite-first" autoComplete="given-name" required value={first} onChange={e => setFirst(e.target.value)} />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Last name" htmlFor="invite-last">
                <Input id="invite-last" autoComplete="family-name" value={last} onChange={e => setLast(e.target.value)} />
              </Field>
            </div>
          </div>
        )}
        <Field label="Email" htmlFor="invite-email">
          <Input
            id="invite-email"
            type="email"
            autoComplete="email"
            required
            readOnly={!!invitedEmail}
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="invite-password">
          <Input
            id="invite-password"
            type="password"
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" disabled={submitting}>
          {signingUp ? 'Create Account' : 'Log In'}
        </Button>
        <button type="button" className="text-center text-sm text-ink-muted" onClick={() => setMode(signingUp ? 'signIn' : 'signUp')}>
          {signingUp ? 'Already have an account? ' : 'New here? '}
          <span className="font-semibold text-accent">{signingUp ? 'Log in' : 'Create one'}</span>
        </button>
      </form>
    </Shell>
  );
}
