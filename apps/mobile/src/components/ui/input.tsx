import { cn } from '@/lib/utils';
import { Platform, TextInput } from 'react-native';

function Input({ className, ...props }: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  return (
    <TextInput
      className={cn(
        'dark:bg-fill bg-fill flex h-10 w-full min-w-0 flex-row items-center rounded-md border-input px-3 py-1 text-base leading-5 text-ink sm:h-9',
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
