import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react-native';
import { Platform, TextInput, View } from 'react-native';

type InputProps = React.ComponentProps<typeof TextInput> &
  React.RefAttributes<TextInput> & {
    prepend?: LucideIcon;
  };

function Input({ className, prepend, ...props }: InputProps) {
  if (prepend) {
    return (
      <View
        className={cn(
          'flex h-10 w-full min-w-0 flex-row items-center rounded-md border-input bg-fill px-3 py-1 dark:bg-fill sm:h-9',
          props.editable === false && 'opacity-50',
          className,
        )}
      >
        <Icon as={prepend} size={18} className="mr-2 text-ink-muted" />
        <TextInput
          className={cn(
            'flex-1 text-base leading-5 text-ink',
            Platform.select({
              native: 'placeholder:text-muted-foreground/50',
            }),
          )}
          {...props}
        />
      </View>
    );
  }

  return (
    <TextInput
      className={cn(
        'flex h-10 w-full min-w-0 flex-row items-center rounded-md border-input bg-fill px-3 py-1 text-base leading-5 text-ink dark:bg-fill sm:h-9',
        props.editable === false && cn('opacity-50'),
        Platform.select({
          native: 'placeholder:text-muted-foreground/50',
        }),
        className,
      )}
      {...props}
    />
  );
}

export { Input };
