import { Text } from '@packrat/ui/src/text';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Pressable, View } from 'react-native';
import type { PostAuthor } from '../types';
import { displayName } from '../utils/mentions';
import { PersonAvatar } from './PersonAvatar';

/** People matching the `@` query being typed, shown under the field until one is picked. */
export function MentionSuggestionList({
  suggestions,
  onSelect,
}: {
  suggestions: PostAuthor[];
  onSelect: (person: PostAuthor) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  if (suggestions.length === 0) return null;
  return (
    <View
      className="overflow-hidden rounded-xl border border-border bg-card"
      testID={testIds.feed.mentionSuggestions}
    >
      {suggestions.map((person, index) => (
        <Pressable
          key={person.id}
          onPress={() => onSelect(person)}
          android_ripple={{ color: colors.grey5 }}
          className={`min-h-[48px] flex-row items-center gap-3 px-4 py-2${
            index > 0 ? ' border-t border-border' : ''
          }`}
          accessibilityRole="button"
          testID={testIds.feed.mentionSuggestion(person.id)}
        >
          <PersonAvatar person={person} size={32} />
          <Text className="flex-1">{displayName(person) || t('feed.packratMember')}</Text>
        </Pressable>
      ))}
    </View>
  );
}
