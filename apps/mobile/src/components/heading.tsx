import { cn } from '@/lib/utils';
import { ReactNode } from 'react';
import { Text } from './ui/text';

interface Props {
  children: ReactNode;
  className?: string;
}

export default function Heading({ children, className }: Props) {
  return <Text className={cn('font-display-semibold text-xl', className)}>{children}</Text>;
}
