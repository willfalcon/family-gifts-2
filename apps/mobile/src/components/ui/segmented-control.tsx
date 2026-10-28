import { cn } from '@/lib/utils';
import { colors } from '@family-gifts/design-tokens';
import { useEffect, useRef } from 'react';
import { Pressable, View, type LayoutRectangle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Text } from './text';

type Option<T extends string> = { label: string; value: T };

type SegmentedControlProps<T extends string> = {
  options: Option<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  className?: string;
};

const SPRING = { damping: 60, stiffness: 800 };

function SegmentedControl<T extends string>({ options, value, onChange, className }: SegmentedControlProps<T>) {
  const layouts = useRef<(LayoutRectangle | undefined)[]>([]);
  const hasLayouts = useRef(false);
  const pillX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const selectedIndex = options.findIndex(o => o.value === value);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillWidth.value,
  }));

  function movePill(index: number, animate: boolean) {
    const layout = layouts.current[index];
    if (!layout) return;
    if (animate) {
      pillX.value = withSpring(layout.x, SPRING);
      pillWidth.value = withSpring(layout.width, SPRING);
    } else {
      pillX.value = layout.x;
      pillWidth.value = layout.width;
    }
  }

  useEffect(() => {
    if (hasLayouts.current && selectedIndex >= 0) {
      movePill(selectedIndex, true);
    }
  }, [selectedIndex]);

  return (
    <View className={cn('rounded-md bg-fill p-[2px]', className)}>
      <View style={{ flexDirection: 'row', position: 'relative' }}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              borderRadius: 8,
              backgroundColor: colors.background,
            },
            pillStyle,
          ]}
        />
        {options.map((opt, i) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              style={{ paddingHorizontal: 12, paddingVertical: 6, zIndex: 1 }}
              onLayout={e => {
                layouts.current[i] = e.nativeEvent.layout;
                if (i === options.length - 1) {
                  hasLayouts.current = true;
                  if (selectedIndex >= 0) movePill(selectedIndex, false);
                }
              }}
            >
              <Text className={cn('text-sm font-bold', selected ? 'text-ink' : 'text-ink-muted')}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export { SegmentedControl };
