import { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from './ui/text';

type Props = {
  title?: string;
  subtitle?: string | ReactNode;
  children?: ReactNode;
  className?: string;
};

export function BigTitle({ title, subtitle, children, className }: Props) {
  return (
    <View className={className}>
      <Text className="font-display-bold text-ink tracking-tight text-4xl">{title ?? children}</Text>
      {subtitle && <Text className="text-sm text-slate">{subtitle}</Text>}
    </View>
  );
}
