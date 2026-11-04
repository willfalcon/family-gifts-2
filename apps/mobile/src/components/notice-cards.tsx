import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Link } from 'expo-router';
import { X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { api } from '@convex/_generated/api';
import { Card, CardContent } from './ui/card';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

type Notice = FunctionReturnType<typeof api.notices.mine>[number];

// One dismissible card per notice (a Secret Santa draw that was undone, or
// one waiting for a host to send the names), shown on the home screen
// alongside invites.
export default function NoticeCards() {
  const notices = useQuery(api.notices.mine);
  if (!notices?.length) return null;
  return (
    <View className="gap-3">
      {notices.map(notice => (
        <NoticeCard key={notice._id} notice={notice} />
      ))}
    </View>
  );
}

const COPY: Record<Notice['kind'], { title: string; body: string }> = {
  secretSantaUndone: {
    title: 'The draw was redone',
    body: 'Your old match no longer counts. You’ll get a new one when names are drawn again.',
  },
  secretSantaDrawn: {
    title: 'Names are drawn',
    body: 'Nobody has been told who they have yet. Review them, then send the names.',
  },
};

function NoticeCard({ notice }: { notice: Notice }) {
  const dismiss = useMutation(api.notices.dismiss);
  const { title, body } = COPY[notice.kind];
  const href =
    notice.kind === 'secretSantaDrawn'
      ? ({ pathname: '/(app)/(events)/events/[id]/secret-santa', params: { id: notice.eventId } } as const)
      : ({ pathname: '/(app)/(events)/events/[id]', params: { id: notice.eventId } } as const);

  return (
    <Card>
      <CardContent className="flex-row items-start gap-3">
        <Link href={href} asChild>
          <Pressable className="flex-1">
            <Text className="text-muted-foreground font-semibold text-sm">Secret Santa · {notice.eventName}</Text>
            <Text className="font-bold text-xl">{title}</Text>
            <Text>{body}</Text>
          </Pressable>
        </Link>
        <Pressable accessibilityLabel="Dismiss" hitSlop={8} onPress={() => dismiss({ id: notice._id }).catch(() => {})}>
          <Icon as={X} size={20} className="text-ink-muted" />
        </Pressable>
      </CardContent>
    </Card>
  );
}
