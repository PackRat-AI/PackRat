import { Icon } from '@roninoss/icons';
import { useRef, useState } from 'react';
import { Dimensions, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useColorScheme } from '~/lib/hooks/useColorScheme';

interface GuideSearchResult {
  file_id: string;
  filename: string;
  score: number;
  attributes: {
    timestamp: number;
    folder: string;
    filename: string;
  };
  content: Array<{
    id: string;
    type: string;
    text: string;
  }>;
  url: string;
}

interface GuidesSearchResultsData {
  object: string;
  search_query: string;
  data: GuideSearchResult[];
  has_more: boolean;
  next_page: string | null;
}

interface GuidesRAGGenerativeUIProps {
  searchQuery: string;
  results: GuidesSearchResultsData;
}

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth * 0.75; // 75% of screen width
const CARD_SPACING = 16;

export function GuidesRAGGenerativeUI({ searchQuery, results }: GuidesRAGGenerativeUIProps) {
  const { colors } = useColorScheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const formatGuideTitle = (filename: string) => {
    return filename
      .replace('.mdx', '')
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const truncateText = (text: string, maxLength = 120) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  const handleGuidePress = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 0.7) return 'text-green-600';
    if (score >= 0.5) return 'text-yellow-600';
    return 'text-gray-500';
  };

  const getRelevanceText = (score: number) => {
    if (score >= 0.7) return 'Highly Relevant';
    if (score >= 0.5) return 'Relevant';
    return 'Somewhat Relevant';
  };

  const getRelevanceBadgeColor = (score: number) => {
    if (score >= 0.7) return 'bg-green-100 border-green-200';
    if (score >= 0.5) return 'bg-yellow-100 border-yellow-200';
    return 'bg-gray-100 border-gray-200';
  };

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / (CARD_WIDTH + CARD_SPACING));
    setCurrentIndex(index);
  };

  const scrollToIndex = (index: number) => {
    scrollViewRef.current?.scrollTo({
      x: index * (CARD_WIDTH + CARD_SPACING),
      animated: true,
    });
  };

  return (
    <View className="my-4">
      {/* Header */}
      <View className="mb-4 px-4">
        <View className="flex-row items-center gap-2">
          <Icon name="magnify" size={16} color={colors.primary} />
          <Text className="text-sm font-medium text-gray-900">Guide Search Results</Text>
        </View>
        <Text className="mt-1 text-xs text-gray-600">
          Found {results.data.length} guides for "{searchQuery}"
        </Text>
      </View>

      {/* Slider */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{
          paddingHorizontal: CARD_SPACING,
          paddingRight: CARD_SPACING * 2,
        }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        className="mb-4 max-h-80"
      >
        {results.data.map((guide, index) => (
          <TouchableOpacity
            key={guide.file_id}
            onPress={() => handleGuidePress(guide.url)}
            activeOpacity={0.95}
            style={{
              width: CARD_WIDTH,
              marginRight: CARD_SPACING,
            }}
            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm active:scale-[0.98]"
          >
            {/* Relevance Badge */}
            <View className="mb-3 flex-row items-center justify-between">
              <View
                className={`rounded-full border px-2 py-1 ${getRelevanceBadgeColor(guide.score)}`}
              >
                <View className="flex-row items-center gap-1">
                  <Icon name="target" size={10} className={getRelevanceColor(guide.score)} />
                  <Text className={`text-xs font-medium ${getRelevanceColor(guide.score)}`}>
                    {getRelevanceText(guide.score)}
                  </Text>
                </View>
              </View>
              <Icon name="link" size={14} color={colors.primary} />
            </View>

            {/* Guide Title */}
            <Text className="mb-3 text-lg font-bold leading-6 text-gray-900" numberOfLines={2}>
              {formatGuideTitle(guide.filename)}
            </Text>

            {/* Content Preview */}
            {guide.content[0] && (
              <Text className="mb-4 text-sm leading-5 text-gray-700" numberOfLines={4}>
                {truncateText(guide.content[0].text.trim())}
              </Text>
            )}

            {/* Footer */}
            <View className="mt-auto flex-row items-center justify-between">
              <View className="flex-row items-center gap-1">
                <Icon name="book-open-outline" size={12} color={colors.grey2} />
                <Text className="text-xs text-gray-500">PackRat Guides</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Text className="text-xs font-medium text-blue-600">Read More</Text>
                <Icon name="chevron-right" size={12} color={colors.primary} />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Pagination Dots */}
      {results.data.length > 1 && (
        <View className="flex-row items-center justify-center gap-2 px-4">
          {results.data.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => scrollToIndex(index)}
              className={`h-2 rounded-full transition-all duration-200 ${
                index === currentIndex ? 'w-6 bg-blue-600' : 'w-2 bg-gray-300'
              }`}
              activeOpacity={0.7}
            />
          ))}
        </View>
      )}
    </View>
  );
}
