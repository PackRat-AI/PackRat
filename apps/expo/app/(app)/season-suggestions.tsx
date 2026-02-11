import { Button, LargeTitleHeader, Text, useColorScheme } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useCreatePackWithItems } from 'expo-app/features/packs/hooks/useCreatePackWithItems';
import {
  type PackSuggestion,
  useSeasonSuggestions,
} from 'expo-app/features/packs/hooks/useSeasonSuggestions';
import { LocationPicker } from 'expo-app/features/weather/components';
import type { WeatherLocation } from 'expo-app/features/weather/types';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { assertDefined } from 'expo-app/utils/typeAssertions';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

export default function SeasonSuggestionsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const seasonSuggestionsMutation = useSeasonSuggestions();
  const createPackWithItems = useCreatePackWithItems();
  const [creatingPackIndex, setCreatingPackIndex] = useState<number | null>(null);
  const { colors } = useColorScheme();

  const handleGenerateSuggestions = (location: WeatherLocation) => {
    setIsLocationPickerOpen(false);

    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    assertDefined(currentDate);

    seasonSuggestionsMutation.mutate({
      location: location.name,
      date: currentDate,
    });
  };

  const handleCreatePack = (suggestion: PackSuggestion, index: number) => {
    setCreatingPackIndex(index);

    // Add a short delay to show the loading state
    setTimeout(() => {
      const packId = createPackWithItems(suggestion);

      setCreatingPackIndex(null);

      // Navigate to the created pack
      router.push(`/pack/${packId}`);
    }, 500);
  };

  return (
    <View className="flex-1 bg-background">
      <LargeTitleHeader title={t('seasons.seasonSuggestions')} />

      <ScrollView className="flex-1 px-4">
        <View className="py-6">
          <View className="mb-6">
            <Text variant="body" className="text-muted-foreground">
              {t('seasons.personalizedRecommendations')}
            </Text>
          </View>

          <Button
            onPress={() => setIsLocationPickerOpen(true)}
            disabled={seasonSuggestionsMutation.isPending}
            className="w-full"
          >
            {seasonSuggestionsMutation.isPending ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="white" />
                <Text className="ml-2 text-white">{t('seasons.generatingSuggestions')}</Text>
              </View>
            ) : (
              <View className="flex-row items-center">
                <Icon
                  materialIcon={{ type: 'MaterialIcons', name: 'auto-awesome' }}
                  ios={{ name: 'sparkles' }}
                  size={18}
                  color="white"
                />
                <Text className="ml-2 text-white">{t('seasons.generateSuggestions')}</Text>
              </View>
            )}
          </Button>

          {seasonSuggestionsMutation.error && (
            <View className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <Text variant="callout" className="font-medium text-red-800">
                {t('errors.error')}
              </Text>
              <Text variant="body" className="text-red-700">
                {seasonSuggestionsMutation.error.message}
              </Text>
            </View>
          )}

          {seasonSuggestionsMutation.data && (
            <View className="mt-6 gap-4">
              <View className="flex-row items-center gap-2 mb-4">
                <View className="flex-row items-center gap-1">
                  <Icon
                    materialIcon={{ type: 'MaterialIcons', name: 'eco' }}
                    ios={{ name: 'leaf' }}
                    size={16}
                    color={colors.grey}
                  />
                  <Text className="text-base text-muted-foreground">
                    {seasonSuggestionsMutation.data.season}
                  </Text>
                </View>
                <View className="mx-1 h-1 w-1 rounded-full bg-muted-foreground" />
                <View className="flex-row items-center gap-1">
                  <Icon
                    materialIcon={{ type: 'MaterialIcons', name: 'location-on' }}
                    ios={{ name: 'mappin' }}
                    size={16}
                    color={colors.grey}
                  />
                  <Text className="text-base text-muted-foreground">
                    {seasonSuggestionsMutation.data.location}
                  </Text>
                </View>
              </View>

              {seasonSuggestionsMutation.data.suggestions.map((suggestion, index) => (
                <View key={suggestion.name} className="rounded-xl border border-border bg-card p-4">
                  <View className="mb-3">
                    <Text variant="heading" className="mb-1">
                      {suggestion.name}
                    </Text>
                    <Text variant="caption1" className="text-primary font-medium">
                      {suggestion.category}
                    </Text>
                    <Text variant="body" className="mt-2 text-muted-foreground">
                      {suggestion.description}
                    </Text>
                  </View>

                  <View className="mb-4">
                    <Text variant="subhead" className="mb-2 font-medium">
                      {t('seasons.recommendedItems', { count: suggestion.items.length })}
                    </Text>
                    {suggestion.items.map((item) => (
                      <View key={item.name} className="flex-row items-start py-1">
                        <Text variant="body" className="flex-1">
                          • {item.name} {item.quantity > 1 && `(${item.quantity})`}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <Button
                    variant="secondary"
                    onPress={() => handleCreatePack(suggestion, index)}
                    disabled={creatingPackIndex === index}
                    className="w-full"
                  >
                    {creatingPackIndex === index ? (
                      <View className="flex-row items-center">
                        <ActivityIndicator size="small" />
                        <Text className="ml-2">{t('seasons.creatingPack')}</Text>
                      </View>
                    ) : (
                      <View className="flex-row items-center">
                        <Text className="ml-2">{t('seasons.createThisPack')}</Text>
                      </View>
                    )}
                  </Button>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <LocationPicker
        open={isLocationPickerOpen}
        onClose={() => setIsLocationPickerOpen(false)}
        title={t('location.selectLocation')}
        onSelect={handleGenerateSuggestions}
        selectText={t('auth.next')}
      />
    </View>
  );
}
