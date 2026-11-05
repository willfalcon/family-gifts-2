import { Controller, useWatch, type Control } from 'react-hook-form';

import type { Id } from '@convex/_generated/dataModel';
import type { ListInput, OccasionInput } from '@shared/schemas/list';
import { Section } from '@/components/page';
import { ErrorText } from '@/components/auth-forms';
import { Label, RadioGroup, RadioGroupItem, Switch } from '@/components/ui/controls';
import { Input } from '@/components/ui/input';
import { useEvents, useGroups, useProfile } from '@/hooks/data';

// One radio row. `occasion` is what goes into the form (undefined = "Just ideas").
interface OccasionOption {
  key: string;
  label: string;
  description: string;
  occasion: OccasionInput | undefined;
}

const shortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function keyFor(occasion: OccasionInput | undefined): string {
  if (!occasion) return 'none';
  if (occasion.kind === 'event') return `event:${occasion.eventId}`;
  return occasion.kind;
}

// The fields for a new or edited list: name, what it's for, and which groups
// can see it. Ported from apps/mobile/src/components/list-form.tsx.
export function ListForm({ control, eventId }: { control: Control<ListInput>; eventId?: string }) {
  const events = useEvents();
  const profile = useProfile();
  const groups = useGroups();

  const occasionKind = useWatch({ control, name: 'occasion.kind' });
  const currentOccasion = useWatch({ control, name: 'occasion' });
  // The event offered as an occasion: the one asked for, the list's own, or the next one.
  const currentEventId = currentOccasion?.kind === 'event' ? currentOccasion.eventId : undefined;
  const firstEvent =
    events?.find(e => e._id === (eventId ?? currentEventId)) ??
    events?.find(e => e.cancelledAt === undefined) ??
    events?.[0];
  const birthday = profile?.birthday;
  const options: OccasionOption[] = [
    ...(firstEvent
      ? [
          {
            key: `event:${firstEvent._id}`,
            label: firstEvent.name,
            description: firstEvent.date ? shortDate(new Date(`${firstEvent.date}T00:00`)) : '',
            occasion: { kind: 'event', eventId: firstEvent._id } as const,
          },
        ]
      : []),
    { key: 'christmas', label: 'Christmas', description: 'Dec 25, every year', occasion: { kind: 'christmas' } },
    ...(birthday
      ? [
          {
            key: 'birthday',
            label: 'My birthday',
            description: `${shortDate(new Date(birthday.year || 2000, birthday.month - 1, birthday.day))}, from your profile`,
            occasion: { kind: 'birthday' } as const,
          },
        ]
      : []),
    { key: 'date', label: 'Another occasion', description: 'Pick a date', occasion: { kind: 'date', date: '' } },
    { key: 'none', label: 'Just ideas', description: 'No date', occasion: undefined },
  ];

  return (
    <>
      <Controller
        control={control}
        name="title"
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="list-title">Name</Label>
            <Input id="list-title" placeholder="List name" autoFocus {...field} aria-invalid={!!fieldState.error} />
            <ErrorText>{fieldState.error?.message}</ErrorText>
          </div>
        )}
      />

      <div>
        <Controller
          control={control}
          name="occasion"
          render={({ field }) => {
            const select = (key: string) => field.onChange(options.find(o => o.key === key)?.occasion);
            return (
              <div className="flex flex-col gap-1">
                <Label id="list-occasion">What’s it for?</Label>
                <RadioGroup aria-labelledby="list-occasion" value={keyFor(field.value)} onValueChange={select}>
                  {options.map(option => (
                    <label
                      key={option.key}
                      className="flex cursor-pointer items-center justify-between gap-3 border-b border-line py-2"
                    >
                      <span className="flex-1">
                        <span className="block">{option.label}</span>
                        {option.description && (
                          <span className="block text-sm text-ink-muted">{option.description}</span>
                        )}
                      </span>
                      <RadioGroupItem value={option.key} aria-label={option.label} />
                    </label>
                  ))}
                </RadioGroup>
              </div>
            );
          }}
        />
        {occasionKind === 'date' && (
          <Controller
            control={control}
            name="occasion.date"
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-1 border-b border-line py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="list-occasion-date">Date</label>
                  <Input
                    id="list-occasion-date"
                    type="date"
                    className="w-auto"
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value)}
                    aria-invalid={!!fieldState.error}
                  />
                </div>
                <ErrorText>{fieldState.error?.message}</ErrorText>
              </div>
            )}
          />
        )}
      </div>

      <Controller
        control={control}
        name="sharedWithGroupIds"
        render={({ field }) => {
          const selected = field.value ?? [];
          const toggle = (groupId: Id<'groups'>, checked: boolean) =>
            field.onChange(checked ? [...selected, groupId] : selected.filter(id => id !== groupId));
          return (
            <Section title="Who can see it?">
              <div>
                {groups?.map(group => (
                  <label
                    key={group._id}
                    className="flex cursor-pointer items-center justify-between gap-3 border-b border-line py-2"
                  >
                    <span>{group.name}</span>
                    <Switch
                      aria-label={group.name}
                      checked={selected.includes(group._id)}
                      onCheckedChange={checked => toggle(group._id, checked)}
                    />
                  </label>
                ))}
              </div>
              <p className="text-sm text-ink-muted">
                {selected.length > 0
                  ? 'Members can see your ideas and claim them. You never see claims.'
                  : 'Only you can see this list.'}
              </p>
            </Section>
          );
        }}
      />
    </>
  );
}
