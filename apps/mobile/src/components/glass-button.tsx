import { GlassView, GlassViewProps } from 'expo-glass-effect';
import { ReactNode } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

interface Props extends PressableProps {
  children: ReactNode;
  accessibilityLabel: string;
  glassProps?: GlassViewProps;
  glassStyle?: StyleProp<ViewStyle>;
}

// Spreads the remaining props onto Pressable so `<Link asChild>` can pass its onPress through.
export default function GlassButton({ children, glassProps, glassStyle, ...props }: Props) {
  return (
    <Pressable accessibilityRole="button" hitSlop={8} {...props}>
      <GlassView
        isInteractive
        style={[
          {
            width: 36,
            height: 36,
            borderRadius: 999,
            justifyContent: 'center',
            alignItems: 'center',
          },
          glassStyle,
        ]}
        {...glassProps}
      >
        {children}
      </GlassView>
    </Pressable>
  );
}
