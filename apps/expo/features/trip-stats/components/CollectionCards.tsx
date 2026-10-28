import type { TripGoal } from '@packrat/schemas/tripStats';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useRouter } from 'expo-router';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { formatDay, formatList } from '../lib/useStatsFormat';
import { scopeParams } from '../screens/PlacesScreens';
import type { LandscapeBucket } from '../utils/landscapes';
import type { LongTrailProgress } from '../utils/longTrails';
import { clusterPins, isStacked } from '../utils/mapClusters';
import {
  highestAscent,
  latestParkVisit,
  NATIONAL_PARK_COUNT,
  type ParksAndPeaks,
  peakCount,
  visitedParks,
} from '../utils/parksAndPeaks';
import { fitMapRegion, type MapRegion, mapCamera } from '../utils/shareMap';
import type { TripPlaces } from '../utils/tripPlaces';
import type { TripStatsRecord } from '../utils/tripStats';
import type { TripTrailsRecord } from '../utils/tripTrails';
import { formatDistance, formatElevation, type TripDistanceUnit } from '../utils/units';
import { LandscapesCard } from './LandscapesCard';
import { LongTrailsCard } from './LongTrailCards';
import { PlacesCard } from './PlacesAndGearCards';
import { CardLink, ProgressBar, StatsCard, StatsRow, StatTile } from './StatsParts';

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

/**
 * How many trails the user has walked and how far they add up to, opening the full list. With
 * none logged yet it says how to add one instead of showing zeros.
 */
export function TrailsCard({
  trails,
  unit,
  onPress,
}: {
  trails: TripTrailsRecord;
  unit: TripDistanceUnit;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const count = trails.trails.length;
  return (
    <StatsCard title={t('tripStats.trails.title')}>
      <CardLink onPress={onPress} testID={testIds.tripStats.trailsCard}>
        {count > 0 ? (
          <>
            <View className="flex-row gap-4">
              <StatTile
                value={String(count)}
                label={t('tripStats.trails.figureTrails', { count })}
              />
              {trails.totalLengthMeters > 0 ? (
                <StatTile
                  value={formatDistance({ metres: trails.totalLengthMeters, unit })}
                  label={t('tripStats.trails.ofTrail')}
                />
              ) : null}
            </View>
            <Text variant="subhead" className="text-muted-foreground" numberOfLines={2}>
              {t('tripStats.trails.latest', {
                trails: formatList(trails.trails.slice(0, 3).map((item) => item.trail.name)),
              })}
            </Text>
          </>
        ) : (
          <Text variant="subhead" className="text-muted-foreground">
            {t('tripStats.trails.emptyBody')}
          </Text>
        )}
      </CardLink>
    </StatsCard>
  );
}

const MAP_HEIGHT = 220;

// The narrowest the stats map gets, so a single trip shows its surroundings.
const MAP_MIN_SPAN_METRES = 20_000;
// Google's default pin stands about 40dp above its point.
const PIN_INSET = 40 / MAP_HEIGHT;

/**
 * Routes as lines and trip locations as pins, on a static map that scrolls with the page. Pins that
 * would overlap become a count: tapping one zooms to its trips, or lists them under the map when
 * they share a spot. Tapping a pin lists its trip.
 */
export function TripsMapCard({ record, action }: { record: TripStatsRecord; action?: ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const mapRef = useRef<MapView>(null);
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
  // The frame depends on the map's shape, so the map waits for its width and remounts if it changes.
  const [width, setWidth] = useState(0);
  const region = useMemo(
    () =>
      width > 0
        ? fitMapRegion({
            points,
            aspect: width / MAP_HEIGHT,
            minSpanMetres: MAP_MIN_SPAN_METRES,
            topInset: PIN_INSET,
          })
        : null,
    [points, width],
  );
  // Where a tapped cluster zoomed to; null is the frame around every trip.
  const [zoomed, setZoomed] = useState<MapRegion | null>(null);
  // The trips listed under the map: a tapped pin, or a cluster whose trips share a spot.
  const [listed, setListed] = useState<string[]>([]);
  const shown = zoomed ?? region;
  const clusters = useMemo(() => clusterPins({ pins, region: shown }), [pins, shown]);

  const moveTo = (next: MapRegion | null) => {
    setZoomed(next);
    const target = next ?? region;
    if (target)
      mapRef.current?.animateCamera(mapCamera({ region: target, width, height: MAP_HEIGHT }));
  };

  const openCluster = (members: readonly string[]) => {
    const next = fitMapRegion({
      points: pins.filter((pin) => members.includes(pin.id)),
      aspect: width / MAP_HEIGHT,
      minSpanMetres: MAP_MIN_SPAN_METRES,
      topInset: PIN_INSET,
    });
    if (!next || !shown || isStacked({ current: shown, next })) {
      setListed([...members]);
      return;
    }
    setListed([]);
    moveTo(next);
  };

  const lines = record.routes.map((route) => (
    <Polyline
      key={route.id}
      coordinates={route.coordinates}
      strokeColor={colors.primary}
      strokeWidth={3}
    />
  ));
  const markers = clusters.map((cluster) => {
    const coordinate = { latitude: cluster.latitude, longitude: cluster.longitude };
    if (cluster.members.length === 1) {
      const pin = pins.find((item) => item.id === cluster.id);
      return (
        <Marker
          key={cluster.id}
          coordinate={coordinate}
          title={pin?.name}
          onPress={() => setListed([cluster.id])}
        />
      );
    }
    const count = cluster.members.length;
    return (
      <Marker
        key={cluster.id}
        coordinate={coordinate}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={false}
        accessibilityLabel={t('tripStats.countTrips', { count })}
        onPress={() => openCluster(cluster.members)}
      >
        <View
          className="h-9 min-w-9 items-center justify-center rounded-full px-2"
          style={{ backgroundColor: colors.primary, borderWidth: 2, borderColor: '#FFFFFF' }}
        >
          <Text variant="footnote" className="font-semibold" style={{ color: '#FFFFFF' }}>
            {String(count)}
          </Text>
        </View>
      </Marker>
    );
  });
  if (points.length === 0) return null;
  const map = region ? (
    <MapView
      key={width}
      ref={mapRef}
      style={{ flex: 1 }}
      initialCamera={mapCamera({ region, width, height: MAP_HEIGHT })}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
    >
      {lines}
      {markers}
    </MapView>
  ) : null;
  const listedTrips = listed.flatMap((id) => {
    const trip = record.finished.find((item) => item.trip.id === id);
    return trip ? [trip] : [];
  });
  return (
    <StatsCard title={t('tripStats.map.title')} action={action} hostsNativeView>
      <View
        className="overflow-hidden rounded-xl"
        style={{ height: MAP_HEIGHT, backgroundColor: colors.grey6 }}
        onLayout={(event) => {
          setWidth(Math.round(event.nativeEvent.layout.width));
          setZoomed(null);
        }}
        testID={testIds.tripStats.map}
      >
        {map}
        {zoomed ? (
          <Pressable
            onPress={() => {
              setListed([]);
              moveTo(null);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('tripStats.map.showAll')}
            android_ripple={{ borderless: true, color: colors.grey5 }}
            className="absolute top-2 right-2 h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.card, elevation: 3 }}
            testID={testIds.tripStats.mapShowAllBtn}
          >
            <Icon name="arrow-expand-all" size={20} color={colors.foreground} />
          </Pressable>
        ) : null}
      </View>
      {listedTrips.length > 0 ? (
        <View>
          {listedTrips.map(({ trip, start }) => (
            <StatsRow
              key={trip.id}
              inset={false}
              icon="map-marker-outline"
              title={trip.name}
              subtitle={formatDay(start)}
              onPress={() => router.push(`/trip/${trip.id}`)}
              testID={testIds.tripStats.mapTripRow(trip.id)}
            />
          ))}
        </View>
      ) : null}
    </StatsCard>
  );
}

/**
 * The map, countries and states, landscapes, then the lifetime collections, which open their own
 * lists.
 */
export function CollectionCards({
  record,
  places,
  landscapes,
  parksAndPeaks,
  trails,
  longTrails,
  followGoals,
  unit,
  showLifetime,
  mapAction,
}: {
  record: TripStatsRecord;
  places: TripPlaces;
  landscapes: readonly LandscapeBucket[];
  parksAndPeaks: ParksAndPeaks;
  trails: TripTrailsRecord;
  longTrails: readonly LongTrailProgress[];
  followGoals: ReadonlyMap<string, TripGoal>;
  unit: TripDistanceUnit;
  /** Parks and peaks are lifetime collections, shown only while the record isn't filtered. */
  showLifetime: boolean;
  /** The map card's share action. */
  mapAction?: ReactNode;
}) {
  const router = useRouter();
  return (
    <>
      <TripsMapCard record={record} action={mapAction} />
      <PlacesCard
        places={places}
        scope={record.scope}
        onPress={() =>
          router.push({ pathname: '/trip-stats/places', params: scopeParams(record.scope) })
        }
      />
      <LandscapesCard
        buckets={landscapes}
        onOpen={(landscape) =>
          router.push({
            pathname: '/trip-stats/landscape/[landscape]',
            params: { landscape, ...scopeParams(record.scope) },
          })
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
          <TrailsCard
            trails={trails}
            unit={unit}
            onPress={() => router.push('/trip-stats/trails')}
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
