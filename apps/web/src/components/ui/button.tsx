import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';

// Mirrors apps/mobile/src/components/ui/button.tsx: accent pill by default,
// a soft fill for secondary actions.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-pill text-subhead font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-accent text-on-accent hover:bg-accent/90',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        outline: 'border border-line bg-background hover:bg-fill',
        secondary: 'bg-fill text-ink hover:bg-line',
        ghost: 'text-ink hover:bg-fill',
        link: 'px-0 text-accent font-normal hover:underline underline-offset-4',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 gap-1.5 px-3',
        lg: 'h-11 px-6 text-body',
        icon: 'size-9',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  type = 'button',
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
