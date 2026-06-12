import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { assertDefined } from '@packrat/guards';
import { Button, LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import * as Sentry from '@sentry/react-native';
import { Icon } from 'expo-app/components/Icon';
import { LocationSearchSheet } from 'expo-app/features/packs/components/LocationSearchSheet';
import { LocationSourceSheet } from 'expo-app/features/packs/components/LocationSourceSheet';
import { useBottomSheetAction } from 'expo-app/lib/hooks/useBottomSheetAction';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, View } from 'react-native';

export default function SeasonSuggestionsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const locationSourceSheetRef = useRef<BottomSheetModal>(null);
  const locationSearchSheetRef = useRef<BottomSheetModal>(null);
  const { run: runSourceAction, handleDismiss: handleSourceDismiss } =
    useBottomSheetAction(locationSourceSheetRef);
  const { run: runSearchAction, handleDismiss: handleSearchDismiss } =
    useBottomSheetAction(locationSearchSheetRef);

  const navigateWithLocation = (locationName: string) => {
    const currentDate = new Date().toISOString().split('T')[0];
    assertDefined(currentDate);
    router.push({
      pathname: '/season-suggestions-results',
      params: { location: locationName, date: currentDate },
    });
  };

  const fetchLocationAndNavigate = async () => {
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

      navigateWithLocation(locationName);
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'seasons', action: 'fetchLocationAndNavigate' },
      });
      Alert.alert(t('weather.locationError'), t('weather.locationErrorMessage'));
    } finally {
      setIsGettingLocation(false);
    }
  };

  const requestLocationAndFetch = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      await fetchLocationAndNavigate();
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

  const handleGeneratePress = () => {
    locationSourceSheetRef.current?.present();
  };

  const handleSourceSearchPress = () => {
    runSourceAction(() => {
      locationSearchSheetRef.current?.present();
    });
  };

  const handleSourceCurrentLocationPress = () => {
    runSourceAction(() => {
      requestLocationAndFetch();
    });
  };

  const handleSearchBack = () => {
    runSearchAction(() => {
      locationSourceSheetRef.current?.present();
    });
  };

  const handleLocationSelected = (location: string) => {
    runSearchAction(() => {
      navigateWithLocation(location);
    });
  };

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

          <Button onPress={handleGeneratePress} disabled={isGettingLocation} className="w-full">
            {isGettingLocation ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="white" />
                <Text className="ml-2 text-white">{t('weather.gettingLocation')}</Text>
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
        </View>
      </ScrollView>

      <LocationSourceSheet
        ref={locationSourceSheetRef}
        onSearchPress={handleSourceSearchPress}
        onCurrentLocationPress={handleSourceCurrentLocationPress}
        onDismiss={handleSourceDismiss}
      />

      <LocationSearchSheet
        ref={locationSearchSheetRef}
        onBack={handleSearchBack}
        onLocationSelected={handleLocationSelected}
        onDismiss={handleSearchDismiss}
      />
    </>
  );
}
