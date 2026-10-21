import { ListInput } from '@shared/schemas/list';
import { Control, Controller } from 'react-hook-form';
import { View } from 'react-native';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Text } from './ui/text';

interface Props {
  control: Control<ListInput>;
  onSubmit: () => void;
}
export default function ListForm({ control, onSubmit }: Props) {
  return (
    <Controller
      control={control}
      name="title"
      render={({ field, fieldState }) => (
        <View className="gap-1.5">
          <Label nativeID="list-title">Name</Label>
          <Input
            aria-labelledby="list-title"
            placeholder="List name"
            autoFocus
            returnKeyType="done"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            onSubmitEditing={() => onSubmit()}
            aria-invalid={!!fieldState.error}
          />
          {fieldState.error && <Text className="text-sm text-destructive">{fieldState.error.message}</Text>}
        </View>
      )}
    />
  );
}
