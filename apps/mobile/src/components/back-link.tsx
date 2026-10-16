import type { ReactNode } from 'react';
// import { Link, useCanGoBack, useRouter, type LinkProps } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { useRouter } from 'expo-router';
import { Text } from './ui/text';
import { Button } from './ui/button';

type BackLinkProps = {
  /** Label next to the chevron. Defaults to "Back". */
  children?: ReactNode;
  className?: string;
};

export function BackLink({ children = 'Back', className }: BackLinkProps) {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      className={cn('self-start -ml-2 flex-row items-center gap-1', className)}
    >
      <ChevronLeft className="size-4 text-muted-foreground" />
      <Text className="text-muted-foreground">{children}</Text>
    </Button>
  );
}
