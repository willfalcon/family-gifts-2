import MenuView from '@expo/ui/community/menu';
import { GlassView } from 'expo-glass-effect';
import { Link, useLocalSearchParams } from 'expo-router';
import { ChevronRight, Ellipsis, Lock, MessageCircle, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AskForIdeasSheet from '@/components/ask-for-ideas-sheet';
import { BackButton } from '@/components/back-button';
import { FieldRow } from '@/components/profile-form';
import PrivateIdeaRow from '@/components/private-idea-row';
import PrivateIdeaSheet from '@/components/private-idea-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { usePerson, usePrivateIdeas } from '@/hooks/people';
import { occasionParts } from '@/lib/occasion';
import { Doc } from '@convex/_generated/dataModel';

export default function Person() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const person = usePerson(id);
  const isSelf = person?.isSelf ?? false;
  // Private ideas are only for other people.
  const ideas = usePrivateIdeas(person && !isSelf ? id : undefined);
  const firstName = person?.name.split(' ')[0];

  // Undefined = closed, null = adding a new idea, a doc = editing that idea.
  const [editingIdea, setEditingIdea] = useState<Doc<'privateIdeas'> | null | undefined>(undefined);
  const [asking, setAsking] = useState(false);

  const actions = [
    ...(isSelf ? [] : [{ id: 'add-private-idea', title: 'Add private idea' }]),
    { id: 'mute', title: `Mute updates from ${person?.name}` },
    { id: 'copy-link', title: `Copy link to ${person?.name}` },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background p-4">
      <View className="mb-6 flex-row items-center gap-2">
        <View className="flex-0">
          <BackButton />
        </View>
        <Text variant="detail" className="mt-1 flex-1 text-left">
          {person?.name || 'Person'}
        </Text>
        <GlassView style={{ flex: 0, borderRadius: 999, flexDirection: 'row', alignItems: 'center', height: 36 }}>
          {!isSelf && (
            <Button variant="ghost" size="icon" accessibilityLabel="Add private idea" onPress={() => setEditingIdea(null)}>
              <Icon as={Plus} className="text-ink" size={17} />
            </Button>
          )}
          <MenuView
            actions={actions}
            onPressAction={e => {
              if (e.nativeEvent.event === 'add-private-idea') setEditingIdea(null);
            }}
          >
            <Button variant="ghost" size="icon" accessibilityLabel="Person options">
              <Icon as={Ellipsis} />
            </Button>
          </MenuView>
        </GlassView>
      </View>

      <ScrollView contentContainerClassName="gap-8 pb-8">
        <View className="gap-3">
          <Label>Lists</Label>
          {person?.lists.length === 0 && (
            <Text className="text-ink-muted">
              {isSelf ? "You don't have any lists yet." : `${firstName} hasn't shared any lists with you yet.`}
            </Text>
          )}
          {person?.lists.length === 0 && !isSelf && (
            <Button variant="secondary" size="sm" className="self-start rounded-pill" onPress={() => setAsking(true)}>
              <Icon as={MessageCircle} size={16} strokeWidth={2.5} className="text-accent" />
              <Text className="text-accent">Ask for ideas</Text>
            </Button>
          )}
          {person?.lists.map(list => (
            <Link key={list._id} href={{ pathname: '/(app)/(groups)/lists/[id]', params: { id: list._id } }} asChild>
              <Pressable>
                <FieldRow>
                  <View className="flex-1">
                    <Text>{list.title}</Text>
                    <Text className="text-[14px] text-ink-muted">{listDetails(list)}</Text>
                  </View>
                  <Icon as={ChevronRight} />
                </FieldRow>
              </Pressable>
            </Link>
          ))}
        </View>

        {!isSelf && person && (
          <View className="gap-1">
            <View className="mb-2 flex-row items-center gap-1.5">
              <Label>Private ideas</Label>
              <Icon as={Lock} size={12} className="text-ink-muted" />
            </View>
            {ideas?.length === 0 && (
              <Text className="text-ink-muted">
                Jot down gift ideas for {firstName} here. Only you can see them.
              </Text>
            )}
            {ideas?.map(idea => <PrivateIdeaRow key={idea._id} idea={idea} onEdit={setEditingIdea} />)}
            <Button variant="link" className="items-center justify-start px-0" onPress={() => setEditingIdea(null)}>
              <Icon as={Plus} className="text-accent" />
              <Text className="text-accent">Add private idea</Text>
            </Button>
          </View>
        )}
      </ScrollView>

      {person && !isSelf && (
        <PrivateIdeaSheet
          visible={editingIdea !== undefined}
          onClose={() => setEditingIdea(undefined)}
          forUserId={id}
          personName={firstName}
          idea={editingIdea}
        />
      )}
      {person && !isSelf && asking && (
        <AskForIdeasSheet visible onClose={() => setAsking(false)} userId={id} />
      )}
    </SafeAreaView>
  );
}

type PersonList = NonNullable<ReturnType<typeof usePerson>>['lists'][number];

// e.g. "Christmas · 2 of 4 still open"
function listDetails(list: PersonList) {
  const parts = occasionParts(list);
  if (list.openItemCount !== null) {
    parts.push(`${list.openItemCount} of ${list.itemCount} still open`);
  } else {
    parts.push(`${list.itemCount} ${list.itemCount === 1 ? 'idea' : 'ideas'}`);
  }
  return parts.join(' · ');
}
