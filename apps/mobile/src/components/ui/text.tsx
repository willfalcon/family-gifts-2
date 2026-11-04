import { cn, pretty as prettyText } from '@/lib/utils';
import { Slot } from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Text as RNText, type Role } from 'react-native';

const textVariants = cva('text-base text-ink', {
  variants: {
    variant: {
      default: '',
      detail: 'text-detail font-display-bold leading-[1.1]',
      h1: 'text-center text-4xl font-extrabold tracking-tight',
      h2: 'border-b border-border pb-2 text-3xl font-semibold tracking-tight',
      h3: 'text-2xl font-semibold tracking-tight',
      h4: 'text-xl font-semibold tracking-tight',
      p: 'mt-3 leading-7 sm:mt-6',
      blockquote: 'mt-4 border-l-2 pl-3 italic sm:mt-6 sm:pl-6',
      code: 'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold',
      lead: 'text-xl text-muted-foreground',
      large: 'text-lg font-semibold',
      small: 'text-sm font-medium leading-none',
      muted: 'text-sm text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps['variant']>;

const ROLE: Partial<Record<TextVariant, Role>> = {
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  blockquote: Platform.select({ web: 'blockquote' as Role }),
  code: Platform.select({ web: 'code' as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  h1: '1',
  h2: '2',
  h3: '3',
  h4: '4',
};

// React Native can't pick a weight within a custom font family: each loaded
// weight is its own family (Fraunces_700Bold etc.), so `font-bold` alone does
// nothing to Fraunces. When a display font and a weight class are combined,
// swap in the family for that weight. Only 500/600/700 are loaded.
const DISPLAY_WEIGHT_CLASS: Record<string, string> = {
  'font-thin': 'font-display-medium',
  'font-extralight': 'font-display-medium',
  'font-light': 'font-display-medium',
  'font-normal': 'font-display-medium',
  'font-medium': 'font-display-medium',
  'font-semibold': 'font-display-semibold',
  'font-bold': 'font-display-bold',
  'font-extrabold': 'font-display-bold',
  'font-black': 'font-display-bold',
};
const DISPLAY_FAMILY = /^font-display(-medium|-semibold|-bold)?$/;

function resolveDisplayWeight(className: string) {
  const classes = className.split(/\s+/);
  if (!classes.some(c => DISPLAY_FAMILY.test(c))) return className;
  const weight = classes.findLast(c => c in DISPLAY_WEIGHT_CLASS);
  if (!weight) return className;
  // Drop the weight class too, so Android doesn't fake-bold an already bold font.
  const rest = classes.filter(c => !DISPLAY_FAMILY.test(c) && !(c in DISPLAY_WEIGHT_CLASS));
  return [...rest, DISPLAY_WEIGHT_CLASS[weight]].join(' ');
}

// Only the last string child can hold the paragraph's final words.
function prettyChildren(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string') return prettyText(children);
  if (!Array.isArray(children)) return children;
  const last = children.length - 1;
  return typeof children[last] === 'string'
    ? [...children.slice(0, last), prettyText(children[last])]
    : children;
}

const TextClassContext = React.createContext<string | undefined>(undefined);

function Text({
  className,
  asChild = false,
  variant = 'default',
  pretty = false,
  children,
  ...props
}: React.ComponentProps<typeof RNText> &
  React.RefAttributes<typeof RNText> &
  TextVariantProps & {
    asChild?: boolean;
    /** Avoid a lone word on the last line, like CSS `text-wrap: pretty`. */
    pretty?: boolean;
  }) {
  const textClass = React.useContext(TextClassContext);
  const Component = asChild ? Slot : RNText;
  return (
    <Component
      className={resolveDisplayWeight(cn(textVariants({ variant }), textClass, className))}
      role={variant ? ROLE[variant] : undefined}
      aria-level={variant ? ARIA_LEVEL[variant] : undefined}
      // push-out alone doesn't reliably stop orphans (e.g. short centered
      // text), so the non-breaking space is applied on every platform too.
      lineBreakStrategyIOS={pretty ? 'push-out' : undefined}
      {...props}>
      {pretty ? prettyChildren(children) : children}
    </Component>
  );
}

export { Text, TextClassContext };
