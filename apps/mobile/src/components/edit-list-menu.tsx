import { MenuView } from '@expo/ui/community/menu';
import { useMutation } from 'convex/react';
import { useRouter } from 'expo-router';
import { Ellipsis } from 'lucide-react-native';
import { Alert } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';

interface Props {
  listId: Id<'lists'>;
  archived: boolean;
}

export default function EditListMenu({ listId, archived }: Props) {
  const router = useRouter();
  const archiveList = useMutation(api.lists.archive);
  const unarchiveList = useMutation(api.lists.unarchive);
  const removeList = useMutation(api.lists.remove);

  // Archiving is reversible, so it's the default way to remove a list and
  // skips the confirm. Permanent delete is only offered once it's archived.
  const actions = archived
    ? [
        { id: 'restore', title: 'Restore List' },
        { id: 'delete', title: 'Delete Permanently', attributes: { destructive: true } },
      ]
    : [
        { id: 'edit', title: 'Edit List' },
        { id: 'archive', title: 'Archive List' },
      ];

  return (
    <MenuView
      actions={actions}
      onPressAction={async e => {
        const action = e.nativeEvent.event;
        if (action === 'edit') {
          router.push({ pathname: '/(app)/(my-lists)/lists/[id]/edit', params: { id: listId } });
        } else if (action === 'archive') {
          await archiveList({ id: listId });
          router.back();
        } else if (action === 'restore') {
          await unarchiveList({ id: listId });
        } else if (action === 'delete') {
          Alert.alert('Delete this list?', 'This list and all of its items will be permanently removed.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                await removeList({ id: listId });
                router.back();
              },
            },
          ]);
        }
      }}
    >
      <Button variant="ghost" size="icon" accessibilityLabel="List options">
        <Icon as={Ellipsis} />
      </Button>
    </MenuView>
  );
}
