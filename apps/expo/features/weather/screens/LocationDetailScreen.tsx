import { Snackbar, type SnackbarHandle } from '@packrat/ui/src/snackbar';
import { Text } from '@packrat/ui/src/text';
import * as Sentry from '@sentry/react-native';
import { Icon } from 'expo-app/components/Icon';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ForecastAlertSection } from '../components/forecast/ForecastAlertSection';
import {
  ConditionTiles,
  DailyForecastList,
  ForecastHero,
  HourlyForecastStrip,
} from '../components/forecast/ForecastSections';
import { WeatherAttribution } from '../components/WeatherAttribution';
import { useLocations, useSeenAlerts, useWatchList } from '../hooks';
import { useWatchFeedback } from '../hooks/useWatchFeedback';
import {
  formatWeatherData,
  getWeatherBackgroundColors,
  getWeatherData,
} from '../lib/weatherService';
import type { WeatherLocation } from '../types';
import { alertId } from '../utils/alertState';

/** M3 standard icon button: 48dp touch target, 24dp icon, unbounded ripple. */
function HeaderIconButton({
  icon,
  label,
  onPress,
  busy,
  testID,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  busy?: boolean;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: Boolean(busy) }}
      android_ripple={{ color: 'rgba(255,255,255,0.24)', borderless: true, radius: 24 }}
      hitSlop={4}
      className="h-12 w-12 items-center justify-center"
      testID={testID}
    >
      {busy ? <ActivityIndicator color="white" /> : <Icon name={icon} size={24} color="white" />}
    </Pressable>
  );
}

/**
 * One location's forecast — saved or not. Opened from the list, from search,
 * and from a tapped alert push, so it fetches by id and never depends on the
 * location already being saved on this device.
 */
export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const locationId = Number.parseInt(String(id), 10);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const snackbar = useRef<SnackbarHandle>(null);
  const { locationsState, addLocation, updateLocation } = useLocations();
  const { markSeen } = useSeenAlerts();
  const { enabled: monitoringEnabled, watchedFor } = useWatchList();
  const { watchPlace, unwatchPlace, isUpdating } = useWatchFeedback(snackbar);

  const saved =
    locationsState.state === 'hasData'
      ? locationsState.data.find((l) => l.id === locationId)
      : undefined;
  const [fetched, setFetched] = useState<WeatherLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const location = fetched ?? saved ?? null;
  const watched = watchedFor(locationId);

  const load = useCallback(async () => {
    setIsLoading(true);
    setFailed(false);
    try {
      const next = formatWeatherData(await getWeatherData(locationId));
      setFetched(next);
      if (saved) updateLocation({ locationId, updates: next });
    } catch (error) {
      // getWeatherData has already reported API errors; this catches parsing.
      Sentry.captureException(error, {
        tags: { feature: 'weather', action: 'loadForecast' },
        extra: { locationId },
      });
      setFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [locationId, saved, updateLocation]);

  // Fetch once per location; `load` changes identity whenever the saved list does.
  useEffect(() => {
    load();
  }, [locationId]);

  // Opening the forecast is reading its alerts: clear the "new alert" marker,
  // and again if a refresh brings a different set.
  const alertKey = (location?.alertList ?? []).map(alertId).join('\n');
  useEffect(() => {
    if (location) markSeen(locationId, location.alertList ?? []);
  }, [alertKey, locationId, markSeen]);

  const handleSave = () => {
    if (!location) return;
    addLocation(location);
    snackbar.current?.show({ message: t('weather.addedToLocations', { name: location.name }) });
  };

  const handleToggleWatch = () => {
    if (!location) return;
    if (watched) unwatchPlace(watched);
    else watchPlace(location);
  };

  const headerRight = () => {
    if (!location) return null;
    if (!saved) {
      return (
        <HeaderIconButton
          icon="plus"
          label={t('weather.addNamedLocationA11y', { name: location.name })}
          onPress={handleSave}
          testID={testIds.weather.saveLocationBtn}
        />
      );
    }
    if (!monitoringEnabled) return null;
    return (
      <HeaderIconButton
        icon={watched ? 'bell' : 'bell-outline'}
        label={watched ? t('weather.stopWatchingA11y') : t('weather.watchLocationA11y')}
        onPress={handleToggleWatch}
        busy={isUpdating}
        testID={testIds.weather.watchToggle}
      />
    );
  };

  const gradient = location?.details
    ? getWeatherBackgroundColors({
        code: location.details.weatherCode,
        isNight: location.details.isDay === 0,
      })
    : getWeatherBackgroundColors({ code: 1000, isNight: false });

  return (
    <View className="flex-1">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          headerTintColor: 'white',
          title: '',
          headerRight,
        }}
      />
      <StatusBar style="light" />
      <LinearGradient colors={gradient} style={{ flex: 1 }}>
        {!location ? (
          <View className="flex-1 items-center justify-center gap-4 px-8">
            {isLoading ? (
              <ActivityIndicator size="large" color="white" />
            ) : failed ? (
              <>
                <Text className="text-center text-white">{t('weather.failedToLoadWeather')}</Text>
                <Pressable
                  onPress={load}
                  className="rounded-full bg-white/20 px-6 py-2.5"
                  android_ripple={{ color: 'rgba(255,255,255,0.24)' }}
                >
                  <Text className="font-medium text-white">{t('weather.tryAgain')}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{
              paddingTop: insets.top + 56,
              paddingBottom: insets.bottom + 96,
              paddingHorizontal: 16,
              gap: 14,
            }}
            refreshControl={
              <RefreshControl
                refreshing={isLoading && fetched !== null}
                onRefresh={load}
                progressViewOffset={insets.top + 56}
              />
            }
          >
            <ForecastHero location={location} />
            {(location.alertList?.length ?? 0) > 0 ? (
              <ForecastAlertSection
                alerts={location.alertList ?? []}
                monitoringEnabled={monitoringEnabled}
                isWatched={Boolean(watched)}
                isUpdatingWatch={isUpdating}
                onWatch={handleToggleWatch}
              />
            ) : null}
            <HourlyForecastStrip location={location} />
            <DailyForecastList location={location} />
            {location.attribution ? (
              <WeatherAttribution attribution={location.attribution} />
            ) : null}
            <ConditionTiles location={location} />
          </ScrollView>
        )}
      </LinearGradient>
      <Snackbar ref={snackbar} testID={testIds.weather.snackbar} bottomOffset={insets.bottom} />
    </View>
  );
}
