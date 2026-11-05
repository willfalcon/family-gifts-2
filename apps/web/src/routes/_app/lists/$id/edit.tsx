import { useEffect, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { useForm } from 'react-hook-form';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { listSchema, type ListInput } from '@shared/schemas/list';
import { ListForm } from '@/components/list-form';
import { SheetPage, useGoBack } from '@/components/page';
import { useList, useListShares } from '@/hooks/data';
import { errorMessage } from '@/lib/utils';

export const Route = createFileRoute('/_app/lists/$id/edit')({
  head: () => ({ meta: [{ title: 'Edit List · Family Gifts' }] }),
  component: EditList,
});

function EditList() {
  const { id } = Route.useParams();
  const listId = id as Id<'lists'>;
  const goBack = useGoBack();
  const list = useList(listId);
  const shares = useListShares(listId);
  const updateList = useMutation(api.lists.update);

  const { control, handleSubmit, formState, setError, reset } = useForm<ListInput>({
    resolver: zodResolver(listSchema),
    defaultValues: { title: '', sharedWithGroupIds: [] },
  });

  // Fill the form once, so a live update doesn't wipe what's being typed.
  const filled = useRef(false);
  useEffect(() => {
    if (!list || shares === undefined || filled.current) return;
    filled.current = true;
    reset({
      title: list.title,
      occasion: list.occasion,
      sharedWithGroupIds: shares.flatMap(s => (s.kind === 'group' ? [s.groupId] : [])),
    });
  }, [list, shares, reset]);

  const onSubmit = handleSubmit(async values => {
    try {
      await updateList({ id: listId, ...values });
      goBack();
    } catch (e) {
      setError('title', { message: errorMessage(e) });
    }
  });

  return (
    <SheetPage title="Edit List" action={{ label: 'Save', form: 'edit-list', disabled: formState.isSubmitting || !list }}>
      <form id="edit-list" onSubmit={onSubmit} className="flex flex-col gap-6">
        <ListForm control={control} />
      </form>
    </SheetPage>
  );
}
