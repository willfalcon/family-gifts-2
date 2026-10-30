import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { Lock, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';

import GlassButton from '@/components/glass-button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@convex/_generated/api';
import { Doc } from '@convex/_generated/dataModel';
import { colors } from '@family-gifts/design-tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  // Who the idea is for (Better Auth user id) and their name, for the header.
  forUserId: string;
  personName?: string;
  // Pass an existing idea to edit it; leave out to add a new one.
  idea?: Doc<'privateIdeas'> | null;
};

// A page sheet for adding or editing a private idea. It's a plain RN Modal
// rather than a route so it can open from any tab's stack (a person's page or
// one of their lists) without adding modal routes to each one.
export default function PrivateIdeaSheet({ visible, onClose, forUserId, personName, idea }: Props) {
  const createIdea = useMutation(api.privateIdeas.create);
  const updateIdea = useMutation(api.privateIdeas.update);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset the form each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setTitle(idea?.title ?? '');
    setDescription(idea?.description ?? '');
    setError(null);
  }, [visible, idea]);

  const save = async () => {
    if (!title.trim()) {
      setError('Give your idea a title.');
      return;
    }
    setSaving(true);
    try {
      const fields = { title, description: description || undefined };
      if (idea) await updateIdea({ id: idea._id, ...fields });
      else await createIdea({ forUserId, ...fields });
      onClose();
    } catch (e) {
      setError(e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-background">
        <View className="flex-row items-center gap-2 p-4">
          <GlassButton className="w-20" onPress={onClose} accessibilityLabel="Cancel">
            <Icon as={X} size={20} />
          </GlassButton>
          <Text className="flex-1 text-center text-lg font-bold">{idea ? 'Edit Idea' : 'Private Idea'}</Text>
          <GlassButton
            className="w-20"
            accessibilityLabel={idea ? 'Save idea' : 'Add idea'}
            glassProps={{ tintColor: colors.accent }}
            glassStyle={{ width: 'auto', paddingHorizontal: 8 }}
            onPress={save}
            disabled={saving}
          >
            <Text className="font-semibold text-accent-foreground">{idea ? 'Save' : 'Add'}</Text>
          </GlassButton>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-6 px-4 pb-8"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View className="flex-row items-center gap-2">
            <Icon as={Lock} size={14} className="text-ink-muted" />
            <Text className="flex-1 text-sm text-ink-muted">
              Only you can see this{personName ? ` — ${personName} won't` : ''}.
            </Text>
          </View>

          <View className="gap-1.5">
            <Label nativeID="idea-title">Title</Label>
            <Input
              aria-labelledby="idea-title"
              placeholder="e.g. Pottery class"
              autoFocus
              returnKeyType="next"
              value={title}
              onChangeText={text => {
                setTitle(text);
                setError(null);
              }}
              aria-invalid={!!error}
            />
            {error && <Text className="text-sm text-destructive">{error}</Text>}
          </View>

          <View className="gap-1.5">
            <Label nativeID="idea-description">Description (optional)</Label>
            <Textarea
              aria-labelledby="idea-description"
              placeholder="Where to get it, why they'd like it..."
              value={description}
              onChangeText={setDescription}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
