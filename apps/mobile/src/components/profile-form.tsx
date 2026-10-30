import { Pressable, View } from 'react-native';
import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { MonthDayPicker, type MonthDay } from '@/components/month-day-picker';
import { YearPicker } from '@/components/year-picker';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Text } from '@/components/ui/text';
import { DEFAULT_NOTIFICATION_PREFERENCE, type BirthdayVisibility, type NotificationPreference } from '@convex/schema';
import { CURRENCIES, DEFAULT_CURRENCY } from '@convex/currencies';
import { useAppearance } from '@/hooks/appearance';
import type { Appearance } from '@/hooks/local-settings';
import type { Group, Profile } from '@convex/types';
import type { Id } from '@convex/_generated/dataModel';
import { useUpdateProfile } from '@/hooks/user';
import { Host, Picker, Text as SwiftText } from '@expo/ui/swift-ui';
import { tag, tint } from '@expo/ui/swift-ui/modifiers';
import { colors } from '@family-gifts/design-tokens';
import { Icon } from './ui/icon';
import { ChevronRight } from 'lucide-react-native';
import { Link } from 'expo-router';

const VISIBILITY_OPTIONS = {
  allGroups: {
    label: 'All my groups',
    description: null,
    hintText:
      'Everyone in your groups sees it in Events and gets a reminder. They never see the year unless you show your age.',
  }, // filled with group names below
  someGroups: {
    label: 'Choose groups',
    description: 'Pick who gets reminded',
    hintText: 'Only the groups you turn on will see it or get a reminder.',
  },
  private: {
    label: 'Only me',
    description: 'Hidden from everyone',
    hintText: 'No one will see your birthday or get a reminder. You can still share a list for it anytime.',
  },
} satisfies Record<BirthdayVisibility, { label: string; description: string | null; hintText: string }>;

const NOTIFICATION_OPTIONS = [
  { value: 'none', label: 'No notifications' },
  { value: 'day-before', label: 'Day before' },
  { value: 'week-before', label: 'Week before' },
  { value: '3-weeks', label: '3 weeks before' },
] satisfies { value: NotificationPreference; label: string }[];

const CURRENCY_OPTIONS = CURRENCIES.map(c => ({ value: c.code, label: `${c.name} (${c.code})` }));

const APPEARANCE_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] satisfies { value: Appearance; label: string }[];

// Catches Feb 29 in a non-leap year before the server rejects it.
function isRealDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day;
}

interface ProfileFormProps {
  // null when the user has no profile row yet - the form starts empty.
  profile: Profile | null;
  groups: Group[];
  email: string | null;
}

export default function ProfileForm({ profile, groups, email }: ProfileFormProps) {
  const birthday = profile?.birthday ?? null;
  const [showAge, setShowAge] = useState(!!profile?.birthday?.year);
  const [pushNotifications, setPushNotifications] = useState(false);
  const updateProfile = useUpdateProfile();
  const [saveError, setSaveError] = useState<string | null>(null);

  const birthdayVisibility = profile?.birthdayVisibility ?? 'private';
  const birthdayGroupIds = profile?.birthdayGroupIds ?? [];
  const notificationPreference = profile?.notificationPreference ?? DEFAULT_NOTIFICATION_PREFERENCE;
  const shareNewLists = profile?.shareNewLists ?? [];
  const currency = profile?.currency ?? DEFAULT_CURRENCY;
  const [appearance, setAppearance] = useAppearance();

  // Every change saves right away. The screen already shows the new value, and
  // Convex rolls it back if the save fails, so all that's left is the message.
  function save(fields: Parameters<typeof updateProfile>[0]) {
    setSaveError(null);
    updateProfile(fields).catch(() => setSaveError("Couldn't save that change. Try again."));
  }

  // Turning this on only shows the year picker; nothing saves until a year is
  // picked. Turning it off drops the saved year so the age is really hidden.
  function toggleShowAge(on: boolean) {
    setShowAge(on);
    if (!on && birthday?.year !== undefined) {
      const { month, day } = birthday;
      save({ birthday: { month, day } });
    }
  }

  // Changing the date keeps the saved year, if there is one.
  function setBirthdayDate({ month, day }: MonthDay) {
    const year = birthday?.year;
    if (year !== undefined && !isRealDate(year, month, day)) {
      setSaveError(`${year} doesn't have a Feb 29. Pick another year first.`);
      return;
    }
    save({ birthday: year === undefined ? { month, day } : { month, day, year } });
  }

  // Only reachable once a date is set (the "Show my age" switch is disabled
  // until then), since a saved birthday always needs a month and day.
  function setBirthYear(year: number) {
    if (!birthday) return;
    if (!isRealDate(year, birthday.month, birthday.day)) {
      setSaveError(`${year} doesn't have a Feb 29.`);
      return;
    }
    save({ birthday: { month: birthday.month, day: birthday.day, year } });
  }

  function setBirthdayVisibility(value: BirthdayVisibility) {
    save({ birthdayVisibility: value });
  }

  function toggleBirthdayGroup(groupId: Id<'groups'>, on: boolean) {
    save({
      birthdayGroupIds: on ? [...birthdayGroupIds, groupId] : birthdayGroupIds.filter(id => id !== groupId),
    });
  }

  function toggleShareNewLists(groupId: Id<'groups'>, on: boolean) {
    save({
      shareNewLists: on ? [...shareNewLists, groupId] : shareNewLists.filter(id => id !== groupId),
    });
  }

  return (
    <View className="gap-4">
      <View className="mt-2 gap-2">
        <Label>Birthday</Label>

        <FieldRow>
          <Label nativeID="profile-birthday" className="text-base text-ink font-normal">
            Date
          </Label>
          <MonthDayPicker
            aria-labelledby="profile-birthday"
            value={birthday && { month: birthday.month, day: birthday.day }}
            onChange={setBirthdayDate}
          />
        </FieldRow>

        <FieldRow>
          <Label nativeID="show-my-age">Show my age</Label>
          <Switch nativeID="show-my-age" checked={showAge} onCheckedChange={toggleShowAge} disabled={!birthday} />
        </FieldRow>

        {showAge && (
          <FieldRow>
            <Label nativeID="profile-birth-year" className="text-base text-ink font-normal">
              Year
            </Label>
            <YearPicker aria-labelledby="profile-birth-year" value={birthday?.year ?? null} onChange={setBirthYear} />
          </FieldRow>
        )}
      </View>
      <View className="gap-1">
        <Label nativeID="birthday-visibility">Who can see your birthday</Label>
        <RadioGroup
          aria-labelledby="birthday-visibility"
          value={birthdayVisibility}
          onValueChange={value => setBirthdayVisibility(value as BirthdayVisibility)}
        >
          {(Object.keys(VISIBILITY_OPTIONS) as BirthdayVisibility[]).map(value => {
            const option = VISIBILITY_OPTIONS[value];
            const description = value === 'allGroups' ? groups.map(g => g.name).join(', ') : option.description;
            return (
              <Pressable
                key={value}
                onPress={() => setBirthdayVisibility(value)}
                className="flex-row items-center justify-between gap-3 border-b border-line pb-2"
              >
                <View className="flex-1">
                  <Text>{option.label}</Text>
                  <Text className="text-sm text-ink-muted">{description}</Text>
                </View>
                <RadioGroupItem value={value} aria-label={option.label} />
              </Pressable>
            );
          })}
        </RadioGroup>
      </View>
      {groups.length > 0 && birthdayVisibility === 'someGroups' && (
        <View className="gap-1">
          {groups.map(group => (
            <View
              key={group._id}
              className="flex-row items-center justify-between gap-3 border-b border-line pb-2 px-4"
            >
              <Label nativeID={`birthday-group-${group._id}`}>{group.name}</Label>
              <Switch
                nativeID={`birthday-group-${group._id}`}
                checked={birthdayGroupIds.includes(group._id)}
                onCheckedChange={on => toggleBirthdayGroup(group._id, on)}
              />
            </View>
          ))}
        </View>
      )}
      {VISIBILITY_OPTIONS[birthdayVisibility].hintText && (
        <Text className="text-sm text-ink-muted">{VISIBILITY_OPTIONS[birthdayVisibility].hintText}</Text>
      )}

      <View className="gap-2">
        <Label>Notifications</Label>
        <FieldRow>
          <Label nativeID="event-reminders" className="text-base text-ink font-normal">
            Event reminders
          </Label>
          <Host matchContents style={{ alignSelf: 'stretch' }}>
            <Picker
              label="Event reminders"
              selection={notificationPreference}
              onSelectionChange={val => save({ notificationPreference: val })}
              modifiers={[tint(colors['ink-muted'])]}
            >
              {NOTIFICATION_OPTIONS.map(option => (
                <SwiftText key={option.value} modifiers={[tag(option.value)]}>
                  {option.label}
                </SwiftText>
              ))}
            </Picker>
          </Host>
        </FieldRow>
        <FieldRow>
          <Label nativeID="push-notifications">Push notifications</Label>
          <Switch
            nativeID="push-notifications"
            checked={pushNotifications}
            onCheckedChange={on => setPushNotifications(on)}
          />
        </FieldRow>
      </View>

      <View className="gap-2">
        <Label>Preferences</Label>
        {groups.length > 0 && (
          <View className="gap-1">
            <Text className="text-base text-ink font-normal">Share new lists with</Text>
            {groups.map(group => (
              <View
                key={group._id}
                className="flex-row items-center justify-between gap-3 border-b border-line pb-2 px-4"
              >
                <Label nativeID={`share-new-lists-${group._id}`}>{group.name}</Label>
                <Switch
                  nativeID={`share-new-lists-${group._id}`}
                  checked={shareNewLists.includes(group._id)}
                  onCheckedChange={on => toggleShareNewLists(group._id, on)}
                />
              </View>
            ))}
          </View>
        )}
        <FieldRow>
          <Label nativeID="currency" className="text-base text-ink font-normal">
            Currency
          </Label>
          <Host matchContents style={{ alignSelf: 'stretch' }}>
            <Picker
              label="Currency"
              selection={currency}
              onSelectionChange={val => save({ currency: val })}
              modifiers={[tint(colors['ink-muted'])]}
            >
              {CURRENCY_OPTIONS.map(option => (
                <SwiftText key={option.value} modifiers={[tag(option.value)]}>
                  {option.label}
                </SwiftText>
              ))}
            </Picker>
          </Host>
        </FieldRow>
        <FieldRow>
          <Label nativeID="appearance" className="text-base text-ink font-normal">
            Appearance
          </Label>
          <Host matchContents style={{ alignSelf: 'stretch' }}>
            <Picker
              label="Appearance"
              selection={appearance}
              onSelectionChange={setAppearance}
              modifiers={[tint(colors['ink-muted'])]}
            >
              {APPEARANCE_OPTIONS.map(option => (
                <SwiftText key={option.value} modifiers={[tag(option.value)]}>
                  {option.label}
                </SwiftText>
              ))}
            </Picker>
          </Host>
        </FieldRow>
      </View>
      <View className="gap-2">
        <Label>Account</Label>
        <FieldRow>
          <Label nativeID="email" className="text-base text-ink font-normal">
            Email
          </Label>
          <Text>{email}</Text>
        </FieldRow>
        <FieldRow>
          <Label nativeID="groups" className="text-base text-ink font-normal">
            Groups
          </Label>
          <Link href="/(tabs)/groups">
            <Text>{groups.length}</Text>
            <Icon as={ChevronRight} />
          </Link>
        </FieldRow>
      </View>

      <View className="gap-2">
        <Label>Support</Label>

        <Link href="/" asChild>
          <View className="w-full flex flex-row flex-wrap items-center justify-between border-b border-line pb-2">
            <Label nativeID="support" className="text-base text-ink font-normal">
              Help & feedback
            </Label>
            <Icon as={ChevronRight} />
          </View>
        </Link>

        <Link href="/" asChild>
          <View className="w-full flex flex-row flex-wrap items-center justify-between border-b border-line pb-2">
            <Label nativeID="support" className="text-base text-ink font-normal">
              Privacy policy
            </Label>
            <Icon as={ChevronRight} />
          </View>
        </Link>

        <FieldRow>
          <Label nativeID="support" className="text-base text-ink font-normal">
            Version
          </Label>
          <Text>1.0.0</Text>
        </FieldRow>
      </View>
      {saveError && <Text className="text-sm text-destructive">{saveError}</Text>}
    </View>
  );
}

export function FieldRow({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap items-center justify-between border-b border-line pb-2">{children}</View>;
}
