'use client';

import type { AlertRef } from '@packrat/ui/nativewindui';
import { Alert, Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useCreatePackWithItems } from 'expo-app/features/packs/hooks/useCreatePackWithItems';
import { useHasMinimumInventory } from 'expo-app/features/packs/hooks/useHasMinimumInventory';
import {
  type PackSuggestion,
  useSeasonSuggestions,
} from 'expo-app/features/packs/hooks/useSeasonSuggestions';
import { useActiveLocation } from 'expo-app/features/weather/hooks/useActiveLocation';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Stack, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

export default function SeasonSuggestionsScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { activeLocation } = useActiveLocation();
  const { hasMinimumItems, currentItemCount } = useHasMinimumInventory(20);
  const seasonSuggestionsMutation = useSeasonSuggestions();
  const createPackWithItems = useCreatePackWithItems();
  const alertRef = useRef<AlertRef>(null);
  const [creatingPackIndex, setCreatingPackIndex] = useState<number | null>(null);

  const handleGenerateSuggestions = () => {
    if (!hasMinimumItems) {
      alertRef.current?.show();
      return;
    }

    if (!activeLocation) {
      // TODO: Show location not available alert
      return;
    }

    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    seasonSuggestionsMutation.mutate({
      location: activeLocation.name,
      date: currentDate,
    });
  };

  const handleCreatePack = async (suggestion: PackSuggestion, index: number) => {
    setCreatingPackIndex(index);

    try {
      // Create the pack with items
      const packId = createPackWithItems(suggestion);

      // Navigate to the created pack
      router.push(`/pack/${packId}`);
    } catch (error) {
      console.error('Failed to create pack:', error);
    } finally {
      setCreatingPackIndex(null);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: 'Season Suggestions',
          headerLargeTitle: false,
        }}
      />

      <ScrollView className="flex-1 px-4">
        <View className="py-6">
          <View className="mb-6">
            <Text variant="title2" className="mb-2">
              AI-Powered Seasonal Pack Ideas
            </Text>
            <Text variant="body" className="text-muted-foreground">
              Get personalized pack recommendations based on your gear inventory and current season.
            </Text>
          </View>

          {!hasMinimumItems ? (
            <View className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <View className="flex-row items-center mb-2">
                <Icon name="information-outline" size={20} color={colors.orange} />
                <Text variant="callout" className="ml-2 font-medium text-orange-800">
                  Minimum Inventory Required
                </Text>
              </View>
              <Text variant="body" className="text-orange-700">
                You need at least 20 items in your inventory to generate seasonal suggestions. You
                currently have {currentItemCount} items.
              </Text>
            </View>
          ) : (
            <View className="space-y-4">
              <Button
                onPress={handleGenerateSuggestions}
                disabled={seasonSuggestionsMutation.isPending || !activeLocation}
                className="w-full"
              >
                {seasonSuggestionsMutation.isPending ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator size="small" color="white" />
                    <Text className="ml-2 text-white">Generating suggestions...</Text>
                  </View>
                ) : (
                  <View className="flex-row items-center">
                    <Icon name="sparkles" size={18} color="white" />
                    <Text className="ml-2 text-white">Generate Season Suggestions</Text>
                  </View>
                )}
              </Button>

              {!activeLocation && (
                <View className="mt-2 rounded-xl border border-yellow-200 bg-yellow-50 p-3">
                  <Text variant="caption" className="text-center text-yellow-800">
                    Please set your location in Weather settings to generate suggestions
                  </Text>
                </View>
              )}
            </View>
          )}

          {seasonSuggestionsMutation.error && (
            <View className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <Text variant="callout" className="font-medium text-red-800">
                Error
              </Text>
              <Text variant="body" className="text-red-700">
                {seasonSuggestionsMutation.error.message}
              </Text>
            </View>
          )}

          {seasonSuggestionsMutation.data && (
            <View className="mt-6 space-y-4">
              <Text variant="title3" className="mb-4">
                {seasonSuggestionsMutation.data.season} Suggestions for{' '}
                {seasonSuggestionsMutation.data.location}
              </Text>

              {seasonSuggestionsMutation.data.suggestions.map((suggestion, index) => (
                <View
                  key={suggestion.name}
                  className="rounded-xl border border-gray-200 bg-card p-4"
                >
                  <View className="mb-3">
                    <Text variant="headline" className="mb-1">
                      {suggestion.name}
                    </Text>
                    <Text variant="caption" className="text-primary font-medium">
                      {suggestion.category}
                    </Text>
                    <Text variant="body" className="mt-2 text-muted-foreground">
                      {suggestion.description}
                    </Text>
                  </View>

                  <View className="mb-4">
                    <Text variant="subheadline" className="mb-2 font-medium">
                      Recommended Items ({suggestion.items.length})
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
                        <Text className="ml-2">Creating Pack...</Text>
                      </View>
                    ) : (
                      <View className="flex-row items-center">
                        <Icon name="plus" size={16} />
                        <Text className="ml-2">Create This Pack</Text>
                      </View>
                    )}
                  </Button>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Alert
        ref={alertRef}
        title="Insufficient Inventory"
        message={`You need at least 20 items in your inventory to generate seasonal suggestions. You currently have ${currentItemCount} items. Add more items to your packs to unlock this feature.`}
        materialIcon={{ name: 'information-outline' }}
        materialWidth={370}
        buttons={[
          {
            text: 'Add Items',
            style: 'default',
            onPress: () => router.push('/gear-inventory'),
          },
          {
            text: 'OK',
            style: 'cancel',
          },
        ]}
      />
    </View>
  );
}
