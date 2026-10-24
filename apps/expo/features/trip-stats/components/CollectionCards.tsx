import type { TripGoal } from '@packrat/schemas/tripStats';
import { Text } from '@packrat/ui/src/text';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { formatDay } from '../lib/useStatsFormat';
import { scopeParams } from '../screens/PlacesScreens';
import type { LongTrailProgress } from '../utils/longTrails';
import {
  highestAscent,
  latestParkVisit,
  NATIONAL_PARK_COUNT,
  type ParksAndPeaks,
  peakCount,
  visitedParks,
} from '../utils/parksAndPeaks';
import type { Coordinate } from '../utils/polyline';
import type { TripPlaces } from '../utils/tripPlaces';
import type { TripStatsRecord } from '../utils/tripStats';
import { formatElevation, type TripDistanceUnit } from '../utils/units';
import { LongTrailsCard } from './LongTrailCards';
import { PlacesCard } from './PlacesAndGearCards';
import { CardLink, ProgressBar, StatsCard } from './StatsParts';

export function ParksCard({
  parksAndPeaks,
  onPress,
}: {
  parksAndPeaks: ParksAndPeaks;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const visited = visitedParks(parksAndPeaks).length;
  const latest = latestParkVisit(parksAndPeaks);
  return (
    <StatsCard title={t('tripStats.parks.title')}>
      <CardLink onPress={onPress} testID={testIds.tripStats.parksCard}>
        <Text variant="title2" className="font-semibold">
          {t('tripStats.parks.progress', { count: visited, total: NATIONAL_PARK_COUNT })}
        </Text>
        <ProgressBar progress={visited / NATIONAL_PARK_COUNT} />
        <Text variant="subhead" className="text-muted-foreground">
          {latest
            ? t('tripStats.parks.latest', { park: latest.park.name, date: formatDay(latest.date) })
            : t('tripStats.parks.emptyBody')}
        </Text>
      </CardLink>
    </StatsCard>
  );
}

export function PeaksCard({
  parksAndPeaks,
  unit,
  onPress,
}: {
  parksAndPeaks: ParksAndPeaks;
  unit: TripDistanceUnit;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const count = peakCount(parksAndPeaks);
  const highest = highestAscent(parksAndPeaks);
  return (
    <StatsCard title={t('tripStats.peaks.title')}>
      <CardLink onPress={onPress} testID={testIds.tripStats.peaksCard}>
        {count > 0 ? (
          <>
            <Text variant="title2" className="font-semibold">
              {t('tripStats.countPeaks', { count })}
            </Text>
            {highest ? (
              <Text variant="subhead" className="text-muted-foreground">
                {t('tripStats.peaks.highest', {
                  name: `${highest.summit.name} · ${formatElevation({ metres: highest.summit.elevationMeters ?? 0, unit })}`,
                })}
              </Text>
            ) : null}
          </>
        ) : (
          <Text variant="subhead" className="text-muted-foreground">
            {t('tripStats.peaks.emptyBody')}
          </Text>
        )}
      </CardLink>
    </StatsCard>
  );
}

const MAP_HEIGHT = 220;

/** Fits every route and trip location, with a little room at the edges. */
function regionFor(points: readonly Coordinate[]) {
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.2),
    longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.2),
  };
}

/** Routes as lines and trip locations as pins, on a static map that scrolls with the page. */
export function TripsMapCard({ record }: { record: TripStatsRecord }) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const pins = useMemo(
    () =>
      record.finished.flatMap((trip) =>
        trip.trip.location
          ? [{ id: trip.trip.id, name: trip.trip.name, ...trip.trip.location }]
          : [],
      ),
    [record.finished],
  );
  const points = useMemo(
    () => [...pins, ...record.routes.flatMap((route) => route.coordinates)],
    [pins, record.routes],
  );
  if (points.length === 0) return null;
  return (
    <StatsCard title={t('tripStats.map.title')} hostsNativeView>
      <View className="overflow-hidden rounded-xl" style={{ height: MAP_HEIGHT }}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={regionFor(points)}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
        >
          {record.routes.map((route) => (
            <Polyline
              key={route.id}
              coordinates={route.coordinates}
              strokeColor={colors.primary}
              strokeWidth={3}
            />
          ))}
          {pins.map((pin) => (
            <Marker
              key={pin.id}
              coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
              title={pin.name}
            />
          ))}
        </MapView>
      </View>
    </StatsCard>
  );
}

/** The map, countries and states, then the lifetime collections, which open their own lists. */
export function CollectionCards({
  record,
  places,
  parksAndPeaks,
  longTrails,
  followGoals,
  unit,
  showLifetime,
}: {
  record: TripStatsRecord;
  places: TripPlaces;
  parksAndPeaks: ParksAndPeaks;
  longTrails: readonly LongTrailProgress[];
  followGoals: ReadonlyMap<string, TripGoal>;
  unit: TripDistanceUnit;
  /** Parks and peaks are lifetime collections, shown only while the record isn't filtered. */
  showLifetime: boolean;
}) {
  const router = useRouter();
  return (
    <>
      <TripsMapCard record={record} />
      <PlacesCard
        places={places}
        scope={record.scope}
        onPress={() =>
          router.push({ pathname: '/trip-stats/places', params: scopeParams(record.scope) })
        }
      />
      {showLifetime ? (
        <>
          <ParksCard
            parksAndPeaks={parksAndPeaks}
            onPress={() => router.push('/trip-stats/parks')}
          />
          <PeaksCard
            parksAndPeaks={parksAndPeaks}
            unit={unit}
            onPress={() => router.push('/trip-stats/peaks')}
          />
          <LongTrailsCard
            progress={longTrails}
            followGoals={followGoals}
            unit={unit}
            onOpen={(code) =>
              router.push({ pathname: '/trip-stats/trail/[code]', params: { code } })
            }
            onFollow={() => {
              const next = longTrails.find((item) => !followGoals.has(item.trail.code));
              router.push({
                pathname: '/trip-stats/goal',
                params: { kind: 'longTrail', ...(next ? { trailCode: next.trail.code } : {}) },
              });
            }}
          />
        </>
      ) : null}
    </>
  );
}
