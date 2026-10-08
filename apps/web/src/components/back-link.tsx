import type { ReactNode } from 'react';
import { Link, useCanGoBack, useRouter, type LinkProps } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type BackLinkProps = {
  /** Destination for direct entry (no history to pop) or breadcrumb mode. */
  to: LinkProps['to'];
  /** Always link to `to` instead of popping history. Use for hierarchical "up" links. */
  breadcrumb?: boolean;
  /** Label next to the chevron. Defaults to "Back". */
  children?: ReactNode;
  className?: string;
};

const baseClass = 'text-muted-foreground flex items-center gap-1';

export function BackLink({ to, breadcrumb = false, children = 'Back', className }: BackLinkProps) {
  const router = useRouter();
  const canGoBack = useCanGoBack();

  if (breadcrumb || !canGoBack) {
    return (
      <Link to={to} className={cn(baseClass, className)}>
        <ChevronLeft className="size-4" /> {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => router.history.back()} className={cn(baseClass, className)}>
      <ChevronLeft className="size-4" /> {children}
    </button>
  );
}
