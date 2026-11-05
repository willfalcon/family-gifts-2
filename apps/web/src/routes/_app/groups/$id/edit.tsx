import { useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation } from 'convex/react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { ErrorText } from '@/components/auth-forms';
import { NotFound, SheetPage, useGoBack } from '@/components/page';
import { Label } from '@/components/ui/controls';
import { Input } from '@/components/ui/input';
import { useGroup } from '@/hooks/data';
import { errorMessage } from '@/lib/utils';

export const Route = createFileRoute('/_app/groups/$id/edit')({
  head: () => ({ meta: [{ title: 'Edit Group · Family Gifts' }] }),
  component: EditGroup,
});

// Rename a group. Mobile's Edit Group screen is still a stub; this uses
// groups.update, which only managers can call.
function EditGroup() {
  const { id } = Route.useParams();
  const goBack = useGoBack();
  const group = useGroup(id);
  const updateGroup = useMutation(api.groups.update);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fill once, so a live update doesn't wipe what's being typed.
  const filled = useRef(false);
  useEffect(() => {
    if (!group || filled.current) return;
    filled.current = true;
    setName(group.name);
  }, [group]);

  if (group === null) return <NotFound message="This group doesn’t exist, or you’re not in it." />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give your group a name');
      return;
    }
    setSaving(true);
    try {
      await updateGroup({ id: id as Id<'groups'>, name: name.trim() });
      goBack();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <SheetPage title="Edit Group" action={{ label: 'Save', form: 'edit-group', disabled: saving || !group }}>
      <form id="edit-group" onSubmit={onSubmit} className="flex flex-col gap-1.5">
        <Label htmlFor="group-name">Name</Label>
        <Input
          id="group-name"
          autoFocus
          value={name}
          onChange={e => {
            setName(e.target.value);
            setError(null);
          }}
          aria-invalid={!!error}
        />
        <ErrorText>{error}</ErrorText>
      </form>
    </SheetPage>
  );
}
