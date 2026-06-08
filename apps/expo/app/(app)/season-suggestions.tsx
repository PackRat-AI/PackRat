import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { assertDefined } from '@packrat/guards';
import { Button, LargeTitleHeader, Sheet, Text, useColorScheme } from '@packrat/ui/nativewindui';
import * as Sentry from '@sentry/react-native';
import { Icon } from 'expo-app/components/Icon';
import { useCreatePackWithItems } from 'expo-app/features/packs/hooks/useCreatePackWithItems';
import {
  type PackSuggestion,
  useSeasonSuggestions,
} from 'expo-app/features/packs/hooks/useSeasonSuggestions';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, View } from 'react-native';

export default function SeasonSuggestionsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const seasonSuggestionsMutation = useSeasonSuggestions();
  const createPackWithItems = useCreatePackWithItems();
  const [creatingPackIndex, setCreatingPackIndex] = useState<number | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const { colors } = useColorScheme();
  const permissionSheetRef = useRef<BottomSheetModal>(null);

  const fetchLocationAndGenerate = async () => {
    setIsGettingLocation(true);
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const [geocode] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });

      const locationName =
        geocode?.city ??
        geocode?.region ??
        geocode?.country ??
        `${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`;

      const currentDate = new Date().toISOString().split('T')[0];
      assertDefined(currentDate);

      seasonSuggestionsMutation.mutate({ location: locationName, date: currentDate });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'seasons', action: 'fetchLocationAndGenerate' },
      });
      Alert.alert(t('weather.locationError'), t('weather.locationErrorMessage'));
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleGeneratePress = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      await fetchLocationAndGenerate();
    } else {
      permissionSheetRef.current?.present();
    }
  };

  const handlePermissionAllow = async () => {
    permissionSheetRef.current?.dismiss();
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      await fetchLocationAndGenerate();
    } else {
      Alert.alert(t('weather.permissionDenied'), t('weather.permissionDeniedMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('weather.openSettings'),
          onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              Linking.openSettings();
            }
          },
        },
      ]);
    }
  };

  const handleCreatePack = ({
    suggestion,
    index,
  }: {
    suggestion: PackSuggestion;
    index: number;
  }) => {
    setCreatingPackIndex(index);

    setTimeout(() => {
      const packId = createPackWithItems(suggestion);
      setCreatingPackIndex(null);
      router.push(`/pack/${packId}`);
    }, 500);
  };

  const isLoading = isGettingLocation || seasonSuggestionsMutation.isPending;

  return (
    <>
      <LargeTitleHeader title={t('seasons.seasonSuggestions')} />

      <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1 px-4">
        <View className="py-6">
          <View className="mb-6">
            <Text variant="body" className="text-muted-foreground">
              {t('seasons.personalizedRecommendations')}
            </Text>
          </View>

          <Button onPress={handleGeneratePress} disabled={isLoading} className="w-full">
            {isGettingLocation ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="white" />
                <Text className="ml-2 text-white">{t('weather.gettingLocation')}</Text>
              </View>
            ) : seasonSuggestionsMutation.isPending ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="white" />
                <Text className="ml-2 text-white">{t('seasons.generatingSuggestions')}</Text>
              </View>
            ) : (
              <View className="flex-row items-center">
                <Icon
                  namingScheme="sfSymbol"
                  name="sparkles"
                  materialIcon={{ type: 'MaterialIcons', name: 'auto-awesome' }}
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
                    namingScheme="sfSymbol"
                    name="leaf"
                    materialIcon={{ type: 'MaterialIcons', name: 'eco' }}
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
                    namingScheme="sfSymbol"
                    name="mappin"
                    materialIcon={{ type: 'MaterialIcons', name: 'location-on' }}
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
                    onPress={() => handleCreatePack({ suggestion, index })}
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

      <Sheet
        ref={permissionSheetRef}
        enableDynamicSizing
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{ backgroundColor: colors.grey2 }}
      >
        <BottomSheetView className="px-6 pb-10 pt-2">
          <View className="items-center gap-5">
            <View className="h-16 w-16 rounded-full bg-primary/10 items-center justify-center">
              <Icon
                ios={{ useMaterialIcon: true }}
                materialIcon={{ type: 'MaterialIcons', name: 'my-location' }}
                size={30}
                color={colors.primary}
              />
            </View>

            <View className="items-center gap-2">
              <Text className="text-lg font-semibold text-center">
                {t('seasons.locationPermissionTitle')}
              </Text>
              <Text className="text-muted-foreground text-center text-sm leading-relaxed">
                {t('seasons.locationPermissionDescription')}
              </Text>
            </View>

            <View className="w-full flex-row gap-3">
              <Button
                variant="secondary"
                onPress={() => permissionSheetRef.current?.dismiss()}
                className="flex-1"
              >
                <Text>{t('seasons.notNow')}</Text>
              </Button>
              <Button onPress={handlePermissionAllow} className="flex-1">
                <Text className="text-white font-medium">{t('seasons.allowLocationAccess')}</Text>
              </Button>
            </View>
          </View>
        </BottomSheetView>
      </Sheet>
    </>
  );
}
