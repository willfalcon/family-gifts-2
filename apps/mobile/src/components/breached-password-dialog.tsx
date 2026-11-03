import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { ShieldAlert } from 'lucide-react-native';
import { colors } from '@family-gifts/design-tokens';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { countPasswordBreaches } from '@/lib/pwned-password';

const LEARN_MORE_URL = 'https://haveibeenpwned.com/Passwords';
const ANIMATION_SECONDS = 0.25;

// Liquid glass needs iOS 26+. Elsewhere the dialog uses a solid card.
const glassAvailable = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

// Checks a password against the breach list and, if it's been leaked, shows a
// dialog letting the user pick whether to use it anyway. Render `dialog`
// somewhere in the screen, then:
//
//   if (!(await confirmPassword(password))) return;
export function useBreachedPasswordConfirm() {
  const [visible, setVisible] = useState(false);
  const [count, setCount] = useState(0);
  const resolveRef = useRef<((useIt: boolean) => void) | null>(null);

  const confirmPassword = useCallback(async (password: string) => {
    const breaches = await countPasswordBreaches(password);
    if (breaches === 0) return true;
    setCount(breaches);
    setVisible(true);
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve;
    });
  }, []);

  const answer = (useIt: boolean) => {
    setVisible(false);
    resolveRef.current?.(useIt);
    resolveRef.current = null;
  };

  const dialog = (
    <BreachedPasswordDialog
      visible={visible}
      count={count}
      onChangePassword={() => answer(false)}
      onUseAnyway={() => answer(true)}
    />
  );

  return { confirmPassword, dialog };
}

type DialogProps = {
  visible: boolean;
  count: number;
  onChangePassword: () => void;
  onUseAnyway: () => void;
};

function BreachedPasswordDialog({ visible, count, onChangePassword, onUseAnyway }: DialogProps) {
  // The Modal stays mounted until the close animation finishes.
  const [mounted, setMounted] = useState(visible);
  // Glass doesn't render under a parent that's fading, so instead of fading
  // the Modal, the glass animates itself in and out ('none' <-> 'regular')
  // while the backdrop and the text inside the glass fade.
  const [glassOn, setGlassOn] = useState(false);
  const backdrop = useSharedValue(0);
  // Shared by the backdrop and the card's contents. The contents are children
  // of the glass, not its parent, so fading them is fine.
  const fadeStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  useEffect(() => {
    backdrop.value = withTiming(visible ? 1 : 0, { duration: ANIMATION_SECONDS * 1000 });
    if (visible) {
      setMounted(true);
      // Start from 'none' for a frame so the glass animates in.
      const frame = requestAnimationFrame(() => setGlassOn(true));
      return () => cancelAnimationFrame(frame);
    }
    setGlassOn(false);
    const timer = setTimeout(() => setMounted(false), ANIMATION_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [visible, backdrop]);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onChangePassword}>
      <View className="flex-1 items-center justify-center p-6">
        <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]}>
          <Pressable className="flex-1 bg-black/40" onPress={onChangePassword} accessible={false} />
        </Animated.View>

        <Surface on={glassOn} className="gap-6 p-6">
          {/* Only the text fades. The buttons are glass, which can't sit
              inside a fading view, so they animate their own glass instead. */}
          <Animated.View className="gap-4" style={glassAvailable ? fadeStyle : undefined}>
            <View className="items-center gap-3">
              <Icon as={ShieldAlert} size={32} className="text-destructive" />
              <Text role="heading" className="text-center text-lg font-bold text-ink">
                This password has been leaked
              </Text>
            </View>
            <Text className="text-center text-[15px] leading-5 text-ink">
              It has shown up {count.toLocaleString()} {count === 1 ? 'time' : 'times'} in known data breaches, so it's
              on lists attackers use to guess passwords. We recommend choosing a different one.{' '}
              <Text
                role="link"
                className="text-[15px] font-semibold text-accent"
                onPress={() => WebBrowser.openBrowserAsync(LEARN_MORE_URL).catch(() => {})}
              >
                Learn more about leaked passwords
              </Text>
            </Text>
          </Animated.View>
          <View className="gap-2">
            <DialogButton primary on={glassOn} fadeStyle={fadeStyle} onPress={onChangePassword}>
              Choose a Different Password
            </DialogButton>
            <DialogButton on={glassOn} fadeStyle={fadeStyle} onPress={onUseAnyway}>
              Use It Anyway
            </DialogButton>
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

// The dialog card: liquid glass when available, a solid card otherwise.
// NativeWind doesn't style GlassView, so layout classes go on an inner View.
const CARD_STYLE = { width: '100%', maxWidth: 384, borderRadius: 32 } as const;

function Surface({ on, className, children }: { on: boolean; className?: string; children: ReactNode }) {
  if (!glassAvailable) {
    return (
      <View className={cn('bg-card', className)} style={CARD_STYLE}>
        {children}
      </View>
    );
  }
  return (
    <GlassView
      style={CARD_STYLE}
      glassEffectStyle={{ style: on ? 'regular' : 'none', animate: true, animationDuration: ANIMATION_SECONDS }}
    >
      <View className={className}>{children}</View>
    </GlassView>
  );
}

type DialogButtonProps = {
  primary?: boolean;
  /** Whether the glass is showing; animates in and out like the card. */
  on: boolean;
  fadeStyle: ReturnType<typeof useAnimatedStyle>;
  onPress: () => void;
  children: string;
};

function DialogButton({ primary, on, fadeStyle, onPress, children }: DialogButtonProps) {
  if (!glassAvailable) {
    return (
      <Button variant={primary ? 'default' : 'ghost'} className="h-12" onPress={onPress}>
        <Text className={primary ? undefined : 'text-destructive'}>{children}</Text>
      </Button>
    );
  }
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <GlassView
        isInteractive
        tintColor={primary ? colors.accent : undefined}
        glassEffectStyle={{ style: on ? 'regular' : 'none', animate: true, animationDuration: ANIMATION_SECONDS }}
        style={{ height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.View style={fadeStyle}>
          <Text className={cn('text-[15px] font-semibold', primary ? 'text-on-accent' : 'text-destructive')}>
            {children}
          </Text>
        </Animated.View>
      </GlassView>
    </Pressable>
  );
}
