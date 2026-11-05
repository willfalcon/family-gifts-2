import { useEffect, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { listSchema, type ListInput } from '@shared/schemas/list';
import { ListForm } from '@/components/list-form';
import { SheetPage } from '@/components/page';
import { useGroups, useProfile } from '@/hooks/data';
import { errorMessage } from '@/lib/utils';

// Opening it with `eventId`, or `occasion=birthday` or `christmas`, starts the
// list for that occasion (as the Make a list To-do and Asks do).
const searchSchema = z.object({
  eventId: z.string().optional(),
  occasion: z.enum(['birthday', 'christmas']).optional(),
});

export const Route = createFileRoute('/_app/lists/new')({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: 'New List · Family Gifts' }] }),
  component: NewList,
});

function startingOccasion(params: z.infer<typeof searchSchema>): ListInput['occasion'] {
  if (params.eventId) return { kind: 'event', eventId: params.eventId as Id<'events'> };
  if (params.occasion === 'birthday') return { kind: 'birthday' };
  if (params.occasion === 'christmas') return { kind: 'christmas' };
  return undefined;
}

function NewList() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { control, handleSubmit, formState, setError, resetField } = useForm<ListInput>({
    resolver: zodResolver(listSchema),
    defaultValues: { title: '', occasion: startingOccasion(search), sharedWithGroupIds: [] },
  });

  // Start "Who can see it?" from the profile's "Share new lists with" setting,
  // once both have loaded (and only once). Groups since left are skipped.
  const profile = useProfile();
  const groups = useGroups();
  const defaultsReady = profile !== undefined && groups !== undefined;
  const appliedDefaults = useRef(false);
  useEffect(() => {
    if (!defaultsReady || appliedDefaults.current) return;
    appliedDefaults.current = true;
    const myGroupIds = new Set(groups.map(g => g._id));
    const sharedWithGroupIds = (profile?.shareNewLists ?? []).filter(id => myGroupIds.has(id));
    resetField('sharedWithGroupIds', { defaultValue: sharedWithGroupIds });
  }, [defaultsReady, profile, groups, resetField]);

  const createList = useMutation(api.lists.create);

  const onSubmit = handleSubmit(async values => {
    try {
      const id = await createList(values);
      navigate({ to: '/lists/$id', params: { id }, replace: true });
    } catch (e) {
      setError('title', { message: errorMessage(e) });
    }
  });

  return (
    <SheetPage
      title="New List"
      // Wait for the sharing defaults, so a quick click can't create an unshared list.
      action={{ label: 'Create', form: 'new-list', disabled: formState.isSubmitting || !defaultsReady }}
    >
      <form id="new-list" onSubmit={onSubmit} className="flex flex-col gap-6">
        <ListForm control={control} eventId={search.eventId} />
      </form>
    </SheetPage>
  );
}
