import { cn } from '@/lib/utils';
import { colors } from '@family-gifts/design-tokens';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { format, isValid, parse } from 'date-fns';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

interface Props {
  /** Time as HH:mm (24-hour), or '' when no time is set. */
  value: string;
  onChange: (value: string) => void;
  'aria-label'?: string;
}

function toDate(value: string): Date | undefined {
  const date = value ? parse(value, 'HH:mm', new Date()) : undefined;
  return date && isValid(date) ? date : undefined;
}

// A sensible starting point when no time is set yet.
function defaultTime() {
  return parse('18:00', 'HH:mm', new Date());
}

/**
 * Shows the time as "6:00 PM" and opens the OS time picker on tap: a dialog
 * on Android, a wheel on iOS. Times are optional, so a set time gets an X to
 * clear it.
 *
 * Like DateField, the iOS wheel is returned as a sibling of the field, so in a
 * `flex-row flex-wrap` row it drops to its own line.
 */
export function TimeField({ value, onChange, ...props }: Props) {
  const [iosOpen, setIosOpen] = useState(false);
  const date = toDate(value);

  const pick = (picked: Date) => onChange(format(picked, 'HH:mm'));

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date ?? defaultTime(),
        mode: 'time',
        onValueChange: (_event, picked) => pick(picked),
      });
    } else {
      // Opening the wheel shows a time, so save it right away rather than
      // leaving the field looking set while it's still empty.
      if (!iosOpen && !date) pick(defaultTime());
      setIosOpen(o => !o);
    }
  };

  return (
    <>
      <View className="flex-row items-center gap-1">
        {date && (
          <Pressable
            onPress={() => {
              onChange('');
              setIosOpen(false);
            }}
            accessibilityLabel={`Clear ${props['aria-label'] ?? 'time'}`}
            className="size-8 items-center justify-center"
          >
            <Icon as={X} size={16} className="text-ink-muted" />
          </Pressable>
        )}
        <Pressable
          {...props}
          role="button"
          onPress={open}
          className="bg-fill h-10 min-w-24 items-center justify-center rounded-md px-3"
        >
          <Text className={cn('text-base', date ? 'text-ink' : 'text-ink-faint', iosOpen && 'text-accent')}>
            {date ? format(date, 'h:mm a') : 'Add time'}
          </Text>
        </Pressable>
      </View>
      {Platform.OS === 'ios' && iosOpen && (
        <DateTimePicker
          value={date ?? defaultTime()}
          mode="time"
          display="spinner"
          accentColor={colors.accent}
          onValueChange={(_event, picked) => pick(picked)}
          style={{ width: '100%' }}
        />
      )}
    </>
  );
}
