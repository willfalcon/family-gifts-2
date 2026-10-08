import { createFileRoute, Link } from '@tanstack/react-router';

import { authClient } from '../lib/auth-client';
import { BigTitle } from '@/components/ui/big-title';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/ui/wordmark';
import { Spinner } from '@/components/ui/spinner';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const { data: session, isPending } = authClient.useSession();

  return (
    <>
      <Wordmark />
      <div className="min-h-screen w-full flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <BigTitle title="Family Gifts" subtitle="Wishlists your family can actually coordinate around." />
          {isPending ? (
            <Spinner className="size-6 text-muted-foreground mx-auto mt-2" />
          ) : (
            <Button asChild className="mt-2">
              <Link to={session ? '/dashboard' : '/login'}>{session ? 'Go to lists' : 'Sign in'}</Link>
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
