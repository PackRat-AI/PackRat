import { Text } from '@packrat/ui/src/text';
import { Image } from 'expo-image';
import { View } from 'react-native';
import type { PostAuthor } from '../types';
import { initials } from '../utils/mentions';

/** A person's photo, or their initials on a tinted circle when they have none. */
export function PersonAvatar({
  person,
  size = 40,
}: {
  person: PostAuthor | null | undefined;
  size?: number;
}) {
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (person?.avatarUrl) {
    return (
      <Image source={{ uri: person.avatarUrl }} style={style} accessibilityIgnoresInvertColors />
    );
  }
  return (
    <View style={style} className="items-center justify-center bg-primary/15">
      <Text style={{ fontSize: size * 0.38 }} className="font-semibold text-primary">
        {person ? initials(person) : ''}
      </Text>
    </View>
  );
}
