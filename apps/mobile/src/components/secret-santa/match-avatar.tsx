import { Image, Text, View } from 'react-native';

const AVATAR_SIZE = 112;

// Their photo if they have one, otherwise their initial on their event color.
export default function MatchAvatar({ match }: { match: { name: string; image: string | null; color: string } }) {
  if (match.image) {
    return (
      <Image
        source={{ uri: match.image }}
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }}
        accessibilityLabel={match.name}
      />
    );
  }
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, backgroundColor: match.color }}
    >
      {/* The line height has to grow with the font size, or the default
          (sized for body text) clips the top and bottom of the letter. */}
      <Text
        className="text-center font-semibold text-on-avatar"
        style={{ fontSize: AVATAR_SIZE * 0.45, lineHeight: AVATAR_SIZE * 0.45 * 1.2 }}
      >
        {match.name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
