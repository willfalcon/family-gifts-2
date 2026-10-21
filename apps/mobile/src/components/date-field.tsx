import { cn } from '@/lib/utils';
import { colors } from '@family-gifts/design-tokens';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { format, isValid, parseISO } from 'date-fns';
import { useState } from 'react';
import { Platform, Pressable } from 'react-native';
import { Text } from './ui/text';

interface Props {
  /** Date as YYYY-MM-DD, or '' when nothing is picked yet. */
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  'aria-labelledby'?: string;
}

// parseISO reads a date-only string as local midnight, so the day never shifts across time zones.
function toDate(value: string): Date | undefined {
  const date = value ? parseISO(value) : undefined;
  return date && isValid(date) ? date : undefined;
}

/**
 * Shows the date as "Sat, Nov 14" and opens the OS date picker on tap:
 * a dialog on Android, an inline calendar on iOS.
 *
 * The iOS calendar is returned as a sibling of the field (not nested in it), so the
 * parent decides where it goes. In a `flex-row flex-wrap` row it drops to its own line.
 */
export function DateField({ value, onChange, invalid, ...props }: Props) {
  const [iosOpen, setIosOpen] = useState(false);
  const date = toDate(value);

  const pick = (picked: Date) => onChange(format(picked, 'yyyy-MM-dd'));

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date ?? new Date(),
        mode: 'date',
        onValueChange: (_event, picked) => pick(picked),
      });
    } else {
      setIosOpen(o => !o);
    }
  };

  return (
    <>
      <Pressable
        {...props}
        role="button"
        onPress={open}
        className={cn(
          'bg-fill h-10 min-w-32 items-center justify-center rounded-md px-3',
          invalid && 'border border-destructive',
        )}
      >
        <Text className={cn('text-base', date ? 'text-ink' : 'text-ink-faint', iosOpen && 'text-accent')}>
          {date ? format(date, 'EEE, MMM d') : 'Pick a date'}
        </Text>
      </Pressable>
      {Platform.OS === 'ios' && iosOpen && (
        <DateTimePicker
          value={date ?? new Date()}
          mode="date"
          display="inline"
          accentColor={colors.accent}
          onValueChange={(_event, picked) => pick(picked)}
          style={{ width: '100%' }}
        />
      )}
    </>
  );
}
