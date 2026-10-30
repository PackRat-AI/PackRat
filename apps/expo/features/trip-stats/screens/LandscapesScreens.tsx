import type { TripLandscape } from '@packrat/schemas/trips';
import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import { createDropdownItem, DropdownMenu } from '@packrat/ui/src/dropdown-menu';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useTrips } from 'expo-app/features/trips/hooks';
import { useUpdateTrip } from 'expo-app/features/trips/hooks/useUpdateTrip';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LANDSCAPE_ICONS } from '../components/LandscapesCard';
import { StatsRow } from '../components/StatsParts';
import { useTripLandscapes, useTripStatsRecord } from '../hooks/useTripStats';
import { formatDay } from '../lib/useStatsFormat';
import { TRIP_LANDSCAPES } from '../utils/landscapes';
import { useScopeFromParams } from './PlacesScreens';

const AUTOMATIC = 'automatic';

/** The trips in one landscape, each with a menu to move it to another. */
export function LandscapeTripsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const { landscape: param } = useLocalSearchParams<{ landscape: string }>();
  const landscape = TRIP_LANDSCAPES.find((item) => item === param) ?? null;
  const scope = useScopeFromParams();
  const record = useTripStatsRecord(scope);
  const buckets = useTripLandscapes(record);
  const allTrips = useTrips();
  const updateTrip = useUpdateTrip();
  if (!landscape) return null;
  const name = t(`tripStats.landscapes.names.${landscape}`);
  const trips = buckets.find((bucket) => bucket.landscape === landscape)?.trips ?? [];

  const move = ({ tripId, to }: { tripId: string; to: TripLandscape | null }) => {
    const trip = allTrips.find((item) => item.id === tripId);
    if (!trip) return;
    updateTrip({ ...trip, log: { ...(trip.log ?? { activities: [] }), landscape: to } });
  };

  return (
    <SafeAreaView className="flex-1" edges={['bottom']}>
      <Stack.Screen options={{ ...getAppBarOptions(), title: name }} />
      {trips.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Icon name={LANDSCAPE_ICONS[landscape]} size={48} color={colors.grey} />
          <Text variant="title3" className="text-center font-medium">
            {t('tripStats.landscapes.emptyTitle', { landscape: name })}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerClassName="pb-8">
          {trips.map(({ trip, start }) => {
            const chosen = trip.log?.landscape ?? null;
            return (
              <StatsRow
                key={trip.id}
                icon="map-marker-path"
                title={trip.name}
                subtitle={formatDay(start)}
                onPress={() => router.push(`/trip/${trip.id}`)}
                trailing={
                  <DropdownMenu
                    items={[
                      createDropdownItem({
                        actionKey: AUTOMATIC,
                        title: `${chosen == null ? '✓ ' : ''}${t('tripStats.landscapes.automatic')}`,
                      }),
                      ...TRIP_LANDSCAPES.map((option) =>
                        createDropdownItem({
                          actionKey: option,
                          title: `${chosen === option ? '✓ ' : ''}${t(`tripStats.landscapes.names.${option}`)}`,
                        }),
                      ),
                    ]}
                    onItemPress={(item) =>
                      move({
                        tripId: trip.id,
                        to: TRIP_LANDSCAPES.find((option) => option === item.actionKey) ?? null,
                      })
                    }
                  >
                    {/* A plain View: the menu wraps its trigger in its own Pressable. */}
                    <View
                      className="p-2"
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={t('tripStats.landscapes.move')}
                      testID={testIds.tripStats.landscapeTripMenu(trip.id)}
                    >
                      <Icon name="dots-vertical" size={24} color={colors.grey} />
                    </View>
                  </DropdownMenu>
                }
              />
            );
          })}
          <Text variant="footnote" className="px-4 pt-2 text-muted-foreground">
            {t('tripStats.landscapes.attribution')}
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
