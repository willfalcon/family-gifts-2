import { createFileRoute, useRouter, Link } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { authClient } from '../lib/auth-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BigTitle } from '@/components/ui/big-title';
import { Wordmark } from '@/components/ui/wordmark';

export const Route = createFileRoute('/login')({
  component: RouteComponent,
});

function RouteComponent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      setError(error.message ?? 'Something went wrong');
      setSubmitting(false);
    } else {
      router.navigate({ to: '/dashboard' });
    }
  }

  return (
    <>
      <Wordmark />
      <div className="min-h-screen w-full flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <BigTitle title="Family Gifts" subtitle="Sign in to see your lists." />
          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <Input placeholder="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            <Input placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            <Button type="submit" disabled={submitting} className="w-full">
              Sign in
            </Button>
            {error && <p className="text-destructive text-sm">{error}</p>}
          </form>
          <p className="text-sm text-muted-foreground mt-4">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="text-accent font-semibold hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
