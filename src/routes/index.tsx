import { createFileRoute, Link } from '@tanstack/react-router';

import { authClient } from '../lib/auth-client';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const { data: session, isPending } = authClient.useSession();

  return (
    <div>
      <p>Landing Page</p>
      <div>{isPending ? <p>Loading...</p> : session ? <Link to="/dashboard">Go to lists</Link> : <Link to="/login">Login</Link>}</div>w
    </div>
  );
}
