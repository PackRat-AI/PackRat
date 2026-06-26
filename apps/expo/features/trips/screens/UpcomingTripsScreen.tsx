import { Text } from '@packrat/ui/nativewindui';
import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { parseLocalDate } from 'expo-app/lib/utils/dateUtils';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTrips } from '../hooks';
import type { Trip } from '../types';
import { countdownLabel, formatDateRange } from '../utils/tripDateUtils';

function TripRow({ trip, onPress }: { trip: Trip; onPress: (trip: Trip) => void }) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const countdown = trip.startDate ? countdownLabel({ dateString: trip.startDate, t }) : '';
  const dateRange = formatDateRange({ start: trip.startDate, end: trip.endDate });
  const subtextParts = [countdown, dateRange].filter(Boolean);
  if (trip.location?.name) subtextParts.push(trip.location.name);

  return (
    <Pressable onPress={() => onPress(trip)}>
      <View className="mx-4 mb-3 flex-row items-center gap-3 rounded-xl bg-card px-4 py-4">
        <View className="flex-1">
          <Text variant="callout" className="font-semibold text-foreground" numberOfLines={1}>
            {trip.name}
          </Text>
          <Text variant="footnote" className="mt-0.5 text-muted-foreground" numberOfLines={1}>
            {subtextParts.join(' · ')}
          </Text>
        </View>
        <Icon name="chevron-right" size={16} color={colors.grey} />
      </View>
    </Pressable>
  );
}

function EmptyState({ onPlanTrip }: { onPlanTrip: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center gap-6 px-8">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950">
        <Icon name="map-outline" size={36} color="#3b82f6" />
      </View>
      <View className="items-center gap-2">
        <Text variant="title3" className="font-semibold text-foreground">
          {t('trips.noUpcomingTrips')}
        </Text>
        <Text variant="subhead" className="text-center text-muted-foreground">
          {t('trips.noUpcomingTripsDesc')}
        </Text>
      </View>
      <Pressable onPress={onPlanTrip} className="rounded-xl bg-primary px-6 py-3">
        <Text variant="callout" className="font-semibold text-primary-foreground">
          {t('trips.planATrip')}
        </Text>
      </Pressable>
    </View>
  );
}

export function UpcomingTripsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const trips = useTrips();

  const upcomingTrips = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return trips
      .filter((trip) => {
        if (!trip.startDate) return false;
        const parsed = parseLocalDate(trip.startDate);
        return parsed != null && parsed >= today;
      })
      .sort((a, b) => {
        const aDate = parseLocalDate(a.startDate ?? '')?.getTime() ?? 0;
        const bDate = parseLocalDate(b.startDate ?? '')?.getTime() ?? 0;
        return aDate - bDate;
      });
  }, [trips]);

  const handleTripPress = useCallback(
    (trip: Trip) => {
      router.push({ pathname: '/trip/[id]', params: { id: trip.id } });
    },
    [router],
  );

  const handlePlanTrip = useCallback(() => {
    router.push('/trip/new');
  }, [router]);

  return (
    <SafeAreaView className="flex-1" edges={['bottom']}>
      <Stack.Screen
        options={{
          ...getAppBarOptions(),
          title: t('trips.upcomingTrips'),
        }}
      />

      {upcomingTrips.length === 0 ? (
        <EmptyState onPlanTrip={handlePlanTrip} />
      ) : (
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="pt-4 pb-8"
        >
          <Text variant="subhead" className="mb-3 px-4 text-muted-foreground">
            {t('trips.plannedAdventures')}
          </Text>
          {upcomingTrips.map((trip) => (
            <TripRow key={trip.id} trip={trip} onPress={handleTripPress} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
