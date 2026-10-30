import type { ReactNode } from 'react';
// import { Link, useCanGoBack, useRouter, type LinkProps } from '@tanstack/react-router';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import GlassButton from './glass-button';
import { Icon } from './ui/icon';

type BackLinkProps = {
  /** Label next to the chevron. Defaults to "Back". */
  children?: ReactNode;
  className?: string;
};

export function BackButton({ children = 'Back', className }: BackLinkProps) {
  const router = useRouter();

  return (
    <GlassButton
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      accessibilityLabel="Go back"
    >
      <Icon as={ChevronLeft} />
    </GlassButton>
  );
}
