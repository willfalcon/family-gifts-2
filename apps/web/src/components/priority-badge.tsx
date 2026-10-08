import { cn } from '@/lib/utils';
import { Doc } from '@convex/_generated/dataModel';

interface Props {
  // Straight from the schema field, so it stays in sync with `items.priority`
  // being optional: "low" | "medium" | "high" | undefined.
  priority: Doc<'items'>['priority'];
}

const PRIORITY_COLOR = { low: 'bg-slate', medium: 'bg-amber', high: 'bg-accent' };
const PRIORITY_LEVEL = { low: 1, medium: 2, high: 3 };
const TEXT_COLOR = { low: 'text-slate', medium: 'text-amber', high: 'text-accent' };
const PRIORITY = { low: 'Low', medium: 'Medium', high: 'High' };

export default function PriorityBadge({ priority }: Props) {
  if (!priority) return null;

  const color = PRIORITY_COLOR[priority];
  const n = PRIORITY_LEVEL[priority];
  const textcolor = TEXT_COLOR[priority];

  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5 items-end">
        {[0, 1, 2].map(i => (
          <div key={i} className={cn('w-1 rounded-px', i < n ? color : 'bg-line')} style={{ height: 6 + i * 4, borderRadius: 1 }} />
        ))}
      </div>
      <span className={cn('text-xs font-semibold', textcolor)}>{PRIORITY[priority]}</span>
    </div>
  );
}
