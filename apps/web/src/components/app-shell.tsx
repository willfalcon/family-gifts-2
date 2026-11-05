import type { ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { Calendar, Gift, House, Users } from 'lucide-react';

import { api } from '@convex/_generated/api';
import { useMyEventInvites, useMyGroupInvites, useUser } from '@/hooks/data';
import { Avatar } from '@/components/avatar';
import { cn } from '@/lib/utils';

type Tab = {
  to: '/' | '/lists' | '/people' | '/events';
  label: string;
  icon: typeof House;
  // Paths that count as being in this tab.
  prefixes: string[];
  badge: number;
};

// Mobile's four tabs. A bottom tab bar on phones, a top bar from `md` up.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const user = useUser();
  // Same badges as mobile: unread messages on Home, invites on People and Events.
  const unreadCount = useQuery(api.threads.unreadCount) ?? 0;
  const groupInviteCount = useMyGroupInvites()?.length ?? 0;
  const eventInviteCount = useMyEventInvites()?.length ?? 0;

  const tabs: Tab[] = [
    { to: '/', label: 'Home', icon: House, prefixes: ['/shopping', '/messages', '/profile'], badge: unreadCount },
    { to: '/lists', label: 'My Lists', icon: Gift, prefixes: ['/lists'], badge: 0 },
    { to: '/people', label: 'People', icon: Users, prefixes: ['/people', '/groups'], badge: groupInviteCount },
    { to: '/events', label: 'Events', icon: Calendar, prefixes: ['/events'], badge: eventInviteCount },
  ];
  const isActive = (tab: Tab) =>
    tab.to === '/' ? pathname === '/' || tab.prefixes.some(p => pathname.startsWith(p)) : tab.prefixes.some(p => pathname.startsWith(p));

  return (
    <div className="min-h-dvh">
      {/* Desktop top bar */}
      <header className="sticky top-0 z-40 hidden border-b border-line bg-background/85 backdrop-blur md:block">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-6">
          <Link to="/" className="font-display-bold text-xl tracking-tight text-ink">
            Family Gifts
          </Link>
          <nav className="flex flex-1 items-center gap-1" aria-label="Main">
            {tabs.map(tab => (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  'relative flex items-center gap-2 rounded-pill px-4 py-2 text-[15px] font-semibold transition-colors',
                  isActive(tab) ? 'bg-secondary text-accent' : 'text-ink-muted hover:text-ink',
                )}
              >
                <tab.icon className="size-[18px]" />
                {tab.label}
                <Badge count={tab.badge} />
              </Link>
            ))}
          </nav>
          <Link to="/profile" aria-label="Profile" title="Profile" className="rounded-full">
            <Avatar person={user ? { name: user.name } : undefined} size={36} />
          </Link>
        </div>
      </header>

      {children}

      {/* Phone tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
          {tabs.map(tab => {
            const active = isActive(tab);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-tab-label font-semibold',
                  active ? 'text-accent' : 'text-ink-muted',
                )}
              >
                <span className="relative">
                  <tab.icon className="size-6" />
                  <Badge count={tab.badge} className="absolute -top-1.5 -right-3" />
                </span>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function Badge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-accent px-1 text-[11px] leading-none font-bold text-accent-foreground',
        className,
      )}
    >
      <span className="sr-only">, </span>
      {count}
      <span className="sr-only"> new</span>
    </span>
  );
}
