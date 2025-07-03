import { useActionSheet } from '@expo/react-native-action-sheet';
import { Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { getWeatherBackgroundColors } from 'expo-app/features/weather/lib/weatherService';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StatusBar, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WeatherIcon } from '../components';
import { useActiveLocation, useLocationRefresh, useLocations } from '../hooks';

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors, colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const { locationsState } = useLocations();
  const { setActiveLocation } = useActiveLocation();
  const { isRefreshing, refreshLocation } = useLocationRefresh();
  const [error, setError] = useState<string | null>(null);
  const [gradientColors, setGradientColors] = useState(['#4c669f', '#3b5998', '#192f6a']);
  const { showActionSheetWithOptions } = useActionSheet();
  const { removeLocation } = useLocations();

  // Get the locations array safely
  const locations = locationsState.state === 'hasData' ? locationsState.data : [];
  const location = locations.find((loc) => loc.id === id);

  // Refresh weather data for this location
  const handleRefresh = async () => {
    if (!location) return;

    setError(null);
    const success = await refreshLocation(location.id);

    if (!success) {
      setError('Failed to refresh weather data');
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
  }, [id]);

  if (!location) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Location not found</Text>
        <TouchableOpacity
          className="mt-4 rounded-full bg-primary px-4 py-2"
          onPress={() => router.back()}
        >
          <Text className="text-white">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const showOptionsMenu = () => {
    const options = location.isActive
      ? ['Refresh Weather', 'Remove Location', 'Cancel']
      : ['Set as Active', 'Refresh Weather', 'Remove Location', 'Cancel'];

    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = options.indexOf('Remove Location');
    const refreshIndex = options.indexOf('Refresh Weather');
    const setActiveIndex = options.indexOf('Set as Active');

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex,
        title: location.name,
        message: `${location.temperature}° - ${location.condition}`,
        containerStyle: {
          backgroundColor: colorScheme === 'dark' ? colors.card : 'white',
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
      Alert.alert('Already Active', `${location.name} is already set as your active location.`, [
        { text: 'OK' },
      ]);
      return;
    }

    setActiveLocation(location.id);
    Alert.alert('Location Set', `${location.name} has been set as your active location.`, [
      { text: 'OK' },
    ]);
  };

  const handleRemoveLocation = () => {
    Alert.alert('Remove Location', `Are you sure you want to remove ${location.name}?`, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removeLocation(location.id);
          router.back();
        },
      },
    ]);
  };

  // Determine if we should use light or dark status bar based on gradient colors
  const isDarkGradient =
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
                <Icon name="alert-circle" color="white" size={40} />
                <Text className="mt-4 text-white">{error}</Text>
                <TouchableOpacity
                  className="mt-4 rounded-full bg-white/20 px-4 py-2"
                  onPress={handleRefresh}
                >
                  <Text className="text-white">Try Again</Text>
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
                        <Text className="text-xs text-white">Active</Text>
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
                      <Text className="text-white">Set as Active Location</Text>
                    </TouchableOpacity>
                  )}

                  {/* Refresh button */}
                  <TouchableOpacity
                    className="mt-4 flex-row items-center rounded-full bg-white/20 px-4 py-2"
                    onPress={handleRefresh}
                    disabled={isRefreshing}
                  >
                    <Icon name="restart" color="white" size={20} className="mr-2" />
                    <Text className="text-white">{isRefreshing ? 'Refreshing...' : 'Refresh'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Hourly forecast */}
                <View className="mt-8 rounded-xl bg-white/10 p-4">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {location.hourlyForecast ? (
                      location.hourlyForecast.map((hour, index) => (
                        <View key={index} className="mr-4 min-w-[50px] items-center">
                          <Text className="text-white">{index === 0 ? 'Now' : hour.time}</Text>
                          <WeatherIcon
                            code={hour.weatherCode}
                            isDay={hour.isDay}
                            color="white"
                            size={24}
                            className="my-2"
                          />
                          <Text className="text-white">{hour.temp}°</Text>
                        </View>
                      ))
                    ) : (
                      <View className="w-full items-center justify-center py-4">
                        <Text className="text-white/80">Hourly forecast not available</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>

                {/* 10-Day forecast */}
                <View className="mt-4 rounded-xl bg-white/10 p-4">
                  <Text className="mb-2 font-medium text-white">
                    {location.dailyForecast ? `${location.dailyForecast.length}-DAY` : 'DAILY'}{' '}
                    FORECAST
                  </Text>
                  {location.dailyForecast ? (
                    location.dailyForecast.map((day, index) => (
                      <View
                        key={index}
                        className={cn(
                          'flex-row items-center justify-between py-3',
                          index !== (location.dailyForecast?.length || 0) - 1 &&
                            'border-b border-white/10',
                        )}
                      >
                        <Text className="min-w-[40px] text-white">{day.day}</Text>
                        <Icon name={day.icon} color="white" size={24} />
                        <View className="flex-1 flex-row items-center px-4">
                          <View className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                            <View
                              className="absolute h-1 bg-white"
                              style={{
                                left: `${Math.max(0, ((day.low - 40) / (100 - 40)) * 100)}%`,
                                right: `${Math.max(0, 100 - ((day.high - 40) / (100 - 40)) * 100)}%`,
                              }}
                            />
                          </View>
                        </View>
                        <Text className="min-w-[30px] text-right text-white/90">{day.low}°</Text>
                        <Text className="min-w-[30px] text-right text-white">{day.high}°</Text>
                      </View>
                    ))
                  ) : (
                    <View className="items-center justify-center py-4">
                      <Text className="text-white/80">Daily forecast not available</Text>
                    </View>
                  )}
                </View>

                {/* Weather details */}
                <View className="mb-6 mt-4 rounded-xl bg-white/10 p-4">
                  <Text className="mb-2 font-medium text-white">DETAILS</Text>
                  <View className="flex-row flex-wrap">
                    <View className="w-1/2 p-2">
                      <Text className="text-white/70">Feels Like</Text>
                      <Text className="text-xl text-white">
                        {location.details?.feelsLike || location.temperature}°
                      </Text>
                    </View>
                    <View className="w-1/2 p-2">
                      <Text className="text-white/70">Humidity</Text>
                      <Text className="text-xl text-white">
                        {location.details?.humidity || '62'}%
                      </Text>
                    </View>
                    <View className="w-1/2 p-2">
                      <Text className="text-white/70">Visibility</Text>
                      <Text className="text-xl text-white">
                        {location.details?.visibility || '10'} mi
                      </Text>
                    </View>
                    <View className="w-1/2 p-2">
                      <Text className="text-white/70">UV Index</Text>
                      <Text className="text-xl text-white">
                        {location.details?.uvIndex || '6'}{' '}
                        {location.details?.uvIndex && location.details.uvIndex > 5 ? '(High)' : ''}
                      </Text>
                    </View>
                    <View className="w-1/2 p-2">
                      <Text className="text-white/70">Wind</Text>
                      <Text className="text-xl text-white">
                        {location.details?.windSpeed || '5'} mph
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}
