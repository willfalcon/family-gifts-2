import { useEffect, useState, type FormEvent } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { ChevronRight } from 'lucide-react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { CURRENCIES, DEFAULT_CURRENCY } from '@convex/currencies';
import { nameParts } from '@convex/names';
import { DEFAULT_NOTIFICATION_PREFERENCE, type BirthdayVisibility, type NotificationPreference } from '@convex/schema';
import { DevUserSwitcher, ErrorText } from '@/components/auth-forms';
import { Avatar } from '@/components/avatar';
import { FieldRow, Footnote, Page, PageHeader, Section } from '@/components/page';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem, Switch } from '@/components/ui/controls';
import { Input, Select } from '@/components/ui/input';
import { useAppearance, type Appearance } from '@/hooks/appearance';
import { useGroups, useProfile, useUpdateProfile, useUser } from '@/hooks/data';
import { authClient, reloadTo } from '@/lib/auth-client';
import { errorMessage } from '@/lib/utils';

export const Route = createFileRoute('/_app/profile/')({
  head: () => ({ meta: [{ title: 'Profile · Family Gifts' }] }),
  component: Profile,
});

const VISIBILITY_OPTIONS = {
  allGroups: {
    label: 'All my groups',
    description: null,
    hint: 'Everyone in your groups sees it in Events and gets a reminder. They never see the year unless you show your age.',
  },
  someGroups: {
    label: 'Choose groups',
    description: 'Pick who gets reminded',
    hint: 'Only the groups you turn on will see it or get a reminder.',
  },
  private: {
    label: 'Only me',
    description: 'Hidden from everyone',
    hint: 'No one will see your birthday or get a reminder. You can still share a list for it anytime.',
  },
} satisfies Record<BirthdayVisibility, { label: string; description: string | null; hint: string }>;

const NOTIFICATION_OPTIONS = [
  { value: 'none', label: 'No notifications' },
  { value: 'day-before', label: 'Day before' },
  { value: 'week-before', label: 'Week before' },
  { value: '3-weeks', label: '3 weeks before' },
] satisfies { value: NotificationPreference; label: string }[];

const APPEARANCE_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] satisfies { value: Appearance; label: string }[];

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString('en-US', { month: 'long' }),
);

// Catches Feb 29 in a non-leap year before the server rejects it.
function isRealDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day;
}

function Profile() {
  const user = useUser();
  const profile = useProfile();
  const groups = useGroups();

  return (
    <Page className="gap-6">
      <PageHeader title="Profile" />
      <div className="flex flex-col items-center gap-2">
        <Avatar person={user ? { name: user.name } : undefined} size={76} />
        <p className="display-detail text-center">{user?.name}</p>
      </div>
      {user && profile !== undefined && <NameForm name={user.name} profile={profile} />}
      {profile !== undefined && groups !== undefined && (
        <ProfileSettings profile={profile} groups={groups} email={user?.email ?? null} />
      )}
      <Button
        variant="secondary"
        onClick={async () => {
          await authClient.signOut();
          reloadTo('/welcome');
        }}
      >
        Log out
      </Button>
      <DevUserSwitcher currentEmail={user?.email} onSignedIn={() => reloadTo('/')} />
    </Page>
  );
}

// "Edit name": mobile shows the label but doesn't have the editor yet.
function NameForm({ name, profile }: { name: string; profile: ReturnType<typeof useProfile> }) {
  const updateName = useMutation(api.profiles.updateName);
  const parts = nameParts(profile, name);
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState(parts.firstName);
  const [last, setLast] = useState(parts.lastName);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) return;
    setFirst(parts.firstName);
    setLast(parts.lastName);
  }, [parts.firstName, parts.lastName, editing]);

  if (!editing) {
    return (
      <button
        type="button"
        className="self-center text-callout text-accent hover:underline"
        onClick={() => setEditing(true)}
      >
        Edit name
      </button>
    );
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateName({ firstName: first, lastName: last });
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <div className="flex gap-3">
        <Input
          aria-label="First name"
          placeholder="First name"
          autoComplete="given-name"
          value={first}
          onChange={e => setFirst(e.target.value)}
          autoFocus
        />
        <Input
          aria-label="Last name"
          placeholder="Last name"
          autoComplete="family-name"
          value={last}
          onChange={e => setLast(e.target.value)}
        />
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          Save
        </Button>
      </div>
    </form>
  );
}

type ProfileDoc = NonNullable<ReturnType<typeof useProfile>>;
type GroupDoc = NonNullable<ReturnType<typeof useGroups>>[number];

// Every change saves right away, like mobile.
function ProfileSettings({
  profile,
  groups,
  email,
}: {
  profile: ProfileDoc | null;
  groups: GroupDoc[];
  email: string | null;
}) {
  const updateProfile = useUpdateProfile();
  const [appearance, setAppearance] = useAppearance();
  const birthday = profile?.birthday ?? null;
  const [showAge, setShowAge] = useState(!!profile?.birthday?.year);
  const [saveError, setSaveError] = useState<string | null>(null);

  const birthdayVisibility = profile?.birthdayVisibility ?? 'private';
  const birthdayGroupIds = profile?.birthdayGroupIds ?? [];
  const notificationPreference = profile?.notificationPreference ?? DEFAULT_NOTIFICATION_PREFERENCE;
  const shareNewLists = profile?.shareNewLists ?? [];
  const currency = profile?.currency ?? DEFAULT_CURRENCY;
  const discoverable = profile?.discoverable === true;

  function save(fields: Parameters<typeof updateProfile>[0]) {
    setSaveError(null);
    updateProfile(fields).catch(() => setSaveError('Couldn’t save that change. Try again.'));
  }

  // Turning "Show my age" off drops the saved year so the age is really hidden.
  function toggleShowAge(on: boolean) {
    setShowAge(on);
    if (!on && birthday?.year !== undefined) save({ birthday: { month: birthday.month, day: birthday.day } });
  }

  // Changing the date keeps the saved year, if there is one.
  function setBirthdayDate(month: number, day: number) {
    const year = birthday?.year;
    if (year !== undefined && !isRealDate(year, month, day)) {
      setSaveError(`${year} doesn’t have a Feb 29. Pick another year first.`);
      return;
    }
    save({ birthday: year === undefined ? { month, day } : { month, day, year } });
  }

  function setBirthYear(year: number) {
    if (!birthday) return;
    if (!isRealDate(year, birthday.month, birthday.day)) {
      setSaveError(`${year} doesn’t have a Feb 29.`);
      return;
    }
    save({ birthday: { month: birthday.month, day: birthday.day, year } });
  }

  const toggleIn = (ids: Id<'groups'>[], id: Id<'groups'>, on: boolean) =>
    on ? [...ids, id] : ids.filter(g => g !== id);
  const thisYear = new Date().getFullYear();
  const daysInMonth = birthday ? new Date(2000, birthday.month, 0).getDate() : 31;

  return (
    <div className="flex flex-col gap-8">
      <Section title="Birthday">
        <FieldRow>
          <span id="birthday-date">Date</span>
          <div className="flex gap-2" role="group" aria-labelledby="birthday-date">
            <Select
              aria-label="Birthday month"
              value={birthday?.month ?? ''}
              onChange={e =>
                setBirthdayDate(
                  Number(e.target.value),
                  Math.min(birthday?.day ?? 1, new Date(2000, Number(e.target.value), 0).getDate()),
                )
              }
            >
              {!birthday && <option value="">Month</option>}
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Birthday day"
              value={birthday?.day ?? ''}
              disabled={!birthday}
              onChange={e => birthday && setBirthdayDate(birthday.month, Number(e.target.value))}
            >
              {!birthday && <option value="">Day</option>}
              {Array.from({ length: daysInMonth }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </Select>
          </div>
        </FieldRow>
        <FieldRow>
          <label htmlFor="show-age">Show my age</label>
          <Switch id="show-age" checked={showAge} onCheckedChange={toggleShowAge} disabled={!birthday} />
        </FieldRow>
        {showAge && (
          <FieldRow>
            <label htmlFor="birth-year">Year</label>
            <Select id="birth-year" value={birthday?.year ?? ''} onChange={e => setBirthYear(Number(e.target.value))}>
              {birthday?.year === undefined && <option value="">Pick a year</option>}
              {Array.from({ length: 110 }, (_, i) => thisYear - i).map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </FieldRow>
        )}
      </Section>

      <Section title="Who can see your birthday">
        <RadioGroup
          aria-label="Who can see your birthday"
          value={birthdayVisibility}
          onValueChange={value => save({ birthdayVisibility: value as BirthdayVisibility })}
        >
          {(Object.keys(VISIBILITY_OPTIONS) as BirthdayVisibility[]).map(value => {
            const option = VISIBILITY_OPTIONS[value];
            const description = value === 'allGroups' ? groups.map(g => g.name).join(', ') : option.description;
            return (
              <label
                key={value}
                className="flex cursor-pointer items-center justify-between gap-3 border-b border-line py-2"
              >
                <span className="flex-1">
                  <span className="block">{option.label}</span>
                  {description && <span className="block text-sm text-ink-muted">{description}</span>}
                </span>
                <RadioGroupItem value={value} aria-label={option.label} />
              </label>
            );
          })}
        </RadioGroup>
        {groups.length > 0 && birthdayVisibility === 'someGroups' && (
          <div className="pl-4">
            {groups.map(group => (
              <FieldRow key={group._id}>
                <label htmlFor={`birthday-group-${group._id}`}>{group.name}</label>
                <Switch
                  id={`birthday-group-${group._id}`}
                  checked={birthdayGroupIds.includes(group._id)}
                  onCheckedChange={on => save({ birthdayGroupIds: toggleIn(birthdayGroupIds, group._id, on) })}
                />
              </FieldRow>
            ))}
          </div>
        )}
        <Footnote className="text-sm">{VISIBILITY_OPTIONS[birthdayVisibility].hint}</Footnote>
      </Section>

      <Section title="Notifications">
        <FieldRow>
          <label htmlFor="event-reminders">Event reminders</label>
          <Select
            id="event-reminders"
            value={notificationPreference}
            onChange={e => save({ notificationPreference: e.target.value as NotificationPreference })}
          >
            {NOTIFICATION_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FieldRow>
      </Section>

      <Section title="Preferences">
        {groups.length > 0 && (
          <div>
            <p>Share new lists with</p>
            <div className="pl-4">
              {groups.map(group => (
                <FieldRow key={group._id}>
                  <label htmlFor={`share-new-${group._id}`}>{group.name}</label>
                  <Switch
                    id={`share-new-${group._id}`}
                    checked={shareNewLists.includes(group._id)}
                    onCheckedChange={on => save({ shareNewLists: toggleIn(shareNewLists, group._id, on) })}
                  />
                </FieldRow>
              ))}
            </div>
          </div>
        )}
        <FieldRow>
          <label htmlFor="currency">Currency</label>
          <Select id="currency" value={currency} onChange={e => save({ currency: e.target.value as typeof currency })}>
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow>
          <label htmlFor="appearance">Appearance</label>
          <Select id="appearance" value={appearance} onChange={e => setAppearance(e.target.value as Appearance)}>
            {APPEARANCE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FieldRow>
      </Section>

      <Section title="Privacy">
        <FieldRow>
          <label htmlFor="discoverable">Show me in search</label>
          <Switch id="discoverable" checked={discoverable} onCheckedChange={on => save({ discoverable: on })} />
        </FieldRow>
        <Footnote className="text-sm">
          {discoverable
            ? 'Anyone can find you by name or email when inviting people to a group or event.'
            : 'Only people who share a group or event with you can find you.'}
        </Footnote>
      </Section>

      <Section title="Account">
        <FieldRow>
          <span>Email</span>
          <span className="text-ink-muted">{email}</span>
        </FieldRow>
        <Link to="/profile/password" className="hover:bg-fill/40">
          <FieldRow>
            <span>Password</span>
            <span className="flex items-center gap-1 text-ink-muted">
              Change <ChevronRight className="size-4" />
            </span>
          </FieldRow>
        </Link>
        <Link to="/people" className="hover:bg-fill/40">
          <FieldRow>
            <span>Groups</span>
            <span className="flex items-center gap-1 text-ink-muted">
              {groups.length} <ChevronRight className="size-4" />
            </span>
          </FieldRow>
        </Link>
      </Section>

      <Section title="Support">
        <FieldRow>
          <span>Version</span>
          <span className="text-ink-muted">1.0.0</span>
        </FieldRow>
      </Section>
      <ErrorText>{saveError}</ErrorText>
    </div>
  );
}
