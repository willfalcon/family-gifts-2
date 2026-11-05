import type { ReactNode } from 'react';
import { Link, useCanGoBack, useRouter, type LinkProps } from '@tanstack/react-router';
import { ChevronLeft, Ellipsis, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// The width every screen is laid out in. Mobile's MaxContentWidth is 800;
// pages here are narrower so text lines stay readable on a desktop.
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn('mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-4 pb-28 sm:pt-8 sm:pb-16', className)}>
      {children}
    </main>
  );
}

// Goes back in history when there's somewhere to go, otherwise to `fallback`.
export function useGoBack(fallback: LinkProps['to'] = '/') {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  return () => (canGoBack ? router.history.back() : router.navigate({ to: fallback }));
}

// Mobile's round frosted icon button.
export function GlassButton({
  label,
  children,
  className,
  ...props
}: React.ComponentProps<'button'> & { label: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      className={cn('glass shrink-0', className)}
      {...props}
    >
      {children}
    </Button>
  );
}

export function BackButton({ fallback }: { fallback?: LinkProps['to'] }) {
  const goBack = useGoBack(fallback);
  return (
    <GlassButton label="Go back" onClick={goBack}>
      <ChevronLeft className="size-5" />
    </GlassButton>
  );
}

// A detail screen's header: back, a big title, then any actions. `subtitle`
// sits under the title, lined up with it.
export function PageHeader({
  title,
  subtitle,
  actions,
  back = true,
  fallback,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: boolean;
  fallback?: LinkProps['to'];
}) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        {back && <BackButton fallback={fallback} />}
        <h1 className="min-w-0 flex-1 display-detail text-ink break-words">{title}</h1>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {subtitle && <div className={cn('text-label text-ink-muted', back && 'pl-13')}>{subtitle}</div>}
    </header>
  );
}

// A top-level tab screen's header: a large title and an add button.
export function TabHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4">
      <h1 className="font-display-bold text-4xl tracking-tight text-ink">{title}</h1>
      {action}
    </header>
  );
}

// What mobile shows as a modal: Cancel on the left, the title, and the
// primary action on the right. On desktop it's a card in the middle of the page.
export function SheetPage({
  title,
  action,
  onCancel,
  cancelIcon = 'close',
  children,
}: {
  title: string;
  // The primary action (Save, Create, Send...). Submits the page's form when
  // `form` is set; otherwise runs `onClick`.
  action?: { label: string; onClick?: () => void; form?: string; disabled?: boolean };
  onCancel?: () => void;
  cancelIcon?: 'close' | 'back' | 'none';
  children: ReactNode;
}) {
  const goBack = useGoBack();
  return (
    <main className="mx-auto w-full max-w-xl pb-28 sm:px-4 sm:pt-8 sm:pb-16">
      <div className="bg-background sm:rounded-2xl sm:border sm:border-line sm:bg-card sm:shadow-glass">
        <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/90 p-4 backdrop-blur sm:static sm:rounded-t-2xl sm:bg-transparent">
          <div className="w-20">
            {cancelIcon !== 'none' && (
              <GlassButton label={cancelIcon === 'back' ? 'Back' : 'Cancel'} onClick={onCancel ?? goBack}>
                {cancelIcon === 'back' ? <ChevronLeft className="size-5" /> : <X className="size-5" />}
              </GlassButton>
            )}
          </div>
          <h1 className="flex-1 text-center text-lg font-bold">{title}</h1>
          <div className="flex w-20 justify-end">
            {action && (
              <Button
                type={action.form ? 'submit' : 'button'}
                form={action.form}
                onClick={action.onClick}
                disabled={action.disabled}
              >
                {action.label}
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-8 px-4 pb-8">{children}</div>
      </div>
    </main>
  );
}

export interface MenuAction {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

// Mobile's "…" menus (and long-press context menus) as a dropdown. Falsy
// entries are skipped, so actions can be listed conditionally.
export function ActionsMenu({
  label,
  actions,
  className,
}: {
  label: string;
  actions: (MenuAction | false | null | undefined)[];
  className?: string;
}) {
  const shown = actions.filter((a): a is MenuAction => !!a);
  if (shown.length === 0) return null;
  const firstDestructive = shown.findIndex(a => a.destructive);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          title={label}
          className={cn('glass shrink-0', className)}
        >
          <Ellipsis className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {shown.map((action, i) => (
          <div key={action.label}>
            {i === firstDestructive && i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              variant={action.destructive ? 'destructive' : 'default'}
              disabled={action.disabled}
              onSelect={action.onSelect}
            >
              {action.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// A section of a screen with a small muted heading, like mobile's
// "Attendees · 4".
export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-2', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2">
          {title && <h2 className="text-[15px] font-semibold text-ink-muted">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// A hairline-divided row: label on the left, control on the right.
export function FieldRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line pb-2',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Footnote({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-footnote text-ink-muted', className)}>{children}</p>;
}

// A list that's empty: icon, title and a line of explanation.
export function EmptyState({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-fill">
        <Icon className="size-8 text-ink-muted" />
      </div>
      <p className="text-xl font-semibold">{title}</p>
      <p className="max-w-sm text-ink-muted text-pretty">{body}</p>
      {children}
    </div>
  );
}

// A muted line for a screen that can't show anything (missing or no access).
export function NotFound({ message }: { message: string }) {
  return (
    <Page>
      <BackButton />
      <p className="text-center text-ink-muted">{message}</p>
    </Page>
  );
}

// A link styled as a row, chevron on the right.
export function RowLink({ className, children, ...props }: LinkProps & { className?: string; children: ReactNode }) {
  return (
    <Link {...props} className={cn('flex items-center gap-3 rounded-lg hover:bg-fill/60', className)}>
      {children}
    </Link>
  );
}
