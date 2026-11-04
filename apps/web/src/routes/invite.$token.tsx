import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery, useMutation } from '@tanstack/react-query';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { ConvexError } from 'convex/values';
import { api } from '@convex/_generated/api';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';
import { BigTitle } from '@/components/ui/big-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { fullName } from '@convex/names';
import { Spinner } from '@/components/ui/spinner';

// acceptInvite throws ConvexError for its user-facing failures (invalid invite,
// wrong account) - a plain Error's message would be redacted to "Server Error"
// by Convex before it reaches the client.
function acceptInviteErrorMessage(e: unknown) {
  if (e instanceof ConvexError && typeof e.data === 'string') return e.data;
  return 'Something went wrong';
}

// A token could be for a group or an event invite - this resolves either into
// the route/params to land on after accepting.
function destinationFor(result: { kind: 'group'; id: string } | { kind: 'event'; id: string }) {
  return result.kind === 'group'
    ? ({ to: '/dashboard/groups/$id', params: { id: result.id } } as const)
    : ({ to: '/dashboard/events/$id', params: { id: result.id } } as const);
}

export const Route = createFileRoute('/invite/$token')({
  component: InvitePage,
  loader: async ({ context, params }) => {
    await context.queryClient.query({
      ...convexQuery(api.invites.getPreview, { token: params.token }),
      staleTime: 'static',
    });
    await context.queryClient.query({
      ...convexQuery(api.auth.getCurrentUser, {}),
      staleTime: 'static',
    });
  },
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { data: preview } = useSuspenseQuery(convexQuery(api.invites.getPreview, { token }));
  const { data: user } = useSuspenseQuery(convexQuery(api.auth.getCurrentUser, {}));
  const acceptInvite = useMutation({ mutationFn: useConvexMutation(api.invites.accept) });
  const [error, setError] = useState<string | null>(null);
  const accepted = useRef(false);

  // Accepting flips the invite's status server-side, which makes this reactive
  // query go null before navigate() (below) gets a chance to unmount the page -
  // keep the last real preview around so that moment doesn't flash "Invite not
  // found" instead of the joining spinner.
  const lastPreview = useRef<typeof preview>(null);
  if (preview) lastPreview.current = preview;
  const effectivePreview = preview ?? lastPreview.current;

  // A group's shareable join link has no invited email - any account can use it.
  const invitedEmail = effectivePreview && 'email' in effectivePreview ? effectivePreview.email : null;
  const emailMismatch = !!user && !!invitedEmail && user.email.toLowerCase() !== invitedEmail.toLowerCase();
  // Events ask "Going or can't go?" first; groups just join.
  const isEvent = effectivePreview?.kind === 'event' || effectivePreview?.kind === 'eventLink';
  const displayName = effectivePreview
    ? 'eventName' in effectivePreview
      ? effectivePreview.eventName
      : effectivePreview.groupName
    : undefined;
  const [answering, setAnswering] = useState(false);

  async function answer(status: 'going' | 'declined') {
    setAnswering(true);
    try {
      const result = await acceptInvite.mutateAsync({ token, status });
      navigate(destinationFor(result));
    } catch (e) {
      setError(acceptInviteErrorMessage(e));
      setAnswering(false);
    }
  }

  // Auto-join for groups: a logged-in user whose account matches the invited
  // email shouldn't need an extra click to accept - land straight on the group.
  useEffect(() => {
    if (!user || !preview || emailMismatch || isEvent || accepted.current) return;
    accepted.current = true;
    acceptInvite
      .mutateAsync({ token })
      .then(result => navigate(destinationFor(result)))
      .catch(e => setError(acceptInviteErrorMessage(e)));
  }, [user, preview, emailMismatch, isEvent, token]);

  if (!effectivePreview) {
    return (
      <div className="max-w-sm mx-auto mt-16">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Invite not found</EmptyTitle>
            <EmptyDescription>This invite link is invalid or has already been used.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (emailMismatch) {
    return (
      <div className="max-w-sm mx-auto mt-16 space-y-4 text-center">
        <BigTitle
          title="Wrong account"
          subtitle={`This invite was sent to ${invitedEmail}. Sign out and sign back in with that email to accept it.`}
        />
        <Button
          onClick={async () => {
            await authClient.signOut();
            navigate({ to: '/invite/$token', params: { token } });
          }}
        >
          Sign out
        </Button>
      </div>
    );
  }

  if (!user) {
    return (
      <InviteAuthForm token={token} invitedEmail={invitedEmail} displayName={displayName!} acceptOnAuth={!isEvent} />
    );
  }

  if (error) {
    return (
      <div className="max-w-sm mx-auto mt-16">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Couldn&apos;t join {displayName}</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (isEvent && !answering) {
    return (
      <div className="max-w-sm mx-auto mt-16 space-y-4 text-center">
        <BigTitle title={`You're invited to ${displayName}`} subtitle="Can you make it? You can change your answer later." />
        <div className="flex justify-center gap-2">
          <Button onClick={() => answer('going')}>Going</Button>
          <Button variant="outline" onClick={() => answer('declined')}>
            Can&apos;t go
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 mt-24">
      <Spinner className="size-6 text-muted-foreground" />
      <p className="text-muted-foreground">Joining {displayName}…</p>
    </div>
  );
}

interface InviteAuthFormProps {
  token: string;
  // Null for a join link, where the person types their own email.
  invitedEmail: string | null;
  displayName: string;
  // Groups join as soon as you're signed in. Events don't: once signed in,
  // the page re-renders with the Going / Can't go choice.
  acceptOnAuth: boolean;
}

function InviteAuthForm({ token, invitedEmail, displayName, acceptOnAuth }: InviteAuthFormProps) {
  const navigate = useNavigate();
  const acceptInvite = useMutation({ mutationFn: useConvexMutation(api.invites.accept) });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(invitedEmail ?? '');
  // Filling in a name means signing up rather than in.
  const signingUp = firstName.trim() !== '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: authError } = signingUp
      ? await authClient.signUp.email({
          email,
          password,
          name: fullName(firstName, lastName),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        })
      : await authClient.signIn.email({ email, password });
    if (authError) {
      setError(authError.message ?? 'Something went wrong');
      setSubmitting(false);
      return;
    }
    if (!acceptOnAuth) return;

    try {
      const result = await acceptInvite.mutateAsync({ token });
      navigate(destinationFor(result));
    } catch (e) {
      setError(acceptInviteErrorMessage(e));
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16 space-y-4">
      <BigTitle
        title={`Join ${displayName}`}
        subtitle={
          invitedEmail
            ? `Sign in, or fill in a name to create an account with ${invitedEmail}.`
            : 'Sign in, or fill in a name to create an account.'
        }
      />
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-3">
          <Input
            placeholder="first name (sign up only)"
            autoComplete="given-name"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
          />
          <Input
            placeholder="last name"
            autoComplete="family-name"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
          />
        </div>
        {invitedEmail ? (
          <Input value={email} readOnly disabled />
        ) : (
          <Input placeholder="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        )}
        <Input
          placeholder="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <Button type="submit" disabled={submitting} className="w-full">
          {acceptOnAuth ? (signingUp ? 'Sign up & join' : 'Sign in & join') : signingUp ? 'Sign up' : 'Sign in'}
        </Button>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </form>
    </div>
  );
}
