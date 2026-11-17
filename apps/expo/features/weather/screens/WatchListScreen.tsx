import type { WatchedLocation } from '@packrat/schemas/weatherMonitoring';
import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { Button } from '@packrat/ui/src/button';
import { Snackbar, type SnackbarHandle } from '@packrat/ui/src/snackbar';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useTrips } from 'expo-app/features/trips/hooks/useTrips';
import {
  tripSendsWeatherAlerts,
  useSetTripWeatherAlerts,
  useTripAlertsSetting,
} from 'expo-app/features/trips/hooks/useTripWeatherAlerts';
import type { Trip } from 'expo-app/features/trips/types';
import { tripsInWatchWindow } from 'expo-app/features/trips/utils/tripWeatherPlan';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { parseLocalDate } from 'expo-app/lib/utils/dateUtils';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  RefreshControl,
  SectionList,
  View,
} from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWatchList } from '../hooks';
import { useWatchFeedback } from '../hooks/useWatchFeedback';

type Row = { kind: 'trip'; trip: Trip } | { kind: 'location'; location: WatchedLocation };

function tripEndLabel(trip: Trip): string | null {
  const end = parseLocalDate(trip.endDate ?? trip.startDate ?? undefined);
  return end ? end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;
}

function WatchedTripRow({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const setTripWeatherAlerts = useSetTripWeatherAlerts();
  const swipeable = useRef<SwipeableMethods>(null);
  const isOn = tripSendsWeatherAlerts(trip);
  const end = tripEndLabel(trip);
  const subtitle = [trip.location?.name?.split(',')[0], end && t('weather.tripEnds', { date: end })]
    .filter(Boolean)
    .join(' · ');
  const toggle = () => setTripWeatherAlerts(trip, !isOn);

  // Switching alerts off keeps the trip here, marked off; only leaving its
  // window takes it out, so the swipe springs back rather than removing it.
  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={1.5}
      rightThreshold={96}
      overshootRight={false}
      renderRightActions={() => (
        <View
          className="flex-1 items-end justify-center px-6"
          style={{ backgroundColor: colors.primary }}
        >
          <Icon name={isOn ? 'bell-off-outline' : 'bell-outline'} size={24} color="white" />
        </View>
      )}
      onSwipeableOpen={() => {
        toggle();
        swipeable.current?.close();
      }}
    >
      <Pressable
        onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
        android_ripple={{ color: colors.grey5 }}
        className="min-h-[72px] flex-row items-center gap-4 bg-background py-2 pl-4 pr-1"
        testID={testIds.weather.watchedTrip(trip.id)}
      >
        <Icon name="map-marker-outline" size={24} color={colors.grey} />
        <View className="flex-1">
          <Text className="text-base text-foreground">{trip.name}</Text>
          {subtitle ? (
            <Text variant="subhead" className="text-muted-foreground">
              {subtitle}
            </Text>
          ) : null}
          {isOn ? null : (
            <Text variant="subhead" className="text-muted-foreground">
              {t('weather.tripAlertsOff')}
            </Text>
          )}
        </View>
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={
            isOn
              ? t('weather.turnOffTripAlertsA11y', { name: trip.name })
              : t('weather.turnOnTripAlertsA11y', { name: trip.name })
          }
          android_ripple={{ color: colors.grey5, borderless: true, radius: 24 }}
          className="h-12 w-12 items-center justify-center"
        >
          <Icon
            name={isOn ? 'bell-outline' : 'bell-off-outline'}
            size={24}
            color={isOn ? colors.primary : colors.grey}
          />
        </Pressable>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

/**
 * Every place the user is notified about, wherever it was watched from: trips
 * watching their destination first, then saved locations. Remove a location by
 * swiping or with the row's trailing button; add from search.
 */
export default function WatchListScreen() {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
  const snackbar = useRef<SnackbarHandle>(null);
  const alertRef = useRef<AlertMethods>(null);
  // Watching saved places is its own feature; with only trip weather on, the
  // list holds trips alone.
  const {
    enabled: showsLocations,
    watched,
    isLoading: locationsLoading,
    refetch: refetchLocations,
  } = useWatchList();
  const tripAlerts = useTripAlertsSetting();
  const trips = useTrips();
  const { unwatchPlace } = useWatchFeedback(snackbar);

  // Trips enter and leave the window by date, so the clock is reread whenever the list
  // comes back into view or is pulled to refresh.
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(useCallback(() => setNow(new Date()), []));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => subscription.remove();
  }, []);

  const watchedTrips = tripAlerts.enabled === true ? tripsInWatchWindow({ trips, now }) : [];
  const tripAlertsLoading =
    tripAlerts.active && tripAlerts.enabled === undefined && !tripAlerts.isError;
  const isLoading =
    (showsLocations && locationsLoading) || (tripAlertsLoading && watchedTrips.length === 0);

  const sections = [
    ...(watchedTrips.length > 0
      ? [
          {
            key: 'trips',
            title: t('weather.watchListTrips'),
            data: watchedTrips.map((trip): Row => ({ kind: 'trip', trip })),
          },
        ]
      : []),
    ...(showsLocations && watched.length > 0
      ? [
          {
            key: 'locations',
            title: watchedTrips.length > 0 ? t('weather.watchListLocations') : null,
            data: watched.map((location): Row => ({ kind: 'location', location })),
          },
        ]
      : []),
  ];

  const openSearch = () => router.push({ pathname: '/weather/search', params: { mode: 'watch' } });

  const turnOnTripAlerts = async () => {
    try {
      await tripAlerts.setEnabledAsync(true);
    } catch {
      alertRef.current?.alert({
        title: t('weather.turnOnFailedTitle'),
        message: t('weather.turnOnFailedDesc'),
        buttons: [{ text: t('common.ok'), style: 'cancel' }],
      });
    }
  };

  const renderLocation = (item: WatchedLocation) => {
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

  const refresh = () => {
    setNow(new Date());
    if (showsLocations) refetchLocations();
    if (tripAlerts.active) tripAlerts.refetch();
  };

  const emptyState = () => {
    if (tripAlerts.active && tripAlerts.enabled === undefined && tripAlerts.isError) {
      return (
        <EmptyState
          icon="cloud-alert-outline"
          title={t('weather.tripAlertsLoadFailedTitle')}
          body={t('weather.tripAlertsLoadFailedDesc')}
          testID={testIds.weather.watchListTripAlertsError}
        >
          <Button
            className="mt-2"
            variant="tonal"
            onPress={() => tripAlerts.refetch()}
            testID={testIds.weather.watchListRetryBtn}
          >
            <Text>{t('common.retry')}</Text>
          </Button>
        </EmptyState>
      );
    }
    if (tripAlerts.enabled === false) {
      return (
        <EmptyState
          icon="bell-off-outline"
          title={t('weather.tripAlertsOffTitle')}
          body={t('weather.tripAlertsOffDesc')}
          testID={testIds.weather.watchListTripAlertsOff}
        >
          <Button
            className="mt-2"
            icon="bell-outline"
            onPress={turnOnTripAlerts}
            testID={testIds.weather.watchListTurnOnAlertsBtn}
          >
            <Text>{t('weather.turnOnAlerts')}</Text>
          </Button>
        </EmptyState>
      );
    }
    if (showsLocations) {
      return (
        <EmptyState
          icon="bell-off-outline"
          title={t('weather.noWatchedLocations')}
          body={t('weather.noWatchedLocationsDesc')}
        >
          <Button className="mt-2" icon="plus" onPress={openSearch}>
            <Text>{t('weather.addLocation')}</Text>
          </Button>
        </EmptyState>
      );
    }
    return (
      <EmptyState
        icon="bag-suitcase-outline"
        title={t('weather.noWatchedTrips')}
        body={t('weather.noWatchedTripsDesc')}
        testID={testIds.weather.watchListEmpty}
      />
    );
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: t('weather.watchList'),
          headerRight: showsLocations
            ? () => (
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
              )
            : undefined,
        }}
      />
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(row) => (row.kind === 'trip' ? `trip-${row.trip.id}` : row.location.id)}
          renderItem={({ item }) =>
            item.kind === 'trip' ? (
              <WatchedTripRow trip={item.trip} />
            ) : (
              renderLocation(item.location)
            )
          }
          renderSectionHeader={({ section }) =>
            section.title ? (
              <Text
                variant="subhead"
                className="bg-background px-4 pb-2 pt-4 font-medium text-primary"
              >
                {section.title}
              </Text>
            ) : null
          }
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 96 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
          ListEmptyComponent={emptyState()}
        />
      )}
      <Snackbar ref={snackbar} testID={testIds.weather.snackbar} bottomOffset={insets.bottom} />
      <Alert title="" buttons={[]} ref={alertRef} />
    </View>
  );
}

function EmptyState({
  icon,
  title,
  body,
  testID,
  children,
}: {
  icon: string;
  title: string;
  body: string;
  testID?: string;
  children?: React.ReactNode;
}) {
  const { colors } = useColorScheme();
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 pb-24" testID={testID}>
      <Icon name={icon} size={56} color={colors.grey} />
      <Text className="text-center text-xl font-medium">{title}</Text>
      <Text className="text-center text-muted-foreground">{body}</Text>
      {children}
    </View>
  );
}
