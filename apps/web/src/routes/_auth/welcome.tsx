import { createFileRoute, Link } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';

// The landing page for signed-out visitors.
export const Route = createFileRoute('/_auth/welcome')({
  head: () => ({ meta: [{ title: 'Family Gifts' }] }),
  component: Welcome,
});

function Welcome() {
  const { redirect } = Route.useSearch();
  return (
    <div className="flex flex-1 flex-col">
      <img src="/landing-graphic.svg" alt="" className="mt-12 w-full sm:mt-20" style={{ aspectRatio: '390 / 230' }} />
      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <h1 className="font-display-bold text-4xl text-ink">Family Gifts</h1>
        <p className="max-w-xs text-[17px] text-ink-muted">
          Wish lists for the people you love. Claim a gift without spoiling the surprise.
        </p>
      </div>
      <div className="mt-auto flex w-full max-w-xs flex-col gap-3 self-center pt-10">
        <Button asChild size="lg" className="h-12">
          <Link to="/sign-in" search={{ mode: 'signUp', redirect }}>
            Create Account
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg" className="h-12">
          <Link to="/sign-in" search={{ mode: 'signIn', redirect }}>
            Log In
          </Link>
        </Button>
        <p className="text-center text-xs text-ink-muted">By continuing you agree to the Terms and Privacy Policy.</p>
      </div>
    </div>
  );
}
