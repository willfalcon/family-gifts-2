import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '../lib/auth-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/login')({
  component: RouteComponent,
});

function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <form
      onSubmit={async e => {
        e.preventDefault();
        setError(null);
        const fn = name ? authClient.signUp.email({ email, password, name }) : authClient.signIn.email({ email, password });
        const { error } = await fn;
        if (error) {
          setError(error.message ?? 'Something went wrong');
        } else {
          router.navigate({ to: '/dashboard' });
        }
      }}
    >
      <h1>Family Gifts</h1>
      <p>Sign in, or fill in a name to create an account.</p>
      <div>
        <Input placeholder="name (sign up only)" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div>
        <Input placeholder="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <div>
        <Input placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      </div>
      <Button type="submit">{name ? 'Sign up' : 'Sign in'}</Button>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </form>
  );
}

function RouteComponent() {
  return (
    <div>
      <p>Login</p>
      <SignIn />
    </div>
  );
}
