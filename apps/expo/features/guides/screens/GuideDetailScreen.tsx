import { Text } from '@packrat/ui/nativewindui';
import Markdown from '@ronradtke/react-native-markdown-display';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useGuideDetails } from '../hooks';

export const GuideDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDarkColorScheme } = useColorScheme();

  const { data: guide, isLoading, error } = useGuideDetails(id || '');

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
        <Text className="text-center text-gray-500 dark:text-gray-400">Failed to load guide</Text>
      </View>
    );
  }

  const markdownStyles = {
    body: {
      color: isDarkColorScheme ? '#e5e7eb' : '#1f2937',
      fontSize: 16,
      lineHeight: 24,
    },
    heading1: {
      color: isDarkColorScheme ? '#f3f4f6' : '#111827',
      fontSize: 28,
      fontWeight: '700',
      marginTop: 24,
      marginBottom: 16,
    },
    heading2: {
      color: isDarkColorScheme ? '#f3f4f6' : '#111827',
      fontSize: 24,
      fontWeight: '600',
      marginTop: 20,
      marginBottom: 12,
    },
    heading3: {
      color: isDarkColorScheme ? '#f3f4f6' : '#111827',
      fontSize: 20,
      fontWeight: '600',
      marginTop: 16,
      marginBottom: 8,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 16,
    },
    strong: {
      fontWeight: '600' as const,
    },
    link: {
      color: colors.primary,
      textDecorationLine: 'underline' as const,
    },
    blockquote: {
      backgroundColor: isDarkColorScheme ? '#374151' : '#f3f4f6',
      borderLeftColor: colors.primary,
      borderLeftWidth: 4,
      paddingLeft: 16,
      paddingVertical: 8,
      marginVertical: 16,
    },
    code_inline: {
      backgroundColor: isDarkColorScheme ? '#374151' : '#f3f4f6',
      color: isDarkColorScheme ? '#fbbf24' : '#dc2626',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      fontFamily: 'monospace',
      fontSize: 14,
    },
    code_block: {
      backgroundColor: isDarkColorScheme ? '#1f2937' : '#f3f4f6',
      color: isDarkColorScheme ? '#e5e7eb' : '#1f2937',
      padding: 16,
      borderRadius: 8,
      marginVertical: 16,
      fontFamily: 'monospace',
      fontSize: 14,
    },
    list_item: {
      marginBottom: 8,
    },
    bullet_list: {
      marginBottom: 16,
    },
    ordered_list: {
      marginBottom: 16,
    },
    hr: {
      backgroundColor: isDarkColorScheme ? '#4b5563' : '#e5e7eb',
      height: 1,
      marginVertical: 24,
    },
    table: {
      borderColor: isDarkColorScheme ? '#4b5563' : '#e5e7eb',
      marginVertical: 16,
    },
    th: {
      backgroundColor: isDarkColorScheme ? '#374151' : '#f3f4f6',
      color: isDarkColorScheme ? '#f3f4f6' : '#111827',
      fontWeight: '600',
      padding: 12,
    },
    td: {
      padding: 12,
      borderColor: isDarkColorScheme ? '#4b5563' : '#e5e7eb',
    },
  };

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
              <Text className="text-sm text-gray-600 dark:text-gray-400">By {guide.author}</Text>
            )}
            {guide.readingTime && (
              <Text className="text-sm text-gray-600 dark:text-gray-400">{guide.readingTime}</Text>
            )}
            {guide.difficulty && (
              <View className="bg-secondary/10 px-2 py-0.5 rounded">
                <Text className="text-xs font-medium text-secondary">{guide.difficulty}</Text>
              </View>
            )}
          </View>
          <Text className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Updated {new Date(guide.updatedAt).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {guide.description && (
        <Text className="text-gray-600 dark:text-gray-400 mb-6 text-base">{guide.description}</Text>
      )}

      <Markdown style={markdownStyles}>{guide.content || ''}</Markdown>
    </ScrollView>
  );
};
