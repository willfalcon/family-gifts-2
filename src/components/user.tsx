"use client";

import * as React from "react";
import { ChevronDown, Settings, LogOut, User as UserIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

export type AccountUser = {
  id: string;
  name: string;
  initials: string;
  color: string;
};

function Avatar({ size = 26 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-body font-semibold bg-ink text-paper"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
      }}
    >
      WH
    </div>
  );
}

export default function User({
  // users,
  // currentUserId,
  // onUserChange,
  onProfileClick,
  onSettingsClick,
  onSignOut,
}: {
  // users: AccountUser[];
  // currentUserId: string;
  // onUserChange: (id: string) => void;
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
  onSignOut?: () => void;
}) {
  // const current = users.find((u) => u.id === currentUserId) ?? users[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="fixed top-5 right-7 z-20">
        <button
          className={cn(
            "group flex items-center gap-2 rounded-pill border border-white/45 bg-white/50",
            "backdrop-blur-glass py-[5px] pl-[5px] pr-2.5 shadow-glass outline-none",
            "data-[state=open]:bg-white/70",
          )}
        >
          <Avatar />
          <span className="font-body text-[13.5px] font-semibold text-ink">
            Will Hawks
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <div className="flex items-center gap-2.5 px-2.5 pb-3 pt-2">
          <Avatar size={34} />
          <div>
            <div className="font-display text-[15px] font-semibold text-ink">
              Will Hawks
            </div>
            <div className="font-body text-xs text-slate">Signed in</div>
          </div>
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onProfileClick}>
          <UserIcon className="h-[15px] w-[15px]" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSettingsClick}>
          <Settings className="h-[15px] w-[15px]" />
          Settings
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

        <DropdownMenuItem variant="destructive" onClick={onSignOut}>
          <LogOut className="h-[15px] w-[15px]" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
