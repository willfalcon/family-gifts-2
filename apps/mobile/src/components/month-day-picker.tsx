import { cn } from '@/lib/utils';
import { HStack, Host, Picker, Text as SwiftText } from '@expo/ui/swift-ui';
import { clipped, frame, labelsHidden, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { format, getDaysInMonth } from 'date-fns';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './ui/text';

export type MonthDay = { month: number; day: number }; // month 1-12, day 1-31

interface Props {
  value: MonthDay | null;
  onChange: (value: MonthDay) => void;
  invalid?: boolean;
  'aria-labelledby'?: string;
}

// 2000 is a leap year, so Feb 29 stays pickable.
const LEAP_YEAR = 2000;
const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: format(new Date(LEAP_YEAR, i, 1), 'MMMM'),
}));

const MONTH_WIDTH = 170; // fits "September"
const DAY_WIDTH = 80;

function daysIn(month: number) {
  return getDaysInMonth(new Date(LEAP_YEAR, month - 1, 1));
}

/**
 * A month + day picker with no year, for things like birthdays.
 * Shows the date as "Nov 14" and opens iOS scroll wheels on tap.
 *
 * Like DateField, the wheels are returned as a sibling of the field, so the
 * parent decides where they go. In a `flex-row flex-wrap` row they drop to their own line.
 */
export function MonthDayPicker({ value, onChange, invalid, ...props }: Props) {
  const [open, setOpen] = useState(false);
  // Wheels need something selected, so start at today when there's no value yet.
  const today = new Date();
  const current = value ?? { month: today.getMonth() + 1, day: today.getDate() };
  const dayCount = daysIn(current.month);

  const setMonth = (month: number) => onChange({ month, day: Math.min(current.day, daysIn(month)) });
  const setDay = (day: number) => onChange({ month: current.month, day });

  const toggle = () => {
    // Opening with no value commits the default the wheels show.
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
          {value ? format(new Date(LEAP_YEAR, value.month - 1, value.day), 'MMM d') : 'Pick a date'}
        </Text>
      </Pressable>
      {open && (
        // Fixed widths keep the wheels side by side in the middle, like the system date wheel.
        <View className="w-full items-center">
          <Host matchContents>
            <HStack spacing={0}>
              <Picker
                selection={current.month}
                onSelectionChange={setMonth}
                modifiers={[pickerStyle('wheel'), labelsHidden(), frame({ width: MONTH_WIDTH }), clipped()]}
              >
                {MONTHS.map(m => (
                  <SwiftText key={m.value} modifiers={[tag(m.value)]}>
                    {m.label}
                  </SwiftText>
                ))}
              </Picker>
              <Picker
                selection={current.day}
                onSelectionChange={setDay}
                modifiers={[pickerStyle('wheel'), labelsHidden(), frame({ width: DAY_WIDTH }), clipped()]}
              >
                {Array.from({ length: dayCount }, (_, i) => (
                  <SwiftText key={i + 1} modifiers={[tag(i + 1)]}>
                    {String(i + 1)}
                  </SwiftText>
                ))}
              </Picker>
            </HStack>
          </Host>
        </View>
      )}
    </>
  );
}
