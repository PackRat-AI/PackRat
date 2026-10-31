import { Text } from '@packrat/ui/src/text';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Pressable, View } from 'react-native';
import { guideCategoryLabel } from '../lib/categories';
import type { Guide } from '../types';

interface GuideCardProps {
  guide: Guide;
  onPress: () => void;
  testID: string;
  /** Drops the summary, for the Related guides list under an article. */
  compact?: boolean;
}

/** "By Jamie Rivera · 6 min read", from whichever parts the guide has. */
export function useGuideByline(guide: Pick<Guide, 'author' | 'readingTime'>): string {
  const { t } = useTranslation();
  return [
    guide.author ? t('guides.byAuthor', { author: guide.author }) : null,
    guide.readingTime ? t('guides.readingTime', { count: guide.readingTime }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export const GuideCard = ({ guide, onPress, testID, compact = false }: GuideCardProps) => {
  const { t } = useTranslation();
  const byline = useGuideByline(guide);
  const topic = guide.categories?.[0] ?? guide.category;
  const overline = [topic ? guideCategoryLabel({ slug: topic, t }) : null, guide.difficulty]
    .filter(Boolean)
    .join(' · ');

  return (
    // A plain RN surface, not `Card`. On Android `Card` is a Compose card whose RN children are
    // hosted through `RNHostView matchContents`, which reports its size asynchronously after
    // mount. In a FlatList every row therefore mounts at the wrong height and resizes a frame
    // later, so cards render blank or clipped and the rows below jump while the list loads and
    // scrolls (#2767). Elevation 1 on the card colour is M3's elevated card.
    <Pressable
      onPress={onPress}
      android_ripple={{ borderless: false }}
      className="mb-3 overflow-hidden rounded-xl bg-card"
      style={{ elevation: 1 }}
      accessibilityRole="button"
      testID={testID}
    >
      <View className="gap-1 p-4">
        {overline ? (
          <Text className="text-xs font-medium leading-4 text-muted-foreground" numberOfLines={1}>
            {overline}
          </Text>
        ) : null}
        <Text className="text-lg font-medium leading-6 text-foreground" numberOfLines={2} wrap>
          {guide.title}
        </Text>
        {!compact && guide.description ? (
          <Text className="text-sm leading-5 text-muted-foreground" numberOfLines={2} wrap>
            {guide.description}
          </Text>
        ) : null}
        {byline ? (
          <Text className="mt-1 text-xs font-medium leading-4 text-muted-foreground">{byline}</Text>
        ) : null}
      </View>
    </Pressable>
  );
};
