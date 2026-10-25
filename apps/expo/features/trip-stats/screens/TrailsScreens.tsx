import type { TripTrail } from '@packrat/schemas/trips';
import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import { Button } from '@packrat/ui/src/button';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, SectionList, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SearchField, StatsRow, StatTile, ValueRow } from '../components/StatsParts';
import { useDistanceUnit } from '../hooks/useDistanceUnit';
import {
  useNearbyTrails,
  useRegistryTrail,
  useRouteTrails,
  useTrailSearch,
} from '../hooks/useTrailRegistry';
import { useTripStatsRecord, useTripTrails } from '../hooks/useTripStats';
import { pickedTrail$ } from '../lib/trailPicker';
import { formatDay, formatMonthYear } from '../lib/useStatsFormat';
import { type Coordinate, decodePolyline } from '../utils/polyline';
import type { WalkedTrail } from '../utils/tripTrails';
import { formatDistance, formatShortDistance, type TripDistanceUnit } from '../utils/units';

const MAP_HEIGHT = 260;
const SEARCH_DELAY_MS = 300;

/** "3.3 km · 2 times": the trail's length and how often it was walked. */
function walkedDetail({
  walked,
  unit,
  times,
}: {
  walked: WalkedTrail;
  unit: TripDistanceUnit;
  times: string;
}): string {
  return [
    walked.trail.lengthMeters != null
      ? formatDistance({ metres: walked.trail.lengthMeters, unit })
      : null,
    times,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Every registry trail named in a finished trip's log, most recently walked first. */
export function TrailsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const unit = useDistanceUnit();
  const record = useTripTrails(useTripStatsRecord());
  const count = record.trails.length;

  return (
    <SafeAreaView className="flex-1" edges={['bottom']}>
      <Stack.Screen options={{ ...getAppBarOptions(), title: t('tripStats.trails.title') }} />
      <FlatList
        data={record.trails}
        keyExtractor={(item) => item.trail.id}
        contentContainerClassName="pb-8"
        ListHeaderComponent={
          count > 0 ? (
            <View className="flex-row flex-wrap gap-x-4 px-4 py-3">
              <StatTile
                value={String(count)}
                label={t('tripStats.trails.figureTrails', { count })}
              />
              <StatTile
                value={String(record.walkCount)}
                label={t('tripStats.trails.figureWalks', { count: record.walkCount })}
              />
              {record.totalLengthMeters > 0 ? (
                <StatTile
                  value={formatDistance({ metres: record.totalLengthMeters, unit })}
                  label={t('tripStats.trails.ofTrail')}
                />
              ) : null}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="items-center gap-2 px-8 py-16">
            <Icon name="map-marker-path" size={48} color={colors.grey} />
            <Text variant="title3" className="font-medium">
              {t('tripStats.trails.noTrails')}
            </Text>
            <Text variant="body" className="text-center text-muted-foreground">
              {t('tripStats.trails.emptyListBody')}
            </Text>
          </View>
        }
        ListFooterComponent={
          count > 0 ? (
            <Text variant="footnote" className="px-4 pt-2 text-muted-foreground">
              {t('tripStats.trails.listFooter')}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <StatsRow
            icon="map-marker-path"
            title={item.trail.name}
            subtitle={walkedDetail({
              walked: item,
              unit,
              times: t('tripStats.trails.walkedTimes', { count: item.walks.length }),
            })}
            trailing={
              <View className="flex-row items-center gap-2">
                <Text variant="subhead" className="text-muted-foreground">
                  {formatMonthYear(item.latest)}
                </Text>
                <Icon name="chevron-right" size={24} color={colors.grey} />
              </View>
            }
            onPress={() =>
              router.push({ pathname: '/trip-stats/trails/[id]', params: { id: item.trail.id } })
            }
            testID={testIds.tripStats.walkedTrailRow(item.trail.id)}
          />
        )}
      />
    </SafeAreaView>
  );
}

/** Frames a [west, south, east, north] box, with a little room either side. */
function regionFor(bbox: readonly [number, number, number, number]) {
  const [west, south, east, north] = bbox;
  return {
    latitude: (south + north) / 2,
    longitude: (west + east) / 2,
    latitudeDelta: Math.max((north - south) * 1.3, 0.01),
    longitudeDelta: Math.max((east - west) * 1.3, 0.01),
  };
}

/** One walked trail: its line on a map, fetched from the registry, and the trips it was on. */
export function WalkedTrailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const unit = useDistanceUnit();
  const { id } = useLocalSearchParams<{ id: string }>();
  const record = useTripTrails(useTripStatsRecord());
  const walked = record.trails.find((item) => item.trail.id === id);
  const { isQueryEnabledWithAccessToken: isSignedIn } = useAuthenticatedQueryToolkit();
  const { data: detail, isError } = useRegistryTrail(id);
  const parts = useMemo(
    () => (detail?.lines ?? []).map(decodePolyline).filter((part) => part.length >= 2),
    [detail],
  );
  const title = walked?.trail.name ?? detail?.name ?? t('tripStats.trails.title');

  let map: ReactNode;
  if (detail && parts.length > 0) {
    map = (
      <MapView
        style={{ flex: 1 }}
        initialRegion={regionFor(detail.bbox)}
        scrollEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        {parts.map((part, index) => (
          <Polyline
            key={`part-${index}`}
            coordinates={part}
            strokeColor={colors.primary}
            strokeWidth={4}
          />
        ))}
      </MapView>
    );
  } else if (!isSignedIn || isError || detail) {
    map = (
      <View className="flex-1 items-center justify-center gap-2 px-8">
        <Icon name="map-outline" size={40} color={colors.grey} />
        <Text variant="body" className="font-medium">
          {t('tripStats.trails.mapUnavailable')}
        </Text>
        <Text variant="subhead" className="text-center text-muted-foreground">
          {isSignedIn ? t('tripStats.trails.mapFailed') : t('tripStats.trails.mapSignIn')}
        </Text>
      </View>
    );
  } else {
    map = (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1" edges={['bottom']}>
      <Stack.Screen options={{ ...getAppBarOptions(), title }} />
      <ScrollView contentContainerClassName="pb-8">
        {/* Pinch to zoom; dragging still scrolls the page. */}
        <View
          style={{ height: MAP_HEIGHT, backgroundColor: colors.grey6 }}
          testID={testIds.tripStats.walkedTrailMap}
          accessibilityLabel={t('tripStats.trails.mapLabel', { trail: title })}
        >
          {map}
        </View>
        {walked ? (
          <>
            <View className="px-4 pt-2">
              {walked.trail.lengthMeters != null ? (
                <ValueRow
                  label={t('tripStats.trails.length')}
                  value={formatDistance({ metres: walked.trail.lengthMeters, unit })}
                />
              ) : null}
              <ValueRow
                label={t('tripStats.trails.walked')}
                value={t('tripStats.trails.walkedTimes', { count: walked.walks.length })}
              />
            </View>
            <Text variant="subhead" className="px-4 pt-6 pb-1 font-medium text-primary">
              {t('tripStats.trails.trips')}
            </Text>
            {walked.walks.map((walk) => (
              <StatsRow
                key={walk.tripId}
                icon="map-marker-path"
                title={walk.tripName}
                subtitle={formatDay(walk.date)}
                onPress={() => router.push(`/trip/${walk.tripId}`)}
                testID={testIds.tripStats.walkedTrailTripRow(walk.tripId)}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

interface PickerOption {
  trail: TripTrail;
  detail: string;
}

interface PickerSection {
  key: string;
  title: string | null;
  data: PickerOption[];
}

/**
 * Picks a registry trail for a trip log. With a route it leads with the trails the route follows,
 * then the trails nearest the trip; typing searches every trail by name.
 */
export function TrailPickerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const unit = useDistanceUnit();
  const params = useLocalSearchParams<{
    lat?: string;
    lng?: string;
    route?: string;
    exclude?: string;
  }>();
  const route = params.route || null;
  // Nearby is measured from the route's start, else the trip's place.
  const center = useMemo<Coordinate | null>(() => {
    const start = route ? decodePolyline(route)[0] : undefined;
    if (start) return start;
    const latitude = Number(params.lat);
    const longitude = Number(params.lng);
    if (params.lat && params.lng && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
    return null;
  }, [route, params.lat, params.lng]);
  const excluded = useMemo(() => new Set(params.exclude?.split(',') ?? []), [params.exclude]);
  const { isQueryEnabledWithAccessToken: isSignedIn } = useAuthenticatedQueryToolkit();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);
  const isSearching = debounced.trim().length >= 2;

  const onRoute = useRouteTrails(route);
  const nearby = useNearbyTrails(center);
  const search = useTrailSearch(debounced);
  const active = isSearching ? [search] : [onRoute, nearby];
  const isLoading = active.some((item) => item.isLoading);
  const isError = active.some((item) => item.isError);

  const sections = useMemo((): PickerSection[] => {
    const length = (metres: number) => formatDistance({ metres, unit });
    if (isSearching) {
      const data = (search.data ?? []).map(
        (trail): PickerOption => ({ trail, detail: length(trail.lengthMeters) }),
      );
      return data.length ? [{ key: 'search', title: null, data }] : [];
    }
    const routeIds = new Set((onRoute.data ?? []).map((trail) => trail.id));
    return [
      {
        key: 'route',
        title: t('tripStats.trails.onYourRoute'),
        data: (onRoute.data ?? []).map(
          (trail): PickerOption => ({
            trail,
            detail: `${length(trail.lengthMeters)} · ${t('tripStats.trails.share', {
              share: `${Math.round(trail.coverage * 100)}%`,
            })}`,
          }),
        ),
      },
      {
        key: 'nearby',
        title: t('tripStats.trails.nearby'),
        data: (nearby.data ?? [])
          .filter((trail) => !routeIds.has(trail.id))
          .map(
            (trail): PickerOption => ({
              trail,
              detail: [
                length(trail.lengthMeters),
                trail.distanceMeters != null
                  ? t('tripStats.trails.away', {
                      distance: formatShortDistance({ metres: trail.distanceMeters, unit }),
                    })
                  : null,
              ]
                .filter(Boolean)
                .join(' · '),
            }),
          ),
      },
    ].filter((section) => section.data.length > 0);
  }, [isSearching, search.data, onRoute.data, nearby.data, unit, t]);

  const chooseTrail = (trail: TripTrail) => {
    pickedTrail$.set({ id: trail.id, name: trail.name, lengthMeters: trail.lengthMeters });
    router.back();
  };

  let status: ReactNode = null;
  if (!isSignedIn) {
    status = t('tripStats.trails.signIn');
  } else if (isLoading) {
    status = (
      <View className="items-center py-8">
        <ActivityIndicator />
      </View>
    );
  } else if (isError) {
    status = (
      <View className="items-center gap-2 py-8">
        <Text variant="body" className="text-muted-foreground">
          {t('tripStats.trails.loadFailed')}
        </Text>
        <Button
          variant="plain"
          onPress={() => {
            for (const item of active) item.refetch();
          }}
        >
          <Text className="text-primary">{t('tripStats.trails.retry')}</Text>
        </Button>
      </View>
    );
  } else if (sections.length === 0) {
    status = isSearching
      ? t('tripStats.trails.noMatch')
      : center
        ? t('tripStats.trails.noneNearby')
        : t('tripStats.trails.noPlace');
  }

  return (
    <SafeAreaView className="flex-1" edges={['bottom']}>
      <Stack.Screen options={{ ...getAppBarOptions(), title: t('tripStats.trails.addTrail') }} />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.trail.id}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={t('tripStats.trails.searchTrails')}
              testID={testIds.tripStats.trailSearchInput}
            />
            {typeof status === 'string' ? (
              <Text variant="body" className="px-4 py-6 text-center text-muted-foreground">
                {status}
              </Text>
            ) : (
              status
            )}
          </View>
        }
        renderSectionHeader={({ section }) =>
          section.title ? (
            <Text variant="subhead" className="px-4 pt-4 pb-1 font-medium text-primary">
              {section.title}
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const taken = excluded.has(item.trail.id);
          return (
            <StatsRow
              icon="map-marker-path"
              title={item.trail.name}
              subtitle={item.detail}
              onPress={taken ? undefined : () => chooseTrail(item.trail)}
              trailing={
                taken ? (
                  <Text variant="subhead" className="text-muted-foreground">
                    {t('tripStats.trails.added')}
                  </Text>
                ) : (
                  <Icon name="plus" size={24} color={colors.primary} />
                )
              }
              testID={testIds.tripStats.trailOption(item.trail.id)}
            />
          );
        }}
      />
    </SafeAreaView>
  );
}
