import { useEvents } from '@/hooks/events';
import { useProfile } from '@/hooks/user';
import { ListInput, OccasionInput } from '@shared/schemas/list';
import { Control, Controller, useWatch } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { DateField } from './date-field';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Text } from './ui/text';
import { useGroups } from '@/hooks/groups';
import { Switch } from './ui/switch';
import type { Id } from '@convex/_generated/dataModel';

interface Props {
  control: Control<ListInput>;
  onSubmit: () => void;
}

// One radio row. `key` is the string the RadioGroup works with; `occasion` is
// what goes into the form (undefined = "Just ideas").
interface OccasionOption {
  key: string;
  label: string;
  description: string;
  occasion: OccasionInput | undefined;
}

const shortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Maps a form value back to its radio key, so the right row shows as selected.
function keyFor(occasion: OccasionInput | undefined): string {
  if (!occasion) return 'none';
  if (occasion.kind === 'event') return `event:${occasion.eventId}`;
  return occasion.kind;
}

export default function ListForm({ control, onSubmit }: Props) {
  const events = useEvents();
  const profile = useProfile();
  const groups = useGroups();

  const occasionKind = useWatch({ control, name: 'occasion.kind' });
  const firstEvent = events?.[0];
  const birthday = profile?.birthday;
  const options: OccasionOption[] = [
    ...(firstEvent
      ? [
          {
            key: `event:${firstEvent._id}`,
            label: firstEvent.name,
            description: firstEvent.date ? shortDate(new Date(firstEvent.date)) : '',
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
    // Starts with an empty date; the schema reports "Pick a date" until one is filled in.
    { key: 'date', label: 'Another occasion', description: 'Pick a date', occasion: { kind: 'date', date: '' } },
    { key: 'none', label: 'Just ideas', description: 'No date', occasion: undefined },
  ];

  return (
    <>
      <Controller
        control={control}
        name="title"
        render={({ field, fieldState }) => (
          <View className="gap-1.5">
            <Label nativeID="list-title">Name</Label>
            <Input
              aria-labelledby="list-title"
              placeholder="List name"
              autoFocus
              returnKeyType="done"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              onSubmitEditing={() => onSubmit()}
              aria-invalid={!!fieldState.error}
            />
            {fieldState.error && <Text className="text-sm text-destructive">{fieldState.error.message}</Text>}
          </View>
        )}
      />
      <View>
        <Controller
          control={control}
          name="occasion"
          render={({ field }) => {
            const select = (key: string) => field.onChange(options.find(o => o.key === key)?.occasion);

            return (
              <View className="gap-1">
                <Label nativeID="list-occasion">What's it for?</Label>
                <RadioGroup aria-labelledby="list-occasion" value={keyFor(field.value)} onValueChange={select}>
                  {options.map(option => (
                    // The whole row is tappable, not just the small radio circle.
                    <Pressable
                      key={option.key}
                      onPress={() => select(option.key)}
                      className="flex-row items-center justify-between gap-3 border-b border-line pb-2"
                    >
                      <View className="flex-1">
                        <Text>{option.label}</Text>
                        {option.description ? (
                          <Text className="text-sm text-ink-muted">{option.description}</Text>
                        ) : null}
                      </View>
                      <RadioGroupItem value={option.key} aria-label={option.label} />
                    </Pressable>
                  ))}
                </RadioGroup>
              </View>
            );
          }}
        />

        {occasionKind === 'date' && (
          <Controller
            control={control}
            name="occasion.date"
            render={({ field, fieldState }) => (
              <View className="gap-1 border-b border-line py-2">
                <View className="flex-row flex-wrap items-center justify-between gap-y-2">
                  <Label nativeID="list-occasion-date" className="text-base font-normal text-ink">
                    Date
                  </Label>
                  <DateField
                    aria-labelledby="list-occasion-date"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    invalid={!!fieldState.error}
                  />
                </View>
                {fieldState.error && <Text className="text-sm text-destructive">{fieldState.error.message}</Text>}
              </View>
            )}
          />
        )}
      </View>

      <Controller
        control={control}
        name="sharedWithGroupIds"
        render={({ field }) => {
          const selected = field.value ?? [];
          const toggle = (groupId: Id<'groups'>, checked: boolean) =>
            field.onChange(checked ? [...selected, groupId] : selected.filter(id => id !== groupId));

          return (
            <View>
              <Label nativeID="list-visibility">Who can see it?</Label>
              {groups?.map(group => (
                <Pressable
                  key={group._id}
                  onPress={() => toggle(group._id, !selected.includes(group._id))}
                  className="flex-row items-center justify-between gap-3 border-b border-line py-2"
                >
                  <Text>{group.name}</Text>
                  <Switch
                    aria-label={group.name}
                    checked={selected.includes(group._id)}
                    onCheckedChange={checked => toggle(group._id, checked)}
                  />
                </Pressable>
              ))}
              <Text className="mt-2 text-sm text-ink-muted">
                {selected.length > 0
                  ? 'Members can see your ideas and claim them. You never see claims.'
                  : 'Only you can see this list.'}
              </Text>
            </View>
          );
        }}
      />
    </>
  );
}
