import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ChevronRight, Lock, MessageCircle, Plus } from 'lucide-react';

import type { Doc } from '@convex/_generated/dataModel';
import { ActionsMenu, FieldRow, NotFound, Page, PageHeader, Section } from '@/components/page';
import { copyLink } from '@/components/guest-picker';
import { AskForIdeasDialog, PrivateIdeaDialog, PrivateIdeaRow } from '@/components/sheets';
import { Button } from '@/components/ui/button';
import { usePerson, usePrivateIdeas } from '@/hooks/data';
import { occasionParts } from '@/lib/occasion';
import { firstName } from '@/lib/utils';

export const Route = createFileRoute('/_app/people/$id')({
  head: () => ({ meta: [{ title: 'Person · Family Gifts' }] }),
  component: Person,
});

type PersonList = NonNullable<ReturnType<typeof usePerson>>['lists'][number];

// e.g. "Christmas · 2 of 4 still open"
function listDetails(list: PersonList) {
  const parts = occasionParts(list);
  if (list.openItemCount !== null) parts.push(`${list.openItemCount} of ${list.itemCount} still open`);
  else parts.push(`${list.itemCount} ${list.itemCount === 1 ? 'idea' : 'ideas'}`);
  return parts.join(' · ');
}

// Someone's lists you can see, and your private ideas for them.
function Person() {
  const { id } = Route.useParams();
  const person = usePerson(id);
  const isSelf = person?.isSelf ?? false;
  const ideas = usePrivateIdeas(person && !isSelf ? id : undefined);
  const first = firstName(person?.name);
  // undefined = closed, null = adding, a doc = editing that idea.
  const [editingIdea, setEditingIdea] = useState<Doc<'privateIdeas'> | null | undefined>(undefined);
  const [asking, setAsking] = useState(false);

  if (person === null) return <NotFound message="You can’t see this person’s profile." />;

  return (
    <Page>
      <PageHeader
        title={person?.name || 'Person'}
        actions={
          <>
            {!isSelf && person && (
              <Button variant="ghost" size="icon" className="glass" aria-label="Add private idea" title="Add private idea" onClick={() => setEditingIdea(null)}>
                <Plus className="size-[18px]" />
              </Button>
            )}
            <ActionsMenu
              label="Person options"
              actions={[
                !isSelf && { label: 'Add private idea', onSelect: () => setEditingIdea(null) },
                !isSelf && person && { label: 'Ask for ideas', onSelect: () => setAsking(true) },
                { label: `Copy link to ${person?.name ?? 'this person'}`, onSelect: () => void copyLink(window.location.href) },
              ]}
            />
          </>
        }
      />

      <Section title="Lists">
        {person?.lists.length === 0 && (
          <p className="text-ink-muted">{isSelf ? 'You don’t have any lists yet.' : `${first} hasn’t shared any lists with you yet.`}</p>
        )}
        {person?.lists.length === 0 && !isSelf && (
          <Button variant="secondary" size="sm" className="self-start" onClick={() => setAsking(true)}>
            <MessageCircle className="text-accent" strokeWidth={2.5} />
            <span className="text-accent">Ask for ideas</span>
          </Button>
        )}
        {person?.lists.map(list => (
          <Link key={list._id} to="/lists/$id" params={{ id: list._id }}>
            <FieldRow>
              <span className="flex-1">
                <span className="block">{list.title}</span>
                <span className="block text-[14px] text-ink-muted">{listDetails(list)}</span>
              </span>
              <ChevronRight className="size-5" />
            </FieldRow>
          </Link>
        ))}
      </Section>

      {!isSelf && person && (
        <Section
          title={
            <span className="flex items-center gap-1.5">
              Private ideas <Lock className="size-3" />
            </span>
          }
        >
          {ideas?.length === 0 && <p className="text-ink-muted">Jot down gift ideas for {first} here. Only you can see them.</p>}
          {ideas?.map(idea => <PrivateIdeaRow key={idea._id} idea={idea} onEdit={setEditingIdea} />)}
          <Button variant="link" className="self-start" onClick={() => setEditingIdea(null)}>
            <Plus /> Add private idea
          </Button>
        </Section>
      )}

      {person && !isSelf && (
        <>
          <PrivateIdeaDialog
            open={editingIdea !== undefined}
            onClose={() => setEditingIdea(undefined)}
            forUserId={id}
            personName={first}
            idea={editingIdea}
          />
          <AskForIdeasDialog open={asking} onClose={() => setAsking(false)} userId={id} />
        </>
      )}
    </Page>
  );
}
