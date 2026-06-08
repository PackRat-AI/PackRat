import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { assertDefined } from '@packrat/guards';
import { Button, LargeTitleHeader, Sheet, Text, useColorScheme } from '@packrat/ui/nativewindui';
import * as Sentry from '@sentry/react-native';
import { Icon } from 'expo-app/components/Icon';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, View } from 'react-native';

export default function SeasonSuggestionsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const { colors } = useColorScheme();
  const permissionSheetRef = useRef<BottomSheetModal>(null);

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

      const currentDate = new Date().toISOString().split('T')[0];
      assertDefined(currentDate);

      router.push({
        pathname: '/season-suggestions-results',
        params: { location: locationName, date: currentDate },
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'seasons', action: 'fetchLocationAndNavigate' },
      });
      Alert.alert(t('weather.locationError'), t('weather.locationErrorMessage'));
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleGeneratePress = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      await fetchLocationAndNavigate();
    } else {
      permissionSheetRef.current?.present();
    }
  };

  const handlePermissionAllow = async () => {
    permissionSheetRef.current?.dismiss();
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
