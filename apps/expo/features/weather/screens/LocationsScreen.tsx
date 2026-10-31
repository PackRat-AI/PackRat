import { useActionSheet } from '@expo/react-native-action-sheet';
import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import { Button } from '@packrat/ui/src/button';
import { DropdownMenu } from '@packrat/ui/src/dropdown-menu';
import { createDropdownItem } from '@packrat/ui/src/dropdown-menu/utils';
import { Snackbar, type SnackbarHandle } from '@packrat/ui/src/snackbar';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { withAuthWall } from 'expo-app/features/auth/hocs';
import { useTemperatureUnit } from 'expo-app/features/auth/hooks/useTemperatureUnit';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { router, Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocationCard } from '../components/LocationCard';
import { WeatherAuthWall } from '../components/WeatherAuthWall';
import {
  useActiveLocation,
  useLocationRefresh,
  useLocations,
  useSeenAlerts,
  useWatchList,
} from '../hooks';
import type { WeatherLocation } from '../types';

/** The red surface revealed behind a card as it is swiped away. */
function RemoveBackground() {
  const { colors } = useColorScheme();
  return (
    <View
      className="mb-3 flex-1 items-end justify-center rounded-3xl px-6"
      style={{ backgroundColor: colors.destructive }}
    >
      <Icon name="trash-can-outline" size={24} color="white" />
    </View>
  );
}

function LocationsScreen() {
  const { colors, colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const snackbar = useRef<SnackbarHandle>(null);
  const { showActionSheetWithOptions } = useActionSheet();
  const { locationsState, removeLocation, restoreLocation } = useLocations();
  const { setActiveLocation } = useActiveLocation();
  const { isRefreshing, refreshAllLocations } = useLocationRefresh();
  const { isUnseen } = useSeenAlerts();
  const { enabled: monitoringEnabled, watchedFor, refetch: refetchWatchList } = useWatchList();
  const { unit, setTemperatureUnit } = useTemperatureUnit();

  const isLoading = locationsState.state === 'loading';
  const locations = locationsState.state === 'hasData' ? locationsState.data : [];

  useEffect(() => {
    if (!isLoading && locations.length > 0) refreshAllLocations();
  }, [isLoading]);

  const openSearch = () => router.push('/weather/search');

  const handleRefresh = () => {
    refreshAllLocations();
    if (monitoringEnabled) refetchWatchList();
  };

  const handleRemove = async (location: WeatherLocation) => {
    const index = locations.findIndex((l) => l.id === location.id);
    removeLocation(location.id);
    const result = await snackbar.current?.show({
      message: t('weather.locationRemoved', { name: location.name }),
      actionLabel: t('weather.undo'),
    });
    if (result === 'actionPerformed') restoreLocation({ location, index });
  };

  const showCardActions = (location: WeatherLocation) => {
    const options = [
      ...(location.isActive ? [] : [t('weather.setAsActive')]),
      t('weather.remove'),
      t('common.cancel'),
    ];
    const removeIndex = options.indexOf(t('weather.remove'));
    showActionSheetWithOptions(
      {
        title: location.name,
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: removeIndex,
        containerStyle: {
          backgroundColor: colorScheme === 'dark' ? colors.card : 'white',
          paddingBottom: insets.bottom,
        },
        textStyle: { color: colors.foreground },
        titleTextStyle: { color: colors.foreground, fontWeight: '600' },
      },
      (selected) => {
        if (selected === removeIndex) handleRemove(location);
        else if (selected === 0 && !location.isActive) setActiveLocation(location.id);
      },
    );
  };

  const menuItems = [
    ...(monitoringEnabled
      ? [createDropdownItem({ actionKey: 'watch-list', title: t('weather.watchList') })]
      : []),
    createDropdownItem({
      actionKey: 'temperature-unit',
      title: `${t('weather.temperatureUnit')}: ${unit === 'F' ? t('weather.fahrenheit') : t('weather.celsius')}`,
    }),
  ];

  const headerRight = () => (
    <View className="flex-row items-center">
      <Pressable
        onPress={openSearch}
        accessibilityRole="button"
        accessibilityLabel={t('weather.addLocation')}
        android_ripple={{ color: colors.grey5, borderless: true, radius: 24 }}
        className="h-12 w-12 items-center justify-center"
        testID={testIds.weather.addLocationBtn}
      >
        <Icon name="plus" size={24} color={colors.foreground} />
      </Pressable>
      <DropdownMenu
        items={menuItems}
        testID={testIds.weather.moreMenu}
        onItemPress={({ actionKey }) => {
          if (actionKey === 'watch-list') router.push('/weather/watch-list');
          if (actionKey === 'temperature-unit') setTemperatureUnit(unit === 'F' ? 'C' : 'F');
        }}
      >
        <View
          accessibilityRole="button"
          accessibilityLabel={t('weather.moreOptions')}
          className="h-12 w-12 items-center justify-center"
        >
          <Icon name="dots-vertical" size={24} color={colors.foreground} />
        </View>
      </DropdownMenu>
    </View>
  );

  const renderItem = ({ item }: { item: WeatherLocation }) => (
    <ReanimatedSwipeable
      friction={1.5}
      rightThreshold={96}
      overshootRight={false}
      renderRightActions={() => <RemoveBackground />}
      // Only an end-side action exists, so any completed swipe is a dismiss.
      onSwipeableOpen={() => handleRemove(item)}
      containerStyle={{ marginBottom: 12 }}
    >
      <LocationCard
        location={item}
        isWatched={Boolean(watchedFor(item.id))}
        hasNewAlert={isUnseen(item)}
        onPress={() => router.push({ pathname: '/weather/[id]', params: { id: String(item.id) } })}
        onLongPress={() => showCardActions(item)}
      />
    </ReanimatedSwipeable>
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ ...getAppBarOptions(), title: t('weather.weather'), headerRight }} />
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: insets.bottom + 96,
            flexGrow: 1,
          }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          ListHeaderComponent={
            <Pressable
              onPress={openSearch}
              accessibilityRole="search"
              className="mb-4 h-14 flex-row items-center gap-4 rounded-full px-4"
              style={{ backgroundColor: colors.grey5 }}
              android_ripple={{ color: colors.grey5 }}
              testID={testIds.weather.searchInput}
            >
              <Icon name="magnify" size={24} color={colors.grey} />
              <Text className="text-muted-foreground">{t('weather.searchForPlace')}</Text>
            </Pressable>
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center gap-3 px-8 pb-24">
              <Icon name="weather-partly-cloudy" size={56} color={colors.grey} />
              <Text className="text-center text-xl font-medium">
                {t('weather.noSavedLocations')}
              </Text>
              <Text className="text-center text-muted-foreground">
                {t('weather.noSavedLocationsBody')}
              </Text>
              <Button className="mt-2" onPress={openSearch}>
                <Icon name="plus" size={18} color="white" />
                <Text className="font-medium text-primary-foreground">
                  {t('weather.addLocation')}
                </Text>
              </Button>
            </View>
          }
        />
      )}
      <Snackbar ref={snackbar} testID={testIds.weather.snackbar} bottomOffset={insets.bottom} />
    </View>
  );
}

export default withAuthWall({ Component: LocationsScreen, AuthWall: WeatherAuthWall });
