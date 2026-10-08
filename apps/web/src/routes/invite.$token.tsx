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

  const emailMismatch = !!user && !!effectivePreview && user.email.toLowerCase() !== effectivePreview.email.toLowerCase();
  const displayName = effectivePreview?.kind === 'group' ? effectivePreview.groupName : effectivePreview?.eventName;

  // Auto-join: a logged-in user whose account matches the invited email
  // shouldn't need an extra click to accept - land straight on the destination.
  useEffect(() => {
    if (!user || !preview || emailMismatch || accepted.current) return;
    accepted.current = true;
    acceptInvite
      .mutateAsync({ token })
      .then(result => navigate(destinationFor(result)))
      .catch(e => setError(acceptInviteErrorMessage(e)));
  }, [user, preview, emailMismatch, token]);

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
        <BigTitle title="Wrong account" subtitle={`This invite was sent to ${effectivePreview.email}. Sign out and sign back in with that email to accept it.`} />
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
    return <InviteAuthForm token={token} email={effectivePreview.email} displayName={displayName!} />;
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

  return (
    <div className="flex flex-col items-center gap-3 mt-24">
      <Spinner className="size-6 text-muted-foreground" />
      <p className="text-muted-foreground">Joining {displayName}…</p>
    </div>
  );
}

interface InviteAuthFormProps {
  token: string;
  email: string;
  displayName: string;
}

function InviteAuthForm({ token, email, displayName }: InviteAuthFormProps) {
  const navigate = useNavigate();
  const acceptInvite = useMutation({ mutationFn: useConvexMutation(api.invites.accept) });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: authError } = name
      ? await authClient.signUp.email({ email, password, name })
      : await authClient.signIn.email({ email, password });
    if (authError) {
      setError(authError.message ?? 'Something went wrong');
      setSubmitting(false);
      return;
    }

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
      <BigTitle title={`Join ${displayName}`} subtitle={`Sign in, or fill in a name to create an account with ${email}.`} />
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input placeholder="name (sign up only)" value={name} onChange={e => setName(e.target.value)} />
        <Input value={email} readOnly disabled />
        <Input placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <Button type="submit" disabled={submitting} className="w-full">
          {name ? 'Sign up & join' : 'Sign in & join'}
        </Button>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </form>
    </div>
  );
}
