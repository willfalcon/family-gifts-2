import { View } from 'react-native';
import { cn } from '@/lib/utils';
import { Doc } from '@convex/_generated/dataModel';

// Mirrors the web app's PriorityBadge: three rising bars, filled up to the
// priority level, plus a label.
const BAR_COLOR = { low: 'bg-slate', medium: 'bg-amber', high: 'bg-accent' };
const LEVEL = { low: 1, medium: 2, high: 3 };

export default function PriorityBadge({ priority }: { priority: Doc<'items'>['priority'] }) {
  if (!priority) return null;

  return (
    <View className="flex-row items-end gap-0.5">
      {[0, 1, 2].map(i => (
        <View
          key={i}
          className={cn('w-1', i < LEVEL[priority] ? BAR_COLOR[priority] : 'bg-line')}
          style={{ height: 6 + i * 4, borderRadius: 1 }}
        />
      ))}
    </View>
  );
}
