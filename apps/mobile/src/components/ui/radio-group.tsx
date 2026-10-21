import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import * as RadioGroupPrimitive from '@rn-primitives/radio-group';
import { Check } from 'lucide-react-native';
import { Platform } from 'react-native';

function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className={cn('gap-1', className)} {...props} />;
}

// No circle: the slot is empty when unselected and shows an accent checkmark when selected.
// The item keeps a fixed size so rows don't shift when the selection changes.
function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn('size-6 shrink-0 items-center justify-center', props.disabled && 'opacity-50', className)}
      {...props}
    >
      <RadioGroupPrimitive.Indicator>
        <Icon as={Check} size={20} strokeWidth={Platform.OS === 'web' ? 2.5 : 3} className="text-accent" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
