import { use$ } from '@legendapp/state/react';
import { Button } from '@packrat/ui/src/button';
import { Card } from '@packrat/ui/src/card';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import { OfflineMapRow } from 'expo-app/features/offline-maps';
import { PlannedRouteSection, TripSafetySection } from 'expo-app/features/safety-check-in';
import { TripTrailConditionsSection } from 'expo-app/features/trail-conditions/components/TripTrailConditionsSection';
import {
  isTripFinished,
  TripLogSection,
} from 'expo-app/features/trip-stats/components/TripLogSection';
import {
  TripGuidanceCard,
  TripTrackingSection,
  TripVoiceBar,
  useShowsGuidance,
  useShowsTracking,
  useShowsVoiceBar,
} from 'expo-app/features/voice-commands';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { obs } from 'expo-app/lib/store';
import { testIds } from 'expo-app/lib/testIds';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDetailedPacks } from '../../packs/hooks/useDetailedPacks';
import { packingModeStore } from '../../packs/store/packingMode';
import { TripChecklistSection } from '../components/TripChecklistSection';
import { TripMapCard } from '../components/TripMapCard';
import { TripReadinessCard } from '../components/TripReadinessCard';
import { TripRemindersRow } from '../components/TripRemindersRow';
import { TripWeatherSection } from '../components/TripWeatherSection';
import { useTripDetailsFromStore } from '../hooks/useTripDetailsFromStore';
import type { Trip } from '../types';
import { isDepartureNear, packedIdsFrom, packState } from '../utils/tripReminderPlanner';

export function TripDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { colors } = useColorScheme();
  const { t } = useTranslation();

  const enableTripReminders = useFeatureFlag('enableTripReminders');
  const enableSafetyCheckIn = useFeatureFlag('enableSafetyCheckIn');
  const enableOfflineMaps = useFeatureFlag('enableOfflineMaps');
  const enableTripWeather = useFeatureFlag('enableTripWeather');

  // safe-cast: trip may be undefined before the store is hydrated; the guard at line ~38 handles
  // the undefined case and returns early, ensuring trip is non-null at render time below.
  const trip = useTripDetailsFromStore(id as string) as Trip;
  const showsVoiceBar = useShowsVoiceBar(trip);
  const showsTracking = useShowsTracking(trip);
  const showsGuidance = useShowsGuidance(trip);
  const packs = useDetailedPacks();
  const packedRecord = use$(() =>
    trip?.packId ? obs({ store: packingModeStore, id: trip.packId }).get() : null,
  );

  if (!trip) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const pack = packs.find((p) => p.id === trip.packId);
  const { progress: packing } = packState({
    items: pack ? pack.items : null,
    packedItemIds: packedIdsFrom(packedRecord),
  });

  const tripEnd = trip.endDate ?? trip.startDate;
  const tripEndsAt = tripEnd ? new Date(tripEnd).getTime() : undefined;
  const tripIsFinished = isTripFinished(trip);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toISOString().split('T')[0];
  };

  const handleWeatherPress = () => {
    if (!trip.location) return;

    const { latitude, longitude, name } = trip.location;
    const locationName = name || trip.name;

    router.push(
      `/weather/geo?lat=${latitude}&lon=${longitude}&locationName=${encodeURIComponent(locationName)}`,
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="p-4">
          {/* Trip name */}
          <Text className="mb-3 text-3xl font-bold text-foreground">{trip.name}</Text>

          {enableSafetyCheckIn && <TripSafetySection trip={trip} />}

          {showsGuidance && <TripGuidanceCard trip={trip} />}

          {showsTracking && <TripTrackingSection trip={trip} />}

          {enableTripReminders && isDepartureNear({ trip, now: new Date() }) && (
            <TripReadinessCard trip={trip} />
          )}

          {/* Dates */}
          <View className="mb-6" testID={testIds.trips.datesSection}>
            <Text className="text-lg font-semibold text-foreground mb-2">{t('trips.dates')}</Text>
            <View className="rounded-xl bg-card border border-border">
              <View className="p-3 flex-row justify-between">
                <View>
                  <Text className="text-sm text-muted-foreground">{t('trips.startDate')}</Text>
                  <Text className="text-base font-semibold text-foreground">
                    {formatDate(trip.startDate)}
                  </Text>
                </View>
                <View>
                  <Text className="text-sm text-muted-foreground">{t('trips.endDate')}</Text>
                  <Text className="text-base font-semibold text-foreground">
                    {formatDate(trip.endDate)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Details */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-2">{t('trips.details')}</Text>
            {trip.description ? (
              <Text className="text-sm text-muted-foreground" wrap>
                {trip.description}
              </Text>
            ) : (
              <Text className="text-sm text-muted-foreground italic">
                {t('trips.noDetailsAvailable')}
              </Text>
            )}
          </View>

          {/* Location */}
          {trip.location && (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-foreground mb-2">
                {t('trips.location')}
              </Text>

              <TripMapCard
                location={trip.location}
                outdoors={enableOfflineMaps}
                onExpand={() => router.push(`/trip/${trip.id}/map`)}
                onWeather={handleWeatherPress}
                footer={
                  enableOfflineMaps && !tripIsFinished ? (
                    <OfflineMapRow
                      tripId={trip.id}
                      idPrefix="trip"
                      picker={{
                        pathname: '/offline-maps/pick',
                        params: {
                          name: trip.name,
                          tripId: trip.id,
                          lat: String(trip.location.latitude),
                          lon: String(trip.location.longitude),
                          ...(tripEndsAt !== undefined ? { tripEndsAt: String(tripEndsAt) } : {}),
                        },
                      }}
                    />
                  ) : undefined
                }
              />
            </View>
          )}

          {enableTripWeather && <TripWeatherSection trip={trip} />}

          {/* Pack */}
          {pack && (
            <View className="mb-6">
              <Text className="text-lg font-semibold mb-2">{t('trips.pack')}</Text>

              <Card>
                <View className="p-3">
                  <Text>{pack.name}</Text>
                  {enableTripReminders && packing.kind === 'done' ? (
                    <Text textColor={colors.green} testID={testIds.trips.packAllPacked}>
                      {t('trips.reminders.allPacked')}
                    </Text>
                  ) : enableTripReminders && packing.kind === 'partial' && packing.packed > 0 ? (
                    <Text>
                      {t('trips.reminders.packedCount', {
                        packed: packing.packed,
                        total: packing.total,
                      })}
                    </Text>
                  ) : (
                    <Text>{t('trips.items', { count: pack.items.length })}</Text>
                  )}
                </View>

                <View className="flex-row gap-2 p-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => router.push(`/pack/${pack.id}`)}
                  >
                    <Text>{t('trips.viewPack')}</Text>
                  </Button>
                  {enableTripReminders && pack.items.length > 0 && (
                    <Button
                      variant="tonal"
                      size="sm"
                      onPress={() => router.push(`/pack/${pack.id}?packing=1`)}
                      testID={testIds.trips.startPackingBtn}
                    >
                      <Text>
                        {packing.kind === 'done'
                          ? t('trips.reminders.reviewPacking')
                          : packing.kind === 'partial' && packing.packed > 0
                            ? t('trips.reminders.continuePacking')
                            : t('trips.reminders.startPacking')}
                      </Text>
                    </Button>
                  )}
                </View>
              </Card>
            </View>
          )}

          {enableSafetyCheckIn && <PlannedRouteSection trip={trip} />}

          {enableTripReminders && <TripChecklistSection trip={trip} />}

          {enableTripReminders && <TripRemindersRow trip={trip} />}

          <TripLogSection trip={trip} />

          <TripTrailConditionsSection trip={trip} />
        </View>
      </ScrollView>
      {showsVoiceBar && <TripVoiceBar trip={trip} />}
    </SafeAreaView>
  );
}
