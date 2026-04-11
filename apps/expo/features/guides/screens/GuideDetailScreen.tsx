import { Text } from '@packrat/ui/nativewindui';
import { Chip } from 'expo-app/components/initial/Chip';
import { Markdown } from 'expo-app/components/Markdown';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useGuideDetails } from '../hooks';

export const GuideDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const navigation = useNavigation();

  const { data: guide, isLoading, error } = useGuideDetails(id || '');

  useLayoutEffect(() => {
    if (guide?.title) {
      navigation.setOptions({
        title: guide.title,
      });
    }
  }, [navigation, guide?.title]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !guide) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900 p-8">
        <Text className="text-center text-gray-500 dark:text-gray-400">
          {t('guides.failedToLoad')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-gray-900"
      contentContainerStyle={{ padding: 16 }}
    >
      <View className="mb-4">
        <Text className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {guide.title}
        </Text>
        <View className="mb-2">
          {guide.categories && guide.categories.length > 0 && (
            <View className="flex-row flex-wrap gap-2 mb-2">
              {guide.categories.map((category: string) => (
                <View key={category} className="bg-primary/10 px-3 py-1.5 rounded-full">
                  <Text className="text-sm font-medium text-primary">
                    {category
                      .split('-')
                      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ')}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <View className="flex-row items-center gap-3">
            {guide.author && (
              <Text className="text-sm text-gray-600 dark:text-gray-400">
                {t('guides.by')} {guide.author}
              </Text>
            )}
            {guide.readingTime && (
              <Text className="text-sm text-gray-600 dark:text-gray-400">{guide.readingTime}</Text>
            )}
            {guide.difficulty && (
              <Chip textClassName="text-sm" variant="secondary">
                {guide.difficulty}
              </Chip>
            )}
          </View>
          <Text className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {t('guides.updated')} {new Date(guide.updatedAt).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {guide.description && (
        <Text className="text-gray-600 dark:text-gray-400 mb-2 text-base">{guide.description}</Text>
      )}

      <Markdown>{guide.content || ''}</Markdown>
    </ScrollView>
  );
};
