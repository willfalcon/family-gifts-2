import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from './button';

// Mobile's page sheets (Ask for ideas, Private idea...) as a dialog: a bottom
// sheet on phones, a centered card on wider screens. The header has Cancel,
// the title and an optional primary action, like the sheets on mobile.
export function SheetDialog({
  open,
  onOpenChange,
  title,
  description,
  action,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  // The primary button on the right of the header (Send, Save, Add...).
  action?: { label: string; onClick: () => void; disabled?: boolean };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl bg-background shadow-glass outline-none',
            'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
            className,
          )}
        >
          <div className="flex items-center gap-2 p-4">
            <div className="w-20">
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon" className="glass" aria-label="Cancel">
                  <X className="size-5" />
                </Button>
              </DialogPrimitive.Close>
            </div>
            <DialogPrimitive.Title className="flex-1 text-center text-lg font-bold">{title}</DialogPrimitive.Title>
            <div className="flex w-20 justify-end">
              {action && (
                <Button onClick={action.onClick} disabled={action.disabled}>
                  {action.label}
                </Button>
              )}
            </div>
          </div>
          <DialogPrimitive.Description className="sr-only">{description ?? title}</DialogPrimitive.Description>
          <div className="flex-1 overflow-y-auto px-4 pb-8">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
