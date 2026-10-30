import { useRef } from 'react';
import type { GestureResponderEvent } from 'react-native';

// How far (in points) the finger can move before a touch counts as a swipe instead of a tap.
const TAP_SLOP = 10;

// Press handlers for a Pressable inside a swipeable row. The native swipe moves
// the row along with the finger, so React Native never sees the touch leave the
// row and would treat a partial swipe as a tap. This tracks the start point in
// screen coordinates and ignores the press if the finger traveled.
export function useRowTap(onTap: () => void) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  return {
    onPressIn: (e: GestureResponderEvent) => {
      touchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    },
    onPress: (e: GestureResponderEvent) => {
      const start = touchStart.current;
      touchStart.current = null;
      if (
        start &&
        (Math.abs(e.nativeEvent.pageX - start.x) > TAP_SLOP || Math.abs(e.nativeEvent.pageY - start.y) > TAP_SLOP)
      ) {
        return;
      }
      onTap();
    },
    // A no-op so releasing after opening the context menu doesn't also count as a tap.
    onLongPress: () => {},
  };
}
