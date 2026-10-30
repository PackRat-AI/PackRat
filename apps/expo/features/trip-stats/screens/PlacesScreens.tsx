import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatsRow } from '../components/StatsParts';
import { useTripPlaces, useTripStatsRecord } from '../hooks/useTripStats';
import { getPlaceAtlas } from '../lib/places';
import { formatDay, formatMonthYear, formatNumber, useScopeTitle } from '../lib/useStatsFormat';
import type { PlaceBoundary } from '../utils/places';
import { regionNoun } from '../utils/places';
import {
  type CountryStatus,
  findPlace,
  type RegionStatus,
  regionCount,
  regionLabel,
} from '../utils/tripPlaces';
import { isAllScope, type Scope, TRIP_ACTIVITIES } from '../utils/tripStats';

type ScopeParams = { year?: string; activity?: string };

/** The stats screen's filters travel as route params, so the list matches the card. */
export function scopeParams(scope: Scope): ScopeParams {
  return {
    ...(scope.year != null ? { year: String(scope.year) } : {}),
    ...(scope.activity ? { activity: scope.activity } : {}),
  };
}

export function useScopeFromParams(): Scope {
  const { year, activity } = useLocalSearchParams<ScopeParams>();
  return useMemo(() => {
    const parsedYear = year ? Number.parseInt(year, 10) : Number.NaN;
    const parsedActivity = TRIP_ACTIVITIES.find((item) => item === activity) ?? null;
    return {
      year: Number.isNaN(parsedYear) ? null : parsedYear,
      activity: parsedActivity,
    };
  }, [year, activity]);
}

function useScopedPlaces() {
  const scope = useScopeFromParams();
  const record = useTripStatsRecord(scope);
  return { scope, places: useTripPlaces(record) };
}

/** A country with its flag, or a region indented under it, with its trip count. */
function PlaceRow({
  place,
  flag,
  onPress,
  testID,
}: {
  place: CountryStatus | RegionStatus;
  /** A country's flag; undefined indents a region under its country. */
  flag?: string | null;
  onPress: () => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const isCountry = flag !== undefined;
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      android_ripple={{ color: colors.grey5 }}
      className="min-h-14 flex-row items-center gap-4 px-4 py-2"
    >
      <View className="w-7 items-center">
        {isCountry ? <Text style={{ fontSize: 24, lineHeight: 30 }}>{flag ?? '🏳️'}</Text> : null}
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="body" className={isCountry ? 'font-semibold' : undefined} numberOfLines={1}>
          {place.name}
        </Text>
        <Text variant="subhead" className="text-muted-foreground">
          {t('tripStats.places.firstVisit', { date: formatMonthYear(place.firstVisit) })}
        </Text>
      </View>
      <Text
        variant="subhead"
        className="text-muted-foreground"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {t('tripStats.countTrips', { count: place.visits.length })}
      </Text>
    </Pressable>
  );
}

type ListRow =
  | { kind: 'country'; key: string; country: CountryStatus }
  | { kind: 'region'; key: string; region: RegionStatus };

/** Every country visited, busiest first, each with its states or provinces under it. */
export function PlacesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const { scope, places } = useScopedPlaces();
  const scopeTitle = useScopeTitle(scope);
  const regions = regionCount(places);
  const rows = useMemo(
    () =>
      places.countries.flatMap((country): ListRow[] => [
        { kind: 'country', key: country.code, country },
        ...country.regions.map((region): ListRow => ({ kind: 'region', key: region.code, region })),
      ]),
    [places.countries],
  );
  const open = (code: string) =>
    router.push({ pathname: '/trip-stats/place/[code]', params: { code, ...scopeParams(scope) } });

  return (
    <SafeAreaView className="flex-1" edges={['bottom']}>
      <Stack.Screen options={{ ...getAppBarOptions(), title: t('tripStats.places.title') }} />
      {rows.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Icon name="earth" size={48} color={colors.grey} />
          <Text variant="title3" className="text-center font-medium">
            {t('tripStats.places.emptyTitle')}
          </Text>
          <Text variant="body" className="text-center text-muted-foreground">
            {t('tripStats.places.emptyBody')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          contentContainerClassName="pb-8"
          ListHeaderComponent={
            <View className="gap-2 px-4 pt-2 pb-3">
              <View className="flex-row gap-6">
                <View>
                  <Text variant="title2" className="font-bold">
                    {formatNumber(places.countries.length)}
                  </Text>
                  <Text variant="subhead" className="text-muted-foreground">
                    {t('tripStats.places.countries', { count: places.countries.length })}
                  </Text>
                </View>
                {regions > 0 ? (
                  <View>
                    <Text variant="title2" className="font-bold">
                      {formatNumber(regions)}
                    </Text>
                    <Text variant="subhead" className="text-muted-foreground">
                      {t(`tripStats.places.nouns.${regionLabel(places)}`)}
                    </Text>
                  </View>
                ) : null}
              </View>
              {isAllScope(scope) ? null : (
                <Text variant="footnote" className="text-muted-foreground">
                  {t('tripStats.places.scopeNote', { scope: scopeTitle })}
                </Text>
              )}
            </View>
          }
          renderItem={({ item: row }) =>
            row.kind === 'country' ? (
              <PlaceRow
                place={row.country}
                flag={row.country.flag}
                onPress={() => open(row.country.code)}
                testID={testIds.tripStats.placeRow(row.country.code)}
              />
            ) : (
              <PlaceRow
                place={row.region}
                onPress={() => open(row.region.code)}
                testID={testIds.tripStats.placeRow(row.region.code)}
              />
            )
          }
          ListFooterComponent={
            <Text variant="footnote" className="px-4 pt-4 text-muted-foreground">
              {t('tripStats.places.footer')}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const MAP_HEIGHT = 240;
const RGB = /^rgb\((.+)\)$/;

/** The theme's `rgb(…)` colour at the given opacity, for a translucent fill. */
function translucent({ color, alpha }: { color: string; alpha: number }): string {
  const match = RGB.exec(color);
  return match ? `rgba(${match[1]}, ${alpha})` : color;
}

/** Fits the outlines; one spanning the antimeridian (Alaska, Fiji) fits its pins instead. */
function regionFor({
  shapes,
  pins,
}: {
  shapes: readonly PlaceBoundary[];
  pins: readonly { latitude: number; longitude: number }[];
}) {
  const boxes = shapes.filter((shape) => shape.rings.length > 0);
  let minLat = Math.min(...boxes.map((shape) => shape.minLatitude));
  let maxLat = Math.max(...boxes.map((shape) => shape.maxLatitude));
  let minLng = Math.min(...boxes.map((shape) => shape.minLongitude));
  let maxLng = Math.max(...boxes.map((shape) => shape.maxLongitude));
  if (boxes.length === 0 || maxLng - minLng >= 180) {
    if (pins.length === 0) return undefined;
    minLat = Math.min(...pins.map((pin) => pin.latitude));
    maxLat = Math.max(...pins.map((pin) => pin.latitude));
    minLng = Math.min(...pins.map((pin) => pin.longitude));
    maxLng = Math.max(...pins.map((pin) => pin.longitude));
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.2, 0.5),
    longitudeDelta: Math.max((maxLng - minLng) * 1.2, 0.5),
  };
}

/**
 * One country or state: its outline (or, for a country listed by state, the states visited), a
 * pin per trip, its states, and the trips themselves.
 */
export function PlaceDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { scope, places } = useScopedPlaces();
  const record = useTripStatsRecord(scope);
  const { country, region } = findPlace({ places, code: code ?? '' });
  const place = country ?? region;

  const shapes = useMemo(() => {
    const atlas = getPlaceAtlas();
    if (region) return [atlas.regionsByCode.get(region.code)].filter((shape) => shape != null);
    if (!country) return [];
    const own = atlas.countriesByCode.get(country.code);
    if (own && own.rings.length > 0) return [own];
    return country.regions.flatMap((item) => atlas.regionsByCode.get(item.code) ?? []);
  }, [country, region]);

  const pins = useMemo(() => {
    const ids = new Set(place?.visits.map((visit) => visit.tripId));
    return record.finished.flatMap((trip) =>
      ids.has(trip.trip.id) && trip.trip.location
        ? [{ id: trip.trip.id, name: trip.trip.name, ...trip.trip.location }]
        : [],
    );
  }, [place, record.finished]);

  if (!place) return null;
  const title = country ? `${country.flag ? `${country.flag} ` : ''}${country.name}` : place.name;
  const initialRegion = regionFor({ shapes, pins });
  const openRegion = (regionCode: string) =>
    router.push({
      pathname: '/trip-stats/place/[code]',
      params: { code: regionCode, ...scopeParams(scope) },
    });

  return (
    <SafeAreaView className="flex-1" edges={['bottom']}>
      <Stack.Screen options={{ ...getAppBarOptions(), title }} />
      <ScrollView contentContainerClassName="pb-8">
        {initialRegion ? (
          <View style={{ height: MAP_HEIGHT }} testID={testIds.tripStats.placeDetailMap}>
            <MapView
              style={{ flex: 1 }}
              initialRegion={initialRegion}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              toolbarEnabled={false}
            >
              {shapes.flatMap((shape) =>
                shape.rings.map((ring, index) => (
                  <Polygon
                    key={`${shape.code}-${index}`}
                    coordinates={ring}
                    strokeColor={colors.primary}
                    strokeWidth={1.5}
                    fillColor={translucent({ color: colors.primary, alpha: 0.18 })}
                  />
                )),
              )}
              {pins.map((pin) => (
                <Marker
                  key={pin.id}
                  coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
                  title={pin.name}
                />
              ))}
            </MapView>
          </View>
        ) : null}

        {country && country.regions.length > 0 ? (
          <>
            <Text variant="subhead" className="px-4 pt-4 pb-1 font-medium text-primary">
              {t(`tripStats.places.nouns.${regionNoun(country.code)}`)}
            </Text>
            {country.regions.map((item) => (
              <PlaceRow
                key={item.code}
                place={item}
                onPress={() => openRegion(item.code)}
                testID={testIds.tripStats.placeRow(item.code)}
              />
            ))}
          </>
        ) : null}

        <Text variant="subhead" className="px-4 pt-4 pb-1 font-medium text-primary">
          {t('tripStats.places.trips')}
        </Text>
        {place.visits.map((visit) => (
          <StatsRow
            key={visit.tripId}
            icon="map-marker-path"
            title={visit.tripName}
            subtitle={formatDay(visit.date)}
            onPress={() => router.push(`/trip/${visit.tripId}`)}
          />
        ))}
        <Text variant="footnote" className="px-4 pt-2 text-muted-foreground">
          {t('tripStats.places.firstVisit', { date: formatDay(place.firstVisit) })}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
