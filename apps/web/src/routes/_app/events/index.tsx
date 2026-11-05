import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Calendar, ChevronDown, ChevronRight, Plus } from 'lucide-react';

import { EventListItem, InvitationListItem, type EventRow } from '@/components/event-list-item';
import { EmptyState, Page, TabHeader } from '@/components/page';
import { Button } from '@/components/ui/button';
import { useEvents, useMyEventInvites } from '@/hooks/data';
import { localToday } from '@/lib/utils';

export const Route = createFileRoute('/_app/events/')({
  head: () => ({ meta: [{ title: 'Events · Family Gifts' }] }),
  component: Events,
});

// Splits already-sorted events into runs by the month they start in, keeping
// their order. Months in the current year are just "October"; other years get
// the year too ("January, 2027"). Undated events go under "No date".
function groupByMonth(events: EventRow[]) {
  const thisYear = new Date().getFullYear();
  const sections: { key: string; title: string; events: EventRow[] }[] = [];
  for (const event of events) {
    const key = event.date?.slice(0, 7) ?? 'none';
    let section = sections.at(-1);
    if (!section || section.key !== key) {
      let title = 'No date';
      if (event.date) {
        const [year, month] = event.date.split('-').map(Number);
        const name = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' });
        title = year === thisYear ? name : `${name}, ${year}`;
      }
      section = { key, title, events: [] };
      sections.push(section);
    }
    section.events.push(event);
  }
  return sections;
}

function MonthHeading({ children }: { children: string }) {
  return <h2 className="pt-4 text-[15px] font-semibold text-ink-muted">{children}</h2>;
}

// A click-to-expand heading, for the Past and Archived sections.
function Disclosure({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="mt-6 flex items-center gap-1 self-start py-2"
      onClick={onToggle}
      aria-expanded={open}
    >
      <span className="font-semibold text-ink-muted">{label}</span>
      {open ? <ChevronDown className="size-4 text-ink-muted" /> : <ChevronRight className="size-4 text-ink-muted" />}
    </button>
  );
}

function Events() {
  const events = useEvents();
  const invites = useMyEventInvites();
  const [showPast, setShowPast] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // An event is past once its last day is behind us. Undated events stay in
  // "upcoming" and sort last.
  const today = localToday();
  const sorted = [...(events ?? [])].sort((a, b) => (a.date ?? '￿').localeCompare(b.date ?? '￿'));
  const isPast = (e: EventRow) => {
    const last = e.endDate ?? e.date;
    return !!last && last < today;
  };
  // Archived events only show in their own section.
  const active = sorted.filter(e => !e.archived);
  const upcoming = active.filter(e => !isPast(e));
  // Most recent first.
  const past = active.filter(isPast).reverse();
  const archived = sorted.filter(e => e.archived).reverse();

  return (
    <Page className="gap-6">
      <TabHeader
        title="Events"
        action={
          <Button asChild variant="ghost" size="icon" className="glass">
            <Link to="/events/new" aria-label="Add event" title="Add event">
              <Plus className="size-5" />
            </Link>
          </Button>
        }
      />

      {events && events.length === 0 && !invites?.length ? (
        <EmptyState
          icon={Calendar}
          title="Nothing on the calendar yet"
          body="Birthdays from your groups show up here on their own. You can also plan a party or a gift exchange and invite anyone."
        >
          <Button asChild size="lg" className="mt-4 w-full max-w-xs">
            <Link to="/events/new">Create an event</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {!!invites?.length && <MonthHeading>{`Invitations · ${invites.length}`}</MonthHeading>}
          {invites?.map(invite => (
            <InvitationListItem key={invite._id} invite={invite} />
          ))}

          {groupByMonth(upcoming).map(section => (
            <div key={`upcoming-${section.key}`} className="flex flex-col gap-2">
              <MonthHeading>{section.title}</MonthHeading>
              {section.events.map(event => (
                <EventListItem key={event._id} event={event} />
              ))}
            </div>
          ))}

          <Link to="/events/new" className="flex items-center gap-2 self-start">
            <span className="flex size-11 items-center justify-center">
              <Plus className="size-5 text-accent" />
            </span>
            <span className="text-accent">Add Event</span>
          </Link>

          {past.length > 0 && (
            <Disclosure label={`Past · ${past.length}`} open={showPast} onToggle={() => setShowPast(v => !v)} />
          )}
          {showPast &&
            groupByMonth(past).map(section => (
              <div key={`past-${section.key}`} className="flex flex-col gap-2">
                <MonthHeading>{section.title}</MonthHeading>
                {section.events.map(event => (
                  <EventListItem key={event._id} event={event} past />
                ))}
              </div>
            ))}

          {archived.length > 0 && (
            <Disclosure
              label={`Archived · ${archived.length}`}
              open={showArchived}
              onToggle={() => setShowArchived(v => !v)}
            />
          )}
          {showArchived && archived.map(event => <EventListItem key={event._id} event={event} />)}
        </div>
      )}
    </Page>
  );
}
