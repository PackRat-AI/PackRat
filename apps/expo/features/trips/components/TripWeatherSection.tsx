import { use$ } from '@legendapp/state/react';
import { WeatherAPIForecastResponseSchema } from '@packrat/schemas/weather';
import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { Toggle } from '@packrat/ui/src/toggle';
import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import { format, isToday, isTomorrow } from 'date-fns';
import { Icon } from 'expo-app/components/Icon';
import { useTemperatureUnit } from 'expo-app/features/auth/hooks/useTemperatureUnit';
import { AlertCard } from 'expo-app/features/weather/components/forecast/ForecastAlertSection';
import { WeatherAttribution } from 'expo-app/features/weather/components/WeatherAttribution';
import { getWeatherIconName } from 'expo-app/features/weather/lib/weatherIcons';
import { alertId } from 'expo-app/features/weather/utils/alertState';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { parseLocalDate } from 'expo-app/lib/utils/dateUtils';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { tripSendsWeatherAlerts, useSetTripWeatherAlerts } from '../hooks/useTripWeatherAlerts';
import { tripConditionsStore } from '../store/tripReminders';
import { markTripAlertsSeen } from '../store/tripWeatherAlertReads';
import type { Trip } from '../types';
import { destinationAlerts, FORECAST_HORIZON_DAYS } from '../utils/tripConditions';
import { needsTripForecast, tripWeatherPlan } from '../utils/tripWeatherPlan';

async function fetchDestinationForecast({ tripId, q }: { tripId: string; q: string }) {
  Sentry.addBreadcrumb({
    category: 'tripWeather',
    message: 'Trip forecast requested',
    level: 'info',
    data: { tripId },
  });
  const { data, error } = await apiClient.weather['by-name'].get({ query: { q } });
  if (error || !data) {
    const failure = new Error(String(error?.value ?? 'Empty forecast response'));
    Sentry.captureException(failure, {
      tags: { feature: 'tripWeather', action: 'fetchForecast' },
      extra: { tripId, httpStatus: error?.status, apiError: error?.value },
    });
    throw failure;
  }
  return WeatherAPIForecastResponseSchema.parse(data);
}

/**
 * The destination's forecast for the trip's own days, on the trip screen.
 * Product behaviour: docs/features/trip-weather.md ("The forecast on a trip").
 */
export function TripWeatherSection({ trip }: { trip: Trip }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const { displayTemperature } = useTemperatureUnit();
  const setTripWeatherAlerts = useSetTripWeatherAlerts();
  const storedAlerts = use$(() => tripConditionsStore[trip.id]?.alerts.get());

  const now = new Date();
  const q = trip.location ? `${trip.location.latitude},${trip.location.longitude}` : '';
  const query = useQuery({
    queryKey: ['tripWeather', 'forecast', q],
    queryFn: () => fetchDestinationForecast({ tripId: trip.id, q }),
    enabled: needsTripForecast({ trip, now }),
    staleTime: 1000 * 60 * 30,
    retry: false,
  });
  const forecast = query.data;

  const alerts = useMemo(() => destinationAlerts(forecast?.alerts?.alert ?? []), [forecast]);

  // The trip list's marker clears once the alerts have been on screen here,
  // including any the list learned about from an earlier fetch.
  useEffect(() => {
    if (!forecast) return;
    markTripAlertsSeen({
      tripId: trip.id,
      alertIds: [...alerts.map(alertId), ...(storedAlerts ?? []).map((alert) => alert.id)],
    });
  }, [forecast, alerts, storedAlerts, trip.id]);

  const plan = tripWeatherPlan({
    trip,
    forecastDates: forecast?.forecast.forecastday.map((day) => day.date) ?? [],
    now,
  });
  if (plan.kind === 'hidden') return null;

  const card = 'rounded-xl border border-border bg-card';

  const dayTitle = (date: string) => {
    const parsed = parseLocalDate(date);
    if (!parsed) return date;
    if (isToday(parsed)) return t('weather.today');
    if (isTomorrow(parsed)) return t('trips.weather.tomorrow');
    // A trip can span the same weekday twice.
    return format(parsed, 'EEE d');
  };

  const renderContent = () => {
    if (plan.kind === 'beyondRange') {
      return (
        <View className={`${card} p-4`} testID={testIds.trips.weatherBeyondRange}>
          <Text className="text-muted-foreground" wrap>
            {t('trips.weather.beyondRange', { days: FORECAST_HORIZON_DAYS })}
          </Text>
        </View>
      );
    }
    if (!forecast) {
      if (query.isError) {
        return (
          <View className={`${card} items-start gap-3 p-4`}>
            <Text className="text-muted-foreground">{t('trips.weather.loadFailed')}</Text>
            <Button
              variant="tonal"
              size="sm"
              onPress={() => query.refetch()}
              testID={testIds.trips.weatherRetry}
            >
              <Text>{t('trips.weather.tryAgain')}</Text>
            </Button>
          </View>
        );
      }
      return (
        <View className={`${card} min-h-[80px] items-center justify-center`}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }

    const days = forecast.forecast.forecastday.filter((day) => plan.dates.includes(day.date));
    return (
      <View className="gap-3">
        {alerts.map((alert) => (
          <AlertCard key={alertId(alert)} alert={alert} onSky={false} />
        ))}
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/weather/[id]',
              params: { id: String(forecast.location.id) },
            })
          }
          android_ripple={{ color: colors.grey5 }}
          className={`${card} overflow-hidden`}
          accessibilityRole="button"
          testID={testIds.trips.weatherOpenForecast}
        >
          {plan.underWay ? (
            <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
              <Icon
                name={getWeatherIconName({
                  code: forecast.current.condition.code,
                  isDay: forecast.current.is_day,
                })}
                size={28}
                color={colors.primary}
              />
              <View className="flex-1">
                <Text variant="footnote" className="text-muted-foreground">
                  {t('trips.weather.now')}
                </Text>
                <Text>{forecast.current.condition.text}</Text>
              </View>
              <Text className="text-2xl font-semibold">
                {displayTemperature(forecast.current.temp_c)}
              </Text>
            </View>
          ) : null}
          {days.map((day) => (
            <View
              key={day.date}
              className="min-h-[48px] flex-row items-center gap-3 border-b border-border px-4"
            >
              <Text className="w-24">{dayTitle(day.date)}</Text>
              <Icon
                name={getWeatherIconName({ code: day.day.condition.code, isDay: 1 })}
                size={22}
                color={colors.grey}
              />
              <Text variant="footnote" className="flex-1 text-muted-foreground">
                {(day.day.daily_chance_of_rain ?? 0) > 0 ? `${day.day.daily_chance_of_rain}%` : ''}
              </Text>
              <Text className="w-12 text-right text-muted-foreground">
                {displayTemperature(day.day.mintemp_c)}
              </Text>
              <Text className="w-12 text-right">{displayTemperature(day.day.maxtemp_c)}</Text>
            </View>
          ))}
          {plan.partial ? (
            <View
              className="border-b border-border px-4 py-3"
              testID={testIds.trips.weatherPartial}
            >
              <Text variant="footnote" className="text-muted-foreground" wrap>
                {t('trips.weather.partial')}
              </Text>
            </View>
          ) : null}
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="font-semibold text-primary">{t('trips.weather.fullForecast')}</Text>
            <Icon name="chevron-right" size={20} color={colors.primary} />
          </View>
          {forecast.attribution ? (
            <View className="px-3 pb-3">
              <WeatherAttribution attribution={forecast.attribution} onSky={false} />
            </View>
          ) : null}
        </Pressable>
      </View>
    );
  };

  return (
    <View className="mb-6 gap-3" testID={testIds.trips.weatherSection}>
      <Text className="text-lg font-semibold text-foreground">{t('trips.weather.title')}</Text>
      {renderContent()}
      <View className={`${card} flex-row items-center justify-between gap-4 p-4`}>
        <View className="flex-1">
          <Text className="font-medium">{t('trips.weather.alertsToggle')}</Text>
          <Text variant="footnote" className="mt-0.5 text-muted-foreground" wrap>
            {t('trips.weather.alertsToggleDesc')}
          </Text>
        </View>
        <Toggle
          value={tripSendsWeatherAlerts(trip)}
          onValueChange={(on) => setTripWeatherAlerts(trip, on)}
          testID={testIds.trips.weatherAlertsToggle}
        />
      </View>
    </View>
  );
}
