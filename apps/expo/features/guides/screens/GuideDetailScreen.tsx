import { Text } from '@packrat/ui/src/text';
import { Markdown } from 'expo-app/components/Markdown';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { GuideCard, useGuideByline } from '../components/GuideCard';
import { GuidesMessage } from '../components/GuidesMessage';
import { useGuideDetails, useGuides } from '../hooks';
import { guideCategoryLabel } from '../lib/categories';

const RELATED_COUNT = 3;
// Caps the text column on tablets and landscape: long lines are hard to track back from.
const READING_WIDTH = 640;
const CONTENT_STYLE = Object.freeze({
  paddingHorizontal: 20,
  paddingTop: 8,
  paddingBottom: 40,
  width: '100%',
  maxWidth: READING_WIDTH,
  alignSelf: 'center',
} as const);

// M3 secondary container / on-secondary container, from the Android palette in global.css.
// The `bg-secondary` utility resolves to the iOS-derived palette, which in dark mode is a pale
// cyan behind white text.
const TAG_COLORS = Object.freeze({
  light: { background: 'rgb(176, 201, 255)', text: 'rgb(20, 55, 108)' },
  dark: { background: 'rgb(28, 60, 114)', text: 'rgb(189, 209, 255)' },
} as const);

function Tag({ label }: { label: string }) {
  const { isDarkColorScheme } = useColorScheme();
  const tagColors = TAG_COLORS[isDarkColorScheme ? 'dark' : 'light'];
  return (
    <View className="rounded-lg px-3 py-1.5" style={{ backgroundColor: tagColors.background }}>
      <Text className="text-xs font-medium leading-4" textColor={tagColors.text}>
        {label}
      </Text>
    </View>
  );
}

/** Same box model as the loaded header and opening lines, so nothing jumps when it arrives. */
function DetailSkeleton() {
  return (
    <ScrollView
      contentContainerStyle={CONTENT_STYLE}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View className="mb-4 flex-row gap-2">
        <View className="h-7 w-24 rounded-lg bg-border" />
        <View className="h-7 w-20 rounded-lg bg-border" />
      </View>
      <View className="mb-1 h-8 w-full rounded bg-border" />
      <View className="mb-3 h-8 w-3/5 rounded bg-border" />
      <View className="mb-6 h-4 w-1/2 rounded bg-border" />
      {Array.from({ length: 6 }, (_, i) => (
        <View key={i} className={`mb-3 h-4 rounded bg-border ${i === 5 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </ScrollView>
  );
}

export const GuideDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();

  const { data: guide, isLoading, isError, refetch } = useGuideDetails(id || '');
  const topic = guide?.categories?.[0];
  const related = useGuides({ category: topic, enabled: !!topic });
  const byline = useGuideByline(guide ?? {});

  // The title is the first thing in the page, so the bar stays a plain back bar.
  useLayoutEffect(() => {
    navigation.setOptions({ title: '' });
  }, [navigation]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <DetailSkeleton />
      </View>
    );
  }

  if (isError || !guide) {
    return (
      <View className="flex-1 bg-background">
        <GuidesMessage
          icon="error"
          title={t('guides.guideFailedTitle')}
          body={t('guides.checkConnection')}
          action={{ label: t('guides.tryAgain'), onPress: () => refetch() }}
        />
      </View>
    );
  }

  // Some guides tag their difficulty as a category too ("advanced"), so de-duplicate by label.
  const tags = [
    ...new Set([
      ...(guide.categories ?? []).map((category) => guideCategoryLabel({ slug: category, t })),
      ...(guide.difficulty ? [guide.difficulty] : []),
    ]),
  ];
  const updated = t('guides.updatedOn', {
    date: new Date(guide.updatedAt).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
  });
  const relatedGuides = (related.data?.pages[0]?.items ?? [])
    .filter((item) => item.id !== guide.id)
    .slice(0, RELATED_COUNT);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={CONTENT_STYLE}>
      {tags.length > 0 ? (
        <View className="mb-4 flex-row flex-wrap gap-2">
          {tags.map((tag) => (
            <Tag key={tag} label={tag} />
          ))}
        </View>
      ) : null}

      <Text className="text-[28px] font-normal leading-9 text-foreground" wrap>
        {guide.title}
      </Text>
      <Text className="mt-3 text-sm leading-5 text-muted-foreground" wrap>
        {[byline, updated].filter(Boolean).join(' · ')}
      </Text>

      {guide.description ? (
        <Text className="mt-6 text-lg leading-7 text-muted-foreground" wrap>
          {guide.description}
        </Text>
      ) : null}

      <View className="my-6 h-px bg-border" />

      <Markdown
        styles={{
          body: { fontSize: 16, lineHeight: 26 },
          heading1: {
            fontSize: 24,
            lineHeight: 32,
            fontWeight: '400',
            marginTop: 28,
            marginBottom: 12,
          },
          heading2: {
            fontSize: 22,
            lineHeight: 28,
            fontWeight: '500',
            marginTop: 24,
            marginBottom: 8,
          },
          heading3: {
            fontSize: 18,
            lineHeight: 24,
            fontWeight: '500',
            marginTop: 20,
            marginBottom: 8,
          },
          blockquote: { backgroundColor: colors.card, borderRadius: 8, paddingVertical: 4 },
        }}
      >
        {guide.content || ''}
      </Markdown>

      {relatedGuides.length > 0 ? (
        <View className="mt-10">
          <Text className="mb-3 text-lg font-medium leading-6 text-foreground">
            {t('guides.relatedGuides')}
          </Text>
          {relatedGuides.map((item) => (
            <GuideCard
              key={item.id}
              guide={item}
              compact
              testID={testIds.guides.relatedCard(item.id)}
              onPress={() => router.push({ pathname: '/guides/[id]', params: { id: item.id } })}
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
};
