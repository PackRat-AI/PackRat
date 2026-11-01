import type { WatchedLocation } from '@packrat/schemas/weatherMonitoring';
import { Button } from '@packrat/ui/src/button';
import { Snackbar, type SnackbarHandle } from '@packrat/ui/src/snackbar';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { router, Stack } from 'expo-router';
import { useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWatchList } from '../hooks';
import { useWatchFeedback } from '../hooks/useWatchFeedback';

/**
 * Every place the user is notified about, wherever it was watched from.
 * Remove by swiping or with the row's trailing button; add from search.
 */
export default function WatchListScreen() {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
  const snackbar = useRef<SnackbarHandle>(null);
  const { watched, isLoading, refetch } = useWatchList();
  const { unwatchPlace } = useWatchFeedback(snackbar);

  const openSearch = () => router.push({ pathname: '/weather/search', params: { mode: 'watch' } });

  const renderItem = ({ item }: { item: WatchedLocation }) => {
    const subtitle = [item.region, item.country].filter(Boolean).join(', ');
    return (
      <ReanimatedSwipeable
        friction={1.5}
        rightThreshold={96}
        overshootRight={false}
        renderRightActions={() => (
          <View
            className="flex-1 items-end justify-center px-6"
            style={{ backgroundColor: colors.destructive }}
          >
            <Icon name="bell-off-outline" size={24} color="white" />
          </View>
        )}
        onSwipeableOpen={() => unwatchPlace(item)}
      >
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/weather/[id]',
              params: { id: String(item.weatherLocationId) },
            })
          }
          android_ripple={{ color: colors.grey5 }}
          className="min-h-[72px] flex-row items-center gap-4 bg-background py-2 pl-4 pr-1"
          testID={testIds.weather.watchedLocation(item.weatherLocationId)}
        >
          <Icon name="bell-outline" size={24} color={colors.grey} />
          <View className="flex-1">
            <Text className="text-base text-foreground">{item.locationName}</Text>
            {subtitle ? (
              <Text variant="subhead" className="text-muted-foreground">
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => unwatchPlace(item)}
            accessibilityRole="button"
            accessibilityLabel={t('weather.stopWatchingNamedA11y', { name: item.locationName })}
            android_ripple={{ color: colors.grey5, borderless: true, radius: 24 }}
            className="h-12 w-12 items-center justify-center"
            testID={testIds.weather.removeWatched(item.weatherLocationId)}
          >
            <Icon name="close" size={24} color={colors.grey} />
          </Pressable>
        </Pressable>
      </ReanimatedSwipeable>
    );
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: t('weather.watchList'),
          headerRight: () => (
            <Pressable
              onPress={openSearch}
              accessibilityRole="button"
              accessibilityLabel={t('weather.addLocation')}
              android_ripple={{ color: colors.grey5, borderless: true, radius: 24 }}
              className="h-12 w-12 items-center justify-center"
              testID={testIds.weather.watchListAddBtn}
            >
              <Icon name="plus" size={24} color={colors.foreground} />
            </Pressable>
          ),
        }}
      />
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={watched}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 96 }}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => {
                refetch();
              }}
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center gap-3 px-8 pb-24">
              <Icon name="bell-off-outline" size={56} color={colors.grey} />
              <Text className="text-center text-xl font-medium">
                {t('weather.noWatchedLocations')}
              </Text>
              <Text className="text-center text-muted-foreground">
                {t('weather.noWatchedLocationsDesc')}
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
