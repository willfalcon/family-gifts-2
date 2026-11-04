import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Text } from './ui/text';

export default function ToDo() {
  return (
    <View>
      <Text className="font-semibold text-muted-foreground">To do</Text>
      <ToDoItem id="secret-santa" title="Set up Secret Santa" subtitle="Family Christmas Party - Dec 25" />
      <ToDoItem id="add-items" title="Add a few ideas to your list" subtitle="Your family can see 2 so far" />
    </View>
  );
}

interface TodoItemProps {
  id: string;
  // done: boolean,
  // setDone: () => void,
  title: string;
  subtitle?: string;
}

function ToDoItem({ id, title, subtitle }: TodoItemProps) {
  const [done, setDone] = useState(false);
  return (
    <View className="flex-row gap-3">
      <Checkbox aria-labelledby={id} className="mt-2" checked={done} onCheckedChange={setDone} />
      <View>
        <Label
          nativeID={id}
          htmlFor={id}
          // Native has no built-in label-to-control link, so toggle on tap.
          // On web, htmlFor does it, and an onPress would toggle twice.
          onPress={Platform.select({ native: () => setDone(d => !d) })}
          className="text-lg"
        >
          {title}
        </Label>
        {subtitle && <Text className="text-muted-foreground">{subtitle}</Text>}
      </View>
    </View>
  );
}
