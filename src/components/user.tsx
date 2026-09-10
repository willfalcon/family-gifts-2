'use client';

import { ChevronDown, Settings, LogOut, User as UserIcon } from 'lucide-react';

import { cn, initials } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Link, useRouter } from '@tanstack/react-router';
import { authClient } from '@/lib/auth-client';
import { useCurrentUser } from '@/hooks/auth';
import { Avatar, AvatarFallback } from './ui/avatar';

export type AccountUser = {
  id: string;
  name: string;
  initials: string;
  color: string;
};

export default function User() {
  const router = useRouter();
  const handleSignout = () => {
    authClient.signOut();
    router.navigate({ to: '/login' });
  };
  const { user } = useCurrentUser();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="fixed top-5 right-7 z-20">
        <button
          className={cn(
            'group flex items-center gap-2 rounded-pill border border-white/45 bg-white/50',
            'backdrop-blur-glass py-1.25 pl-1.25 pr-2.5 shadow-glass outline-none',
            'data-[state=open]:bg-white/70'
          )}
        >
          <Avatar size="sm">
            <AvatarFallback>{user && initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="font-body text-[13.5px] font-semibold text-ink">{user?.name}</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <div className="flex items-center gap-2.5 px-2.5 pb-3 pt-2">
          <Avatar>
            <AvatarFallback>{user && initials(user.name)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-display text-[15px] font-semibold text-ink">Will Hawks</div>
            <div className="font-body text-xs text-slate">Signed in</div>
          </div>
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to="/dashboard/profile">
            <UserIcon className="size-3.75" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/dashboard/settings">
            <Settings className="size-3.75" />
            Settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        {/* 
        <DropdownMenuLabel>Switch user (for testing)</DropdownMenuLabel>
        <DropdownMenuRadioGroup
        // value={currentUserId}
        // onValueChange={onUserChange}
        >
          {users.map((u) => (
            <DropdownMenuRadioItem key={u.id} value={u.id} className="pl-8">
              <span className="flex items-center gap-2.5">
                <Avatar user={u} size={20} />
                {u.name}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup> */}

        <DropdownMenuItem variant="destructive" onClick={handleSignout}>
          <LogOut className="size-3.75" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
