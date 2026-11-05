import { useMutation, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { formatDistanceToNowStrict } from 'date-fns';
import { Plus, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import GlassButton from '@/components/glass-button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { localToday } from '@/hooks/events';
import { formatOccasionDate } from '@/lib/occasion';
import { cn } from '@/lib/utils';
import { api } from '@convex/_generated/api';
import { colors } from '@family-gifts/design-tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  // Who's being asked (Better Auth user id).
  userId: string;
  // Asking from an event's page fixes the occasion to that event.
  eventId?: string;
};

// Lines you can tap to add to the message.
export const SUGGESTIONS = ['Any sizes?', 'What are you into lately?', 'Experiences count too'];

function ago(time: number) {
  return formatDistanceToNowStrict(time, { addSuffix: true });
}

// The Ask for ideas sheet (see Ask in GLOSSARY.md). A plain RN Modal rather
// than a route, so it can open from any tab's stack.
export default function AskForIdeasSheet({ visible, onClose, userId, eventId }: Props) {
  const compose = useQuery(api.asks.compose, visible ? { userId, eventId, today: localToday() } : 'skip');
  const send = useMutation(api.asks.send);

  const [optionKey, setOptionKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  // Once they've typed, picking another occasion leaves their message alone.
  const [edited, setEdited] = useState(false);
  const [usedSuggestions, setUsedSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Start fresh each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setOptionKey(null);
    setEdited(false);
    setUsedSuggestions([]);
    setError(null);
  }, [visible]);

  // Soonest occasion first; "No occasion" is last.
  const option = compose?.options.find(o => o.key === optionKey) ?? compose?.options[0];

  useEffect(() => {
    if (!compose || edited) return;
    const phrase = option?.phrase ? ` for ${option.phrase}` : '';
    setMessage(`Hey ${compose.firstName}! Any gift ideas${phrase}?`);
  }, [compose?.firstName, option?.key, edited]);

  const addSuggestion = (line: string) => {
    setMessage(m => (m.trim() ? `${m.trimEnd()} ${line}` : line));
    setUsedSuggestions(s => [...s, line]);
    setEdited(true);
  };

  const submit = async () => {
    if (!compose || !option) return;
    if (!message.trim()) {
      setError('Write a message first.');
      return;
    }
    setSending(true);
    try {
      await send({ askedId: userId, occasion: option.occasion ?? undefined, body: message, today: localToday() });
      onClose();
    } catch (e) {
      setError(e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.');
    } finally {
      setSending(false);
    }
  };

  const canSend = !!compose?.canAsk && !!option && !sending;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-background">
        <View className="flex-row items-center gap-2 p-4">
          <GlassButton className="w-20" onPress={onClose} accessibilityLabel="Cancel">
            <Icon as={X} size={20} />
          </GlassButton>
          <Text className="flex-1 text-center text-lg font-bold">Ask for Ideas</Text>
          <GlassButton
            className="w-20"
            accessibilityLabel="Send"
            glassProps={{ tintColor: colors.accent }}
            glassStyle={{ width: 'auto', paddingHorizontal: 8 }}
            onPress={submit}
            disabled={!canSend}
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
          {compose && (
            <View className="items-center gap-2">
              <View
                className="size-16 rounded-full items-center justify-center"
                style={{ backgroundColor: compose.color }}
              >
                <Text className="text-center text-2xl font-semibold text-on-avatar">
                  {compose.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text className="text-lg font-semibold">{compose.name}</Text>
            </View>
          )}

          {compose && !compose.canAsk && (
            <Text className="text-center text-ink-muted">
              You can only ask people you share a group or event with.
            </Text>
          )}

          {compose && compose.options.length > 1 && (
            <View className="gap-2">
              <Label>For</Label>
              <View className="flex-row flex-wrap gap-2">
                {compose.options.map(o => {
                  const selected = o.key === option?.key;
                  return (
                    <Pressable
                      key={o.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setOptionKey(o.key)}
                      className={cn('rounded-pill border px-3 py-1.5', selected ? 'border-accent bg-accent' : 'border-line')}
                    >
                      <Text className={cn('text-subhead', selected && 'text-accent-foreground font-semibold')}>
                        {o.label}
                        {o.date ? ` · ${formatOccasionDate(o.date)}` : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {option && (option.myAskedAt !== null || option.otherAskers.length > 0) && (
            <View className="gap-1 rounded-xl bg-fill p-3">
              {option.myAskedAt !== null && (
                <Text className="text-subhead">
                  You asked {ago(option.myAskedAt)}. This will be added to your Ask.
                </Text>
              )}
              {option.otherAskers.map(asker => (
                <Text key={`${asker.name}-${asker.askedAt}`} className="text-subhead text-ink-muted">
                  {asker.name} asked {ago(asker.askedAt)}
                </Text>
              ))}
            </View>
          )}

          <View className="gap-1.5">
            <Label nativeID="ask-message">Message</Label>
            <Textarea
              aria-labelledby="ask-message"
              value={message}
              onChangeText={text => {
                setMessage(text);
                setEdited(true);
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
