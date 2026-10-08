import { createFileRoute, useRouter, Link } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { authClient } from '../lib/auth-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BigTitle } from '@/components/ui/big-title';
import { Wordmark } from '@/components/ui/wordmark';

export const Route = createFileRoute('/signup')({
  component: RouteComponent,
});

function RouteComponent() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await authClient.signUp.email({ email, password, name });
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
          <BigTitle title="Family Gifts" subtitle="Create an account to start a list." />
          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <Input placeholder="name" value={name} onChange={e => setName(e.target.value)} required />
            <Input placeholder="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            <Input placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            <Button type="submit" disabled={submitting} className="w-full">
              Sign up
            </Button>
            {error && <p className="text-destructive text-sm">{error}</p>}
          </form>
          <p className="text-sm text-muted-foreground mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-accent font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
