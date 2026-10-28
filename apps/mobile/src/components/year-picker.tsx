import { cn } from '@/lib/utils';
import { Host, Picker, Text as SwiftText } from '@expo/ui/swift-ui';
import { clipped, frame, labelsHidden, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './ui/text';

interface Props {
  value: number | null;
  onChange: (value: number) => void;
  invalid?: boolean;
  'aria-labelledby'?: string;
}

const FIRST_YEAR = 1900;
const YEAR_WIDTH = 120;
// Where the wheel starts when nothing is picked yet: a likely adult birth year.
const DEFAULT_AGE = 30;

/**
 * A year-only picker, for things like a birth year.
 * Shows the year and opens an iOS scroll wheel on tap, newest year first.
 *
 * Like MonthDayPicker, the wheel is returned as a sibling of the field, so the
 * parent decides where it goes. In a `flex-row flex-wrap` row it drops to its own line.
 */
export function YearPicker({ value, onChange, invalid, ...props }: Props) {
  const [open, setOpen] = useState(false);
  const thisYear = new Date().getFullYear();
  const current = value ?? thisYear - DEFAULT_AGE;
  const years = Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, i) => thisYear - i);

  const toggle = () => {
    // Opening with no value commits the default the wheel shows.
    if (!open && !value) onChange(current);
    setOpen(o => !o);
  };

  return (
    <>
      <Pressable
        {...props}
        role="button"
        onPress={toggle}
        className={cn(
          'bg-fill h-10 min-w-32 items-center justify-center rounded-md px-3',
          invalid && 'border border-destructive',
        )}
      >
        <Text className={cn('text-base', value ? 'text-ink' : 'text-ink-faint', open && 'text-accent')}>
          {value ?? 'Pick a year'}
        </Text>
      </Pressable>
      {open && (
        <View className="w-full items-center">
          <Host matchContents>
            <Picker
              selection={current}
              onSelectionChange={onChange}
              modifiers={[pickerStyle('wheel'), labelsHidden(), frame({ width: YEAR_WIDTH }), clipped()]}
            >
              {years.map(y => (
                <SwiftText key={y} modifiers={[tag(y)]}>
                  {String(y)}
                </SwiftText>
              ))}
            </Picker>
          </Host>
        </View>
      )}
    </>
  );
}
