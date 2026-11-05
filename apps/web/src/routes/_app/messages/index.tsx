import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';

import { api } from '@convex/_generated/api';
import { Page, PageHeader } from '@/components/page';
import { ThreadRow } from '@/components/threads';
import { localToday } from '@/lib/utils';

export const Route = createFileRoute('/_app/messages/')({
  head: () => ({ meta: [{ title: 'Messages · Family Gifts' }] }),
  component: Threads,
});

// Every Thread you're in, newest first.
function Threads() {
  const threads = useQuery(api.threads.mine, { today: localToday() });
  return (
    <Page className="gap-6">
      <PageHeader title="Messages" />
      <div className="flex flex-col gap-2">
        {threads?.length === 0 && <p className="text-ink-muted">No messages yet.</p>}
        {threads?.map(thread => (
          <ThreadRow key={thread._id} thread={thread} />
        ))}
      </div>
    </Page>
  );
}
