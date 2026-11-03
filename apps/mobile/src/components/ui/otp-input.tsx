import { useRef, useState } from 'react';
import { Pressable, TextInput, type TextInputInstance, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type OtpInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  length?: number;
  /** Called once every slot is filled. */
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
  'aria-labelledby'?: string;
};

// One hidden TextInput drives a row of display-only slots. Keeping a single
// real input means iOS/Android one-time-code autofill and pasting a whole code
// both work, and backspace behaves naturally.
function OtpInput({ value, onChangeText, length = 6, onComplete, autoFocus, ...props }: OtpInputProps) {
  const inputRef = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);

  function handleChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, length);
    onChangeText(digits);
    if (digits.length === length) onComplete?.(digits);
  }

  // The slot the next digit goes into; stays on the last slot once full.
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} className="relative">
      <View className="flex-row gap-2">
        {Array.from({ length }, (_, i) => {
          const digit = value[i];
          const active = focused && i === activeIndex;
          return (
            <View
              key={i}
              className={cn(
                'h-14 flex-1 items-center justify-center rounded-md border-2 border-transparent bg-fill',
                active && 'border-accent',
              )}
            >
              <Text className="text-2xl font-semibold text-ink">{digit ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        {...props}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        maxLength={length}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        caretHidden
        // Covers the slots so taps land on it, but draws nothing itself.
        className="absolute inset-0 text-transparent"
        style={{ opacity: 0.01 }}
      />
    </Pressable>
  );
}

export { OtpInput };
