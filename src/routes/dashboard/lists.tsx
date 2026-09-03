import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { api } from '../../../convex/_generated/api';
import { authClient } from '../../lib/auth-client';
import { useRouter } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BigTitle } from '@/components/ui/big-title';

export const Route = createFileRoute('/dashboard/lists')({
  component: Lists,
});

function Lists() {
  const { data: lists, isPending } = useQuery(convexQuery(api.lists.myLists, {}));
  const createList = useMutation({ mutationFn: useConvexMutation(api.lists.create) });
  const [title, setTitle] = useState('');
  const router = useRouter();
  return (
    <div>
      <BigTitle title="Lists" subtitle="Things you want, organized by occasion." />

      <Button
        type="button"
        onClick={() => {
          authClient.signOut();
          router.navigate({ to: '/login' });
        }}
      >
        Sign out
      </Button>

      <form
        onSubmit={e => {
          e.preventDefault();
          if (!title) return;
          createList.mutate({ title });
          setTitle('');
        }}
      >
        <Input placeholder="new list" value={title} onChange={e => setTitle(e.target.value)} />
        <Button type="submit">Add</Button>
      </form>

      {isPending ? (
        <p>Loading lists…</p>
      ) : (
        <ul>
          {lists?.map(l => (
            <li key={l._id}>{l.title}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
