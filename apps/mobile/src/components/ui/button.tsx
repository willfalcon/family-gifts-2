import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { Pressable } from 'react-native';

const buttonVariants = cva(cn('group shrink-0 flex-row items-center justify-center gap-2 rounded-pill shadow-none'), {
  variants: {
    variant: {
      default: 'bg-accent',
      destructive: 'bg-destructive shadow-sm shadow-black/5 active:bg-destructive/90 dark:bg-destructive/60',
      outline:
        'border border-border bg-background shadow-sm shadow-black/5 active:bg-accent dark:border-input dark:bg-input/30 dark:active:bg-input/50',
      secondary: 'bg-fill',
      ghost: '',
      link: '',
    },
    size: {
      default: 'h-9 px-4 py-2 sm:h-9',
      sm: 'h-9 gap-1.5 rounded-md px-3 sm:h-8',
      lg: 'h-11 rounded-md px-6 sm:h-10',
      icon: 'h-9 w-9 sm:h-9 sm:w-9',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

const buttonTextVariants = cva('text-sm font-semibold text-foreground', {
  variants: {
    variant: {
      default: 'text-on-accent',
      destructive: 'text-white',
      outline: 'group-active:text-accent-foreground',
      secondary: 'text-ink',
      ghost: '',
      link: 'text-primary group-active:underline',
    },
    size: {
      default: '',
      sm: '',
      lg: 'text-[17px]',
      icon: '',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

type ButtonProps = React.ComponentProps<typeof Pressable> &
  React.RefAttributes<typeof Pressable> &
  VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <Pressable
        className={cn(props.disabled && 'opacity-50', buttonVariants({ variant, size }), className)}
        role="button"
        {...props}
      />
    </TextClassContext.Provider>
  );
}

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };
