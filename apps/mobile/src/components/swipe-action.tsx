import { useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, View } from 'react-native';

import { Text } from './ui/text';

const ACTION_WIDTH = 96;

interface Props {
  children: ReactNode;
  // What the button behind the row says, e.g. "Turn off".
  label: string;
  onAction: () => void;
}

// A row you can swipe left to reveal one destructive action. Built on React
// Native's own gestures, so it needs no native dependency. Screen reader users
// get the same action from the row's actions menu.
export default function SwipeAction({ children, label, onAction }: Props) {
  const x = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);
  const [open, setOpen] = useState(false);

  function snap(toOpen: boolean) {
    openRef.current = toOpen;
    setOpen(toOpen);
    Animated.spring(x, { toValue: toOpen ? -ACTION_WIDTH : 0, useNativeDriver: true, bounciness: 0 }).start();
  }

  const responder = useRef(
    PanResponder.create({
      // Only claim clearly sideways drags, so the screen still scrolls.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const start = openRef.current ? -ACTION_WIDTH : 0;
        x.setValue(Math.min(0, Math.max(-ACTION_WIDTH * 1.3, start + g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        const start = openRef.current ? -ACTION_WIDTH : 0;
        snap(start + g.dx < -ACTION_WIDTH / 2 || g.vx < -0.5);
      },
      onPanResponderTerminate: () => snap(openRef.current),
    }),
  ).current;

  return (
    <View
      className="overflow-hidden"
      accessibilityActions={[{ name: 'swipeAction', label }]}
      onAccessibilityAction={e => {
        if (e.nativeEvent.actionName === 'swipeAction') onAction();
      }}
    >
      <Pressable
        accessibilityRole="button"
        className="absolute bottom-0 right-0 top-0 items-center justify-center bg-destructive"
        style={{ width: ACTION_WIDTH }}
        onPress={() => {
          snap(false);
          onAction();
        }}
      >
        <Text className="font-semibold text-white">{label}</Text>
      </Pressable>
      <Animated.View className="bg-background" style={{ transform: [{ translateX: x }] }} {...responder.panHandlers}>
        {children}
        {/* While open, a tap on the row closes it instead of opening the row. */}
        {open && <Pressable className="absolute inset-0" onPress={() => snap(false)} accessibilityLabel="Close" />}
      </Animated.View>
    </View>
  );
}
