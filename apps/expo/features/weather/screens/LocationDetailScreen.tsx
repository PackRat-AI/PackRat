import { useActionSheet } from '@expo/react-native-action-sheet';
import { Text } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import { getWeatherBackgroundColors } from 'expo-app/features/weather/lib/weatherService';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StatusBar, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WeatherForecast } from '../components';
import { useActiveLocation, useLocationRefresh, useLocations } from '../hooks';

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors, colorScheme } = useColorScheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { locationsState } = useLocations();
  const { setActiveLocation } = useActiveLocation();
  const { isRefreshing, refreshLocation } = useLocationRefresh();
  const [error, setError] = useState<string | null>(null);
  const [gradientColors, setGradientColors] = useState<[string, string, ...string[]]>([
    '#4c669f',
    '#3b5998',
    '#192f6a',
  ]);
  const { showActionSheetWithOptions } = useActionSheet();
  const { removeLocation } = useLocations();

  const locationId = parseInt(String(id), 10);
  // Get the locations array safely
  const locations = locationsState.state === 'hasData' ? locationsState.data : [];
  const location = locations.find((loc) => loc.id === locationId);

  // Refresh weather data for this location
  const handleRefresh = async () => {
    if (!location) return;

    setError(null);
    const success = await refreshLocation(location.id);

    if (!success) {
      setError(t('weather.failedToRefresh'));
    } else {
      // Update gradient colors based on weather condition
      if (location.details) {
        const weatherCode = location.details.weatherCode || 1000;
        const isNight = location.details.isDay === 0;
        setGradientColors(getWeatherBackgroundColors(weatherCode, isNight));
      }
    }
  };

  // Load weather data on initial render
  useEffect(() => {
    if (location) {
      handleRefresh();
    }
  }, []);

  if (!location) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>{t('weather.locationNotFound')}</Text>
        <TouchableOpacity
          className="mt-4 rounded-full bg-primary px-4 py-2"
          onPress={() => router.back()}
        >
          <Text className="text-white">{t('weather.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const showOptionsMenu = () => {
    const options = location.isActive
      ? [t('weather.refreshWeather'), t('weather.removeLocation'), t('common.cancel')]
      : [
          t('weather.setAsActive'),
          t('weather.refreshWeather'),
          t('weather.removeLocation'),
          t('common.cancel'),
        ];

    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = options.indexOf(t('weather.removeLocation'));
    const refreshIndex = options.indexOf(t('weather.refreshWeather'));
    const setActiveIndex = options.indexOf(t('weather.setAsActive'));

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex,
        title: location.name,
        message: `${location.temperature}° - ${location.condition}`,
        containerStyle: {
          backgroundColor: colorScheme === 'dark' ? colors.card : 'white',
          paddingBottom: insets.bottom,
        },
        textStyle: {
          color: colors.foreground,
        },
        titleTextStyle: {
          color: colors.foreground,
          fontWeight: '600',
        },
        messageTextStyle: {
          color: colors.grey2,
        },
      },
      (selectedIndex) => {
        switch (selectedIndex) {
          case setActiveIndex:
            setAsActive();
            break;
          case refreshIndex:
            handleRefresh();
            break;
          case destructiveButtonIndex:
            handleRemoveLocation();
            break;
          case cancelButtonIndex:
            // Canceled
            break;
        }
      },
    );
  };

  const setAsActive = () => {
    if (location.isActive) {
      Alert.alert(
        t('weather.alreadyActive'),
        t('weather.alreadyActiveMessage', { name: location.name }),
        [{ text: t('common.ok') }],
      );
      return;
    }

    setActiveLocation(location.id);
    Alert.alert(
      t('weather.locationSet'),
      t('weather.locationSetAsActive', { name: location.name }),
      [{ text: t('common.ok') }],
    );
  };

  const handleRemoveLocation = () => {
    Alert.alert(
      t('weather.removeLocation'),
      t('weather.removeLocationConfirm', { name: location.name }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('weather.remove'),
          style: 'destructive',
          onPress: () => {
            removeLocation(location.id);
            router.back();
          },
        },
      ],
    );
  };

  // Determine if we should use light or dark status bar based on gradient colors
  const _isDarkGradient =
    gradientColors[0].toLowerCase().startsWith('#4') ||
    gradientColors[0].toLowerCase().startsWith('#3') ||
    gradientColors[0].toLowerCase().startsWith('#2') ||
    gradientColors[0].toLowerCase().startsWith('#1');

  return (
    <View className="flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      {/* Status bar with matching style */}
      <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />

      <LinearGradient colors={gradientColors} style={{ flex: 1 }}>
        {/* Fixed header buttons */}
        <View
          style={{ paddingTop: insets.top + 10 }}
          className="absolute left-0 right-0 top-0 z-10 flex-row items-center justify-between px-4"
        >
          <TouchableOpacity onPress={() => router.back()}>
            <View className="rounded-full bg-white/20 p-2">
              <Icon name="arrow-left" color="white" size={20} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity className="rounded-full bg-white/20 p-2" onPress={showOptionsMenu}>
            <Icon name="dots-horizontal" color="white" size={20} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingBottom: insets.bottom + 20,
            paddingTop: insets.top + 50,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-4">
            {error ? (
              <View className="items-center justify-center py-20">
                <Icon name="exclamation" color="white" size={40} />
                <Text className="mt-4 text-white">{error}</Text>
                <TouchableOpacity
                  className="mt-4 rounded-full bg-white/20 px-4 py-2"
                  onPress={handleRefresh}
                >
                  <Text className="text-white">{t('weather.tryAgain')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Location name and current weather */}
                <View className="mt-8 items-center">
                  <View className="flex-row items-center">
                    <Text className="text-3xl font-semibold text-white">{location.name}</Text>
                    {location.isActive && (
                      <View className="ml-2 rounded-full bg-white/30 px-2 py-0.5">
                        <Text className="text-xs text-white">{t('weather.active')}</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-lg text-white/80">{location.time}</Text>
                  <Text className="mt-6 text-8xl font-light text-white">
                    {location.temperature}°
                  </Text>
                  <Text className="text-xl text-white">{location.condition}</Text>
                  <Text className="mt-1 text-white/80">
                    H:{location.highTemp}° L:{location.lowTemp}°
                  </Text>

                  {!location.isActive && (
                    <TouchableOpacity
                      className="mt-4 rounded-full bg-white/20 px-4 py-2"
                      onPress={setAsActive}
                    >
                      <Text className="text-white">{t('weather.setAsActiveLocation')}</Text>
                    </TouchableOpacity>
                  )}

                  {/* Refresh button */}
                  <TouchableOpacity
                    className="mt-4 flex-row items-center rounded-full bg-white/20 px-4 py-2"
                    onPress={handleRefresh}
                    disabled={isRefreshing}
                  >
                    <View className="mr-2">
                      <Icon name="restart" color="white" size={20} />
                    </View>
                    <Text className="text-white">
                      {isRefreshing ? t('weather.refreshing') : t('weather.refresh')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <WeatherForecast
                  hourlyForecast={location.hourlyForecast}
                  dailyForecast={location.dailyForecast}
                  details={location.details}
                  temperature={location.temperature}
                />
              </>
            )}
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}
