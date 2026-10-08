import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
}
export default function Heading({ children, className }: Props) {
  return <h3 className={cn('font-display font-semibold text-xl', className)}>{children}</h3>;
}
