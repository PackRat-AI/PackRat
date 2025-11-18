import { Card, CardContent, CardTitle, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { TouchableOpacity, View } from 'react-native';
import type { Guide } from '../types';

interface GuideCardProps {
  guide: Guide;
  onPress: () => void;
}

export const GuideCard: React.FC<GuideCardProps> = ({ guide, onPress }) => {
  const { t } = useTranslation();
  
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="pt-4">
      <Card className="mb-3">
        <CardContent className="p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <CardTitle className="text-lg font-semibold mb-1">{guide.title}</CardTitle>
              {guide.description && (
                <Text className="text-sm text-gray-600 dark:text-gray-400 mb-2" numberOfLines={2}>
                  {guide.description}
                </Text>
              )}
              <View className="flex-col gap-2">
                {guide.categories && guide.categories.length > 0 ? (
                  <View className="flex-row flex-wrap gap-1.5">
                    {guide.categories.slice(0, 2).map((category) => (
                      <View key={category} className="bg-primary/10 px-2 py-1 rounded-full">
                        <Text className="text-xs font-medium text-primary">
                          {category
                            .split('-')
                            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ')}
                        </Text>
                      </View>
                    ))}
                    {guide.categories.length > 2 && (
                      <View className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                        <Text className="text-xs text-gray-600 dark:text-gray-400">
                          +{guide.categories.length - 2}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full self-start">
                    <Text className="text-xs text-gray-700 dark:text-gray-300">
                      {guide.category}
                    </Text>
                  </View>
                )}
                <View className="flex-row items-center gap-2">
                  {guide.author && (
                    <Text className="text-xs text-gray-600 dark:text-gray-400">
                      {t('guides.by')} {guide.author}
                    </Text>
                  )}
                  {guide.readingTime && (
                    <Text className="text-xs text-gray-600 dark:text-gray-400">
                      • {guide.readingTime}
                    </Text>
                  )}
                  {guide.difficulty && (
                    <View className="bg-secondary/10 px-1.5 py-0.5 rounded">
                      <Text className="text-xs font-medium text-secondary">{guide.difficulty}</Text>
                    </View>
                  )}
                  <Text className="text-xs text-gray-500 dark:text-gray-500">
                    • {new Date(guide.updatedAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </View>
            <Icon name="chevron-right" size={24} color="gray-400" />
          </View>
        </CardContent>
      </Card>
    </TouchableOpacity>
  );
};
