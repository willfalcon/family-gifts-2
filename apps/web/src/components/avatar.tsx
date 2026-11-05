import { Gift } from 'lucide-react';

import { cn } from '@/lib/utils';

// Someone's initial on their color (the server picks each person's color).
export function Avatar({
  person,
  size = 40,
  className,
}: {
  person: { name: string; color?: string; image?: string | null; secretSanta?: boolean } | undefined;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, backgroundColor: person?.color };
  if (person?.image) {
    return (
      <img
        src={person.image}
        alt={person.name}
        className={cn('shrink-0 rounded-full object-cover', className)}
        style={style}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-avatar-navy font-semibold text-on-avatar',
        className,
      )}
      style={{ ...style, fontSize: size * 0.45 }}
    >
      {person?.secretSanta ? (
        <Gift style={{ width: size * 0.5, height: size * 0.5 }} />
      ) : (
        (person?.name ?? '?').charAt(0).toUpperCase()
      )}
    </span>
  );
}

// Overlapping avatars for a few people.
export function AvatarStack({
  people,
  size = 28,
}: {
  people: { id: string; name: string; color: string }[];
  size?: number;
}) {
  if (people.length === 0) return null;
  return (
    <div className="flex">
      {people.map((person, i) => (
        <span
          key={person.id}
          className="rounded-full border-2 border-background"
          style={{ marginLeft: i === 0 ? 0 : -8, zIndex: people.length - i }}
        >
          <Avatar person={person} size={size} />
        </span>
      ))}
    </div>
  );
}

// A square icon tile, used for list and group rows.
export function IconTile({
  icon: Icon,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg bg-fill', className)}>
      <Icon className="size-5 text-ink-muted" />
    </span>
  );
}

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-[0_1px_2px_rgba(20,20,25,0.06)]', className)}
      {...props}
    />
  );
}
