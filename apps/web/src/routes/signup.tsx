import { createFileRoute, useRouter, Link } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { authClient } from '../lib/auth-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BigTitle } from '@/components/ui/big-title';
import { fullName } from '@convex/names';
import { Wordmark } from '@/components/ui/wordmark';

export const Route = createFileRoute('/signup')({
  component: RouteComponent,
});

function RouteComponent() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    // `name` is the full name the app shows. The parts go along too and are
    // saved on the profile (see databaseHooks in convex/auth.ts).
    const { error } = await authClient.signUp.email({
      email,
      password,
      name: fullName(firstName, lastName),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });
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
            <div className="flex gap-3">
              <Input
                placeholder="first name"
                autoComplete="given-name"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
              />
              <Input
                placeholder="last name"
                autoComplete="family-name"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
              />
            </div>
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
