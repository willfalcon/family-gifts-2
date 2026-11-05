import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import type { FunctionArgs } from 'convex/server';
import { UserPlus, X } from 'lucide-react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { confirm, showAlert } from '@/components/alerts';
import { ErrorText } from '@/components/auth-forms';
import { GuestPicker, guestKey, useGuests, useShareEventLink } from '@/components/guest-picker';
import { FieldRow, Footnote, NotFound, Section, SheetPage, useGoBack } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Label, Switch } from '@/components/ui/controls';
import { SheetDialog } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { useEvent, useGroups, useSecretSanta } from '@/hooks/data';
import { errorMessage } from '@/lib/utils';

type EventFields = FunctionArgs<typeof api.events.create>;

// A time input with a clear button, since times are optional.
function TimeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex items-center gap-1">
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={`Clear ${label.toLowerCase()}`}
          className="flex size-8 items-center justify-center rounded-full hover:bg-fill"
        >
          <X className="size-4 text-ink-muted" />
        </button>
      )}
      <Input type="time" aria-label={label} className="w-auto" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

// Create or edit an event. Guests are only picked when creating; after that
// they're managed from the event page. Ported from
// apps/mobile/src/components/event-form.tsx; mobile's Add People screen is a
// dialog here.
export function EventForm({ id }: { id?: string }) {
  const navigate = useNavigate();
  const goBack = useGoBack('/events');
  const isEdit = id !== undefined;
  const event = useEvent(id);
  const createEvent = useMutation(api.events.create);
  const updateEvent = useMutation(api.events.update);
  const inviteByEmail = useMutation(api.events.invite);
  const inviteUser = useMutation(api.events.inviteUser);
  const inviteGroup = useMutation(api.events.inviteGroup);
  const setSecretSantaOff = useMutation(api.secretSanta.setOff);
  const secretSanta = useSecretSanta(isEdit ? event?._id : undefined);
  // Once names are drawn it can't be turned off here: undo the draw first.
  const drawn = secretSanta?.exists === true && secretSanta.status !== 'draft';
  const groups = useGroups();
  const { guests: people, addGuest, removeGuest } = useGuests();
  const shareEventLink = useShareEventLink();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [multiDay, setMultiDay] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [groupIds, setGroupIds] = useState<Id<'groups'>[]>([]);
  const [secretSantaOn, setSecretSantaOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pickingPeople, setPickingPeople] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Set once a new event is saved early (to share its invite link). From then
  // on the form updates that event instead of creating another.
  const [draftId, setDraftId] = useState<Id<'events'>>();

  // Fill the form once the event loads, and only once, so a live update
  // doesn't wipe what's being typed.
  const filled = useRef(false);
  useEffect(() => {
    if (!isEdit || !event || filled.current) return;
    filled.current = true;
    setName(event.name);
    setDescription(event.description ?? '');
    setLocation(event.location ?? '');
    setDate(event.date ?? '');
    const hasRange = !!event.endDate && event.endDate !== event.date;
    setMultiDay(hasRange);
    setEndDate(hasRange ? event.endDate! : '');
    setStartTime(event.startTime ?? '');
    setEndTime(event.endTime ?? '');
    setSecretSantaOn(!event.secretSantaOff);
  }, [isEdit, event]);

  if (isEdit && event === null) return <NotFound message="This event doesn’t exist, or you’re not on it." />;

  // The event's fields, or an error message if the form isn't valid yet.
  function readFields(): { error: string } | { fields: EventFields } {
    if (!name.trim()) return { error: 'Give your event a name' };
    if (multiDay && date && endDate && endDate < date) return { error: 'The end date is before the start date' };
    // update replaces every field, so anything left out is cleared.
    return {
      fields: {
        name: name.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        date: date || undefined,
        endDate: multiDay && endDate && endDate !== date ? endDate : undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
      },
    };
  }

  // The link belongs to the event, so a new event is saved first.
  async function shareInviteLink() {
    setSharing(true);
    try {
      let eventId = draftId;
      if (!eventId) {
        const ok = await confirm({
          title: 'Create the event first?',
          message: 'An invite link needs the event to exist. It’ll be saved with what you’ve filled in so far, and you can keep editing.',
          confirmText: 'Create',
        });
        if (!ok) return;
        const result = readFields();
        if ('error' in result) {
          setError(result.error);
          void showAlert('Can’t create the event yet', result.error);
          return;
        }
        try {
          eventId = await createEvent(result.fields);
        } catch (e) {
          void showAlert('Can’t create the event yet', errorMessage(e));
          return;
        }
        setDraftId(eventId);
      }
      await shareEventLink(eventId);
    } finally {
      setSharing(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = readFields();
    if ('error' in result) {
      setError(result.error);
      return;
    }
    const { fields } = result;
    setSubmitting(true);
    try {
      if (isEdit) {
        if (!event) return;
        const turningOff = !secretSantaOn && !event.secretSantaOff;
        const turningOn = secretSantaOn && !!event.secretSantaOff;
        // Turning it off throws away a setup that hasn't been drawn yet.
        if (
          turningOff &&
          secretSanta?.exists &&
          !(await confirm({
            title: 'Turn off Secret Santa?',
            message: 'Who’s in, the keep-apart rules and the budget will be cleared.',
            confirmText: 'Turn off',
            destructive: true,
          }))
        ) {
          setSubmitting(false);
          return;
        }
        await updateEvent({ id: event._id, ...fields });
        if (turningOff || turningOn) await setSecretSantaOff({ eventId: event._id, off: turningOff });
        goBack();
      } else {
        let eventId = draftId;
        if (eventId) await updateEvent({ id: eventId, ...fields });
        else eventId = await createEvent(fields);
        const newId = eventId;
        // The event exists now, so a failed invite shouldn't block leaving the
        // form; say so and let them retry from the event page.
        const results = await Promise.allSettled([
          ...groupIds.map(groupId => inviteGroup({ eventId: newId, groupId })),
          ...people.map(person =>
            person.kind === 'user'
              ? inviteUser({ eventId: newId, userId: person.userId })
              : inviteByEmail({ eventId: newId, email: person.email }),
          ),
        ]);
        navigate({ to: '/events/$id', params: { id: newId }, replace: true });
        if (results.some(r => r.status === 'rejected')) {
          void showAlert('Some invites didn’t send', 'Your event was created. You can invite people again from its page.');
        }
      }
    } catch (e) {
      setError(errorMessage(e));
      setSubmitting(false);
    }
  }

  return (
    <SheetPage
      title={isEdit ? 'Edit Event' : 'New Event'}
      action={{ label: isEdit ? 'Save' : 'Create', form: 'event-form', disabled: submitting || (isEdit && !event) }}
    >
      <form id="event-form" onSubmit={onSubmit} className="flex flex-col gap-8">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="event-name">Name</Label>
          <Input
            id="event-name"
            placeholder="Christmas at Grandma's"
            autoFocus={!isEdit}
            value={name}
            onChange={e => {
              setName(e.target.value);
              setError(null);
            }}
            aria-invalid={!!error}
          />
          <ErrorText>{error}</ErrorText>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="event-description">Description (optional)</Label>
          <Textarea
            id="event-description"
            className="min-h-24"
            placeholder="Gift rules, spending limit..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <Section title="Details">
          <FieldRow>
            <label htmlFor="event-date">{multiDay ? 'Starts' : 'Date'}</label>
            <Input id="event-date" type="date" className="w-auto" value={date} onChange={e => setDate(e.target.value)} />
          </FieldRow>
          <label className="cursor-pointer">
            <FieldRow>
              <span>Multiple days</span>
              <Switch aria-label="Multiple days" checked={multiDay} onCheckedChange={setMultiDay} />
            </FieldRow>
          </label>
          {multiDay && (
            <FieldRow>
              <label htmlFor="event-end-date">Ends</label>
              <Input
                id="event-end-date"
                type="date"
                className="w-auto"
                min={date || undefined}
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setError(null);
                }}
              />
            </FieldRow>
          )}
          <FieldRow>
            <span>Start time</span>
            <TimeInput label="Start time" value={startTime} onChange={setStartTime} />
          </FieldRow>
          <FieldRow>
            <span>End time</span>
            <TimeInput label="End time" value={endTime} onChange={setEndTime} />
          </FieldRow>
          <div className="flex gap-3 border-b border-line pb-2">
            <label htmlFor="event-location" className="pt-2">
              Location
            </label>
            <Textarea
              id="event-location"
              placeholder="Grandma's house"
              className="min-h-10 flex-1"
              rows={1}
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>
        </Section>

        {isEdit && (
          <Section title="Secret Santa">
            <label className="cursor-pointer">
              <FieldRow>
                <span>Secret Santa</span>
                <Switch aria-label="Secret Santa" checked={secretSantaOn} onCheckedChange={setSecretSantaOn} disabled={drawn} />
              </FieldRow>
            </label>
            <Footnote>
              {drawn
                ? 'Names have been drawn. Undo the draw to turn Secret Santa off.'
                : secretSantaOn
                  ? 'Hosts can draw names from the event page.'
                  : 'Hosts won’t be asked to draw names for this event.'}
            </Footnote>
          </Section>
        )}

        {!isEdit && (
          <Section title="Guests">
            {groups && groups.length > 0 && (
              <div className="flex flex-col">
                <p className="text-[13px] font-semibold text-ink-muted">Groups</p>
                {groups.map(group => (
                  <label key={group._id} className="flex cursor-pointer items-center justify-between gap-3 border-b border-line py-2">
                    <span className="flex-1">
                      <span className="block">{group.name}</span>
                      <span className="block text-[13px] text-ink-muted">
                        {group.memberCount} {group.memberCount === 1 ? 'person' : 'people'}
                      </span>
                    </span>
                    <Switch
                      aria-label={`Invite ${group.name}`}
                      checked={groupIds.includes(group._id)}
                      onCheckedChange={on => setGroupIds(ids => (on ? [...ids, group._id] : ids.filter(gid => gid !== group._id)))}
                    />
                  </label>
                ))}
              </div>
            )}
            <div className="flex flex-col">
              <p className="pt-2">People</p>
              {people.map(person => (
                <div key={guestKey(person)} className="flex items-center justify-between gap-3 border-b border-line py-2 pl-4">
                  <span className="flex-1">
                    <span className="block">{person.name}</span>
                    {person.kind === 'email' && person.name !== person.email && (
                      <span className="block text-[13px] text-ink-muted">{person.email}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeGuest(guestKey(person))}
                    aria-label={`Remove ${person.name}`}
                    className="flex size-8 items-center justify-center rounded-full hover:bg-fill"
                  >
                    <X className="size-4 text-ink-muted" />
                  </button>
                </div>
              ))}
              <Button variant="link" className="self-start py-2" onClick={() => setPickingPeople(true)}>
                <UserPlus className="size-[18px]" /> Add people
              </Button>
            </div>
          </Section>
        )}
      </form>

      {!isEdit && (
        <SheetDialog
          open={pickingPeople}
          onOpenChange={setPickingPeople}
          title="Add People"
          action={{ label: 'Done', onClick: () => setPickingPeople(false) }}
        >
          <div className="flex flex-col gap-6">
            <GuestPicker
              target={{ kind: 'event', eventId: draftId }}
              guests={people}
              addGuest={addGuest}
              removeGuest={removeGuest}
              onShareLink={shareInviteLink}
              sharing={sharing}
            />
          </div>
        </SheetDialog>
      )}
    </SheetPage>
  );
}
