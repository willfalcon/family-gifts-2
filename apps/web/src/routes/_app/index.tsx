import { createFileRoute, Link } from '@tanstack/react-router';

import { Avatar } from '@/components/avatar';
import {
  GiftShoppingCard,
  GroupInvitationCards,
  InvitationCards,
  NextUp,
  NoticeCards,
  ThreadCards,
  ToDos,
} from '@/components/home';
import { Page } from '@/components/page';
import { useUser } from '@/hooks/data';
import { firstName } from '@/lib/utils';

export const Route = createFileRoute('/_app/')({
  head: () => ({ meta: [{ title: 'Home · Family Gifts' }] }),
  component: Home,
});

function Home() {
  const user = useUser();
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <Page className="gap-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground" suppressHydrationWarning>
            {today}
          </p>
          <h1 className="font-display-bold text-3xl">Hi{user ? `, ${firstName(user.name)}` : ''}</h1>
        </div>
        <Link to="/profile" aria-label="Profile" title="Profile" className="rounded-full md:hidden">
          <Avatar person={user ? { name: user.name } : undefined} size={40} />
        </Link>
      </header>
      <InvitationCards />
      <GroupInvitationCards />
      <NoticeCards />
      <ThreadCards />
      <NextUp />
      <GiftShoppingCard />
      <ToDos />
    </Page>
  );
}
