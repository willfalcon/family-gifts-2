import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import type { Id } from '@convex/_generated/dataModel';
import { ItemForm } from '@/components/item-form';
import { SheetPage, useGoBack } from '@/components/page';

export const Route = createFileRoute('/_app/lists/$id/add')({
  // `link`: start from a link (the list's "Paste a link" button).
  validateSearch: z.object({ link: z.string().optional() }),
  head: () => ({ meta: [{ title: 'Add Item · Family Gifts' }] }),
  component: AddItem,
});

function AddItem() {
  const { id } = Route.useParams();
  const { link } = Route.useSearch();
  const goBack = useGoBack();
  const [busy, setBusy] = useState(false);
  return (
    <SheetPage title="Add Item" action={{ label: 'Add', form: 'add-item', disabled: busy }}>
      <ItemForm formId="add-item" listId={id as Id<'lists'>} initialLink={link} onDone={goBack} onBusyChange={setBusy} />
    </SheetPage>
  );
}
