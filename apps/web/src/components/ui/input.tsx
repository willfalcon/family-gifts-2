import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

const FIELD =
  'h-10 w-full min-w-0 rounded-md bg-fill px-3 text-body text-ink outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive/40';

type InputProps = React.ComponentProps<'input'> & {
  // An icon shown inside the field, before the text (search, link, $).
  prepend?: LucideIcon;
};

function Input({ className, prepend: Prepend, ...props }: InputProps) {
  if (Prepend) {
    return (
      <div
        className={cn(
          'flex h-10 w-full min-w-0 items-center rounded-md bg-fill px-3 focus-within:ring-2 focus-within:ring-ring/50',
          props.disabled && 'opacity-50',
          className,
        )}
      >
        <Prepend aria-hidden className="mr-2 size-[18px] shrink-0 text-ink-muted" />
        <input
          data-slot="input"
          className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-muted-foreground/60"
          {...props}
        />
      </div>
    );
  }
  return <input data-slot="input" className={cn(FIELD, className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(FIELD, 'h-auto min-h-20 resize-y py-2', className)} {...props} />;
}

// A native <select>, styled like the inputs. Used where mobile shows an iOS picker.
function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-9 max-w-full rounded-md bg-fill px-2 text-subhead text-ink-muted outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { Input, Textarea, Select };
