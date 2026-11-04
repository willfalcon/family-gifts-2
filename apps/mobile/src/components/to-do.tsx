import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { ConvexError } from 'convex/values';
import { format } from 'date-fns';
import { Link, type Href } from 'expo-router';
import { ChevronRight, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { localToday } from '@/hooks/events';
import { api } from '@convex/_generated/api';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

type ToDo = FunctionReturnType<typeof api.toDos.mine>[number];

// How many show before "Show all".
const SHOWN = 4;

// The home screen's To do section: what the app suggests doing next (see
// To-do in GLOSSARY.md). Each one goes away once it's done or dismissed.
export default function ToDo() {
  const toDos = useQuery(api.toDos.mine, { today: localToday() });
  const [showAll, setShowAll] = useState(false);
  if (!toDos?.length) return null;

  const shown = showAll ? toDos : toDos.slice(0, SHOWN);
  return (
    <View className="gap-3">
      <Text className="font-semibold text-muted-foreground">To do</Text>
      {shown.map(toDo => (
        <ToDoRow key={toDo.key} toDo={toDo} />
      ))}
      {toDos.length > SHOWN && (
        <Button variant="link" className="self-start px-0" onPress={() => setShowAll(s => !s)}>
          <Text className="text-accent font-normal">{showAll ? 'Show less' : `Show all ${toDos.length}`}</Text>
        </Button>
      )}
    </View>
  );
}

function shortDate(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return format(new Date(y, m - 1, d), 'MMM d');
}

function copyFor(toDo: ToDo) {
  const when = toDo.date ? `${toDo.label} · ${shortDate(toDo.date)}` : toDo.label;
  switch (toDo.kind) {
    case 'makeList':
      return {
        title: toDo.occasion === 'birthday' ? 'Make a list for your birthday' : 'Make a list',
        subtitle: toDo.occasion === 'birthday' ? shortDate(toDo.date!) : when,
      };
    case 'addIdeas':
      return {
        title: 'Add a few ideas to your list',
        subtitle: `${when} · ${toDo.itemCount ? `${toDo.itemCount} so far` : 'nothing on it yet'}`,
      };
    case 'setUpSecretSanta':
      return { title: 'Set up Secret Santa', subtitle: when };
    case 'sendNames':
      return { title: 'Send the names', subtitle: `${toDo.label} · nobody’s been told yet` };
    case 'matchGift':
      return { title: 'Get your Secret Santa gift', subtitle: when };
  }
}

function hrefFor(toDo: ToDo): Href {
  const eventId = toDo.eventId;
  switch (toDo.kind) {
    case 'makeList':
      return {
        pathname: '/(app)/(my-lists)/lists/new',
        params: eventId ? { eventId } : { occasion: 'birthday' },
      };
    case 'addIdeas':
      return { pathname: '/(app)/(dashboard)/lists/[id]', params: { id: toDo.listId! } };
    case 'setUpSecretSanta':
      return { pathname: '/(app)/(events)/events/[id]/secret-santa/setup', params: { id: eventId! } };
    case 'sendNames':
    case 'matchGift':
      return { pathname: '/(app)/(events)/events/[id]/secret-santa', params: { id: eventId! } };
  }
}

function ToDoRow({ toDo }: { toDo: ToDo }) {
  const dismiss = useMutation(api.toDos.dismiss);
  const setSecretSantaOff = useMutation(api.secretSanta.setOff);
  const { title, subtitle } = copyFor(toDo);

  function onDismiss() {
    // Dismissing this one turns Secret Santa off for the event, for every host.
    if (toDo.kind === 'setUpSecretSanta') {
      Alert.alert(
        'Not doing Secret Santa?',
        `Secret Santa will be turned off for ${toDo.label}. Any host can turn it back on by editing the event.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Turn off',
            onPress: () =>
              setSecretSantaOff({ eventId: toDo.eventId!, off: true }).catch(e =>
                Alert.alert('Couldn’t turn off Secret Santa', e instanceof ConvexError ? String(e.data) : 'Try again.'),
              ),
          },
        ],
      );
      return;
    }
    dismiss({ key: toDo.key }).catch(() => {});
  }

  return (
    <View className="flex-row items-center gap-3 border-b border-line pb-2">
      <Link href={hrefFor(toDo)} asChild>
        <Pressable className="flex-1 flex-row items-center gap-2">
          <View className="flex-1">
            <Text className="text-lg">{title}</Text>
            <Text className="text-muted-foreground">{subtitle}</Text>
          </View>
          <Icon as={ChevronRight} size={20} className="text-ink-muted" />
        </Pressable>
      </Link>
      <Pressable accessibilityLabel={`Dismiss ${title}`} hitSlop={8} onPress={onDismiss}>
        <Icon as={X} size={18} className="text-ink-muted" />
      </Pressable>
    </View>
  );
}
