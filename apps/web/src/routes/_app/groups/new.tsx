import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation } from 'convex/react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { plural } from '@shared/utils';
import { ErrorText } from '@/components/auth-forms';
import { FieldRow, Footnote, Section, SheetPage } from '@/components/page';
import { Label, Switch } from '@/components/ui/controls';
import { Input } from '@/components/ui/input';
import { useLists } from '@/hooks/data';
import { occasionParts } from '@/lib/occasion';
import { errorMessage } from '@/lib/utils';

export const Route = createFileRoute('/_app/groups/new')({
  head: () => ({ meta: [{ title: 'New Group · Family Gifts' }] }),
  component: NewGroup,
});

// Ported from apps/mobile/src/screens/new-group.tsx.
function NewGroup() {
  const navigate = Route.useNavigate();
  const lists = useLists();
  const createGroup = useMutation(api.groups.create);

  const [name, setName] = useState('');
  const [membersCanInvite, setMembersCanInvite] = useState(false);
  const [sharedListIds, setSharedListIds] = useState<Id<'lists'>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleList(listId: Id<'lists'>, checked: boolean) {
    setSharedListIds(ids => (checked ? [...ids, listId] : ids.filter(id => id !== listId)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give your group a name');
      return;
    }
    setSubmitting(true);
    try {
      const id = await createGroup({ name, membersCanInvite, sharedListIds });
      navigate({ to: '/groups/$id', params: { id }, replace: true });
    } catch (e) {
      setError(errorMessage(e));
      setSubmitting(false);
    }
  }

  return (
    <SheetPage title="New Group" action={{ label: 'Create', form: 'new-group', disabled: submitting }}>
      <form id="new-group" onSubmit={onSubmit} className="flex flex-col gap-8">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="group-name">Name</Label>
          <Input
            id="group-name"
            placeholder="Smith Family, Book Club"
            autoFocus
            value={name}
            onChange={e => {
              setName(e.target.value);
              setError(null);
            }}
            aria-invalid={!!error}
          />
          <ErrorText>{error}</ErrorText>
        </div>

        <Section title="Joining">
          <label className="cursor-pointer">
            <FieldRow>
              <span>Members can invite</span>
              <Switch
                aria-label="Members can invite"
                checked={membersCanInvite}
                onCheckedChange={setMembersCanInvite}
              />
            </FieldRow>
          </label>
          <Footnote>
            {membersCanInvite
              ? 'Anyone in the group can share the invite link. People join right away. You can change this later.'
              : 'Only managers can share the invite link. People join right away. You can change this later.'}
          </Footnote>
        </Section>

        {lists && lists.length > 0 && (
          <Section title="Share your lists">
            {lists.map(list => {
              const checked = sharedListIds.includes(list._id);
              // e.g. "12 ideas · Christmas party · Dec 15"
              const summary = [plural(list.itemCount, 'idea'), ...occasionParts(list, 'My birthday')].join(' · ');
              return (
                <label key={list._id} className="cursor-pointer">
                  <FieldRow>
                    <span className="flex-1">
                      <span className="block">{list.title}</span>
                      <span className="block text-[13px] text-ink-muted">{summary}</span>
                    </span>
                    <Switch
                      aria-label={list.title}
                      checked={checked}
                      onCheckedChange={value => toggleList(list._id, value)}
                    />
                  </FieldRow>
                </label>
              );
            })}
          </Section>
        )}
      </form>
    </SheetPage>
  );
}
