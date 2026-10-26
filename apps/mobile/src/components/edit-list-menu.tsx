import { MenuView } from '@expo/ui/community/menu';
import { useRouter } from 'expo-router';
import { Ellipsis } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Id } from '@convex/_generated/dataModel';

interface Props {
  listId: Id<'lists'>;
}

export default function EditListMenu({ listId }: Props) {
  const router = useRouter();
  return (
    <MenuView
      actions={[
        { id: 'edit', title: 'Edit List' },
        { id: 'delete', title: 'Delete List', attributes: { destructive: true } },
      ]}
      onPressAction={e => {
        const action = e.nativeEvent.event;
        if (action === 'edit') {
          router.push({ pathname: '/(app)/(lists)/lists/[id]/edit', params: { id: listId } });
        } else if (action === 'delete') {
          // TODO: confirm and delete list
        }
      }}
    >
      <Button variant="ghost" size="icon" accessibilityLabel="List options">
        <Icon as={Ellipsis} size={18} />
      </Button>
    </MenuView>
  );
}
