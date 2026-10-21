import { cn } from '@/lib/utils';
import * as SwitchPrimitives from '@rn-primitives/switch';
import { Platform } from 'react-native';

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitives.Root>) {
  return (
    <SwitchPrimitives.Root
      className={cn(
        'flex h-[30] w-[51] shrink-0 flex-row items-center rounded-full border border-transparent',
        props.checked ? 'bg-success' : 'bg-control-off',
        props.disabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'size-[26] rounded-full bg-background shadow-sm shadow-white/20 transition-transform',
          props.checked ? 'translate-x-[22]' : 'translate-x-[1]',
        )}
      />
    </SwitchPrimitives.Root>
  );
}

export { Switch };
