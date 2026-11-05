import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { ConvexError } from 'convex/values';
import { formatDistanceToNowStrict } from 'date-fns';
import { Link } from 'expo-router';
import { MessageCircle, Plus, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { SUGGESTIONS } from '@/components/ask-for-ideas-sheet';
import GlassButton from '@/components/glass-button';
import { threadHref } from '@/components/thread-row';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { localToday } from '@/hooks/events';
import type { Id } from '@convex/_generated/dataModel';
import { api } from '@convex/_generated/api';
import { colors } from '@family-gifts/design-tokens';

type Match = NonNullable<FunctionReturnType<typeof api.asks.secretSanta>>;

// Under your Match, once revealed: ask them for ideas without your name, or
// open the Thread once you have. See .scratch/secret-santa-ask/spec.md.
export default function SecretSantaAsk({ eventId }: { eventId: Id<'events'> }) {
  const match = useQuery(api.asks.secretSanta, { eventId, today: localToday() });
  const [asking, setAsking] = useState(false);
  if (!match) return null;

  if (match.threadId) {
    return (
      <Link href={threadHref(match.threadId)} asChild>
        <Button variant="secondary" className="self-start rounded-pill">
          <Icon as={MessageCircle} size={16} className="text-accent" />
          <Text className="text-accent">Message {match.firstName}</Text>
        </Button>
      </Link>
    );
  }
  if (!match.canAsk) return null;

  return (
    <>
      <Button variant="secondary" className="self-start rounded-pill" onPress={() => setAsking(true)}>
        <Icon as={MessageCircle} size={16} className="text-accent" />
        <Text className="text-accent">Ask for ideas anonymously</Text>
      </Button>
      <SecretSantaAskSheet visible={asking} onClose={() => setAsking(false)} eventId={eventId} match={match} />
    </>
  );
}

function SecretSantaAskSheet({
  visible,
  onClose,
  eventId,
  match,
}: {
  visible: boolean;
  onClose: () => void;
  eventId: Id<'events'>;
  match: Match;
}) {
  const send = useMutation(api.asks.sendSecretSanta);
  // Starts empty: a Secret Santa usually has something specific to ask.
  const [message, setMessage] = useState('');
  const [usedSuggestions, setUsedSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMessage('');
    setUsedSuggestions([]);
    setError(null);
  }, [visible]);

  const addSuggestion = (line: string) => {
    setMessage(m => (m.trim() ? `${m.trimEnd()} ${line}` : line));
    setUsedSuggestions(s => [...s, line]);
  };

  const submit = async () => {
    if (!message.trim()) {
      setError('Write a message first.');
      return;
    }
    setSending(true);
    try {
      await send({ eventId, body: message, today: localToday() });
      onClose();
    } catch (e) {
      setError(e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-background">
        <View className="flex-row items-center gap-2 p-4">
          <GlassButton className="w-20" onPress={onClose} accessibilityLabel="Cancel">
            <Icon as={X} size={20} />
          </GlassButton>
          <Text className="flex-1 text-center text-lg font-bold">Ask Anonymously</Text>
          <GlassButton
            className="w-20"
            accessibilityLabel="Send"
            glassProps={{ tintColor: colors.accent }}
            glassStyle={{ width: 'auto', paddingHorizontal: 8 }}
            onPress={submit}
            disabled={sending || !message.trim()}
          >
            <Text className="font-semibold text-accent-foreground">Send</Text>
          </GlassButton>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-6 px-4 pb-8"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View className="items-center gap-2">
            <View className="size-16 rounded-full items-center justify-center" style={{ backgroundColor: match.color }}>
              <Text className="text-center text-2xl font-semibold text-on-avatar">
                {match.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text className="text-lg font-semibold">{match.name}</Text>
            <Text className="text-center text-subhead text-ink-muted">
              {match.firstName} won’t see your name. They can reply to “Your Secret Santa”.
            </Text>
          </View>

          {match.myAskedAt !== null && (
            <View className="rounded-xl bg-fill p-3">
              <Text className="text-subhead">
                You asked {formatDistanceToNowStrict(match.myAskedAt, { addSuffix: true })}. This will be added to your
                Ask.
              </Text>
            </View>
          )}

          <View className="gap-1.5">
            <Label nativeID="santa-ask-message">Message</Label>
            <Textarea
              aria-labelledby="santa-ask-message"
              placeholder={`What would you like to ask ${match.firstName}?`}
              value={message}
              onChangeText={text => {
                setMessage(text);
                setError(null);
              }}
              aria-invalid={!!error}
            />
            {error && <Text className="text-sm text-destructive">{error}</Text>}
          </View>

          <View className="flex-row flex-wrap gap-2">
            {SUGGESTIONS.filter(s => !usedSuggestions.includes(s)).map(line => (
              <Pressable
                key={line}
                accessibilityRole="button"
                accessibilityLabel={`Add “${line}”`}
                onPress={() => addSuggestion(line)}
                className="flex-row items-center gap-1 rounded-pill border border-line px-3 py-1.5"
              >
                <Icon as={Plus} size={14} className="text-accent" />
                <Text className="text-subhead">{line}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
