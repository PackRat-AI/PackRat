import type { TripSummit } from '@packrat/schemas/trips';
import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import { Button } from '@packrat/ui/src/button';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import { Toggle } from '@packrat/ui/src/toggle';
import { startOfDay } from 'date-fns';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { obs } from 'expo-app/lib/store';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { nanoid } from 'nanoid';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, SectionList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateField, FullScreenDialogHeader, OutlinedField } from '../components/DialogParts';
import { ExtendedFab, SearchField, StatsRow } from '../components/StatsParts';
import { useDistanceUnit } from '../hooks/useDistanceUnit';
import { useNearbyPeaks } from '../hooks/useNearbyPeaks';
import { useParksAndPeaks, useTripStatsRecord } from '../hooks/useTripStats';
import { consumePickedPeak, pickedPeak$ } from '../lib/peakPicker';
import { formatDay } from '../lib/useStatsFormat';
import { tripStatsEntriesStore } from '../store/entries';
import { peakKey } from '../utils/parksAndPeaks';
import { type PeakSuggestion, peakSearchBox, rankPeaks } from '../utils/peakSuggestions';
import { type Coordinate, decodePolyline } from '../utils/polyline';
import { dayToString } from '../utils/tripStats';
import {
  elevationSymbol,
  formatElevation,
  formatShortDistance,
  metresFromElevation,
} from '../utils/units';

/** Every summit, newest first: from trip logs, and climbs added by hand. */
export function PeaksScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const unit = useDistanceUnit();
  const record = useTripStatsRecord();
  const { ascents } = useParksAndPeaks(record);

  const remove = (id: string) =>
    obs({ store: tripStatsEntriesStore, id }).assign({
      deleted: true,
      localUpdatedAt: new Date().toISOString(),
    });

  return (
    <SafeAreaView className="flex-1" edges={['bottom']}>
      <Stack.Screen options={{ ...getAppBarOptions(), title: t('tripStats.peaks.title') }} />
      <FlatList
        data={ascents}
        keyExtractor={(ascent) => ascent.id}
        contentContainerClassName="pb-24"
        ListEmptyComponent={
          <View className="items-center gap-2 px-8 py-16">
            <Icon name="image-filter-hdr" size={48} color={colors.grey} />
            <Text variant="title3" className="font-medium">
              {t('tripStats.peaks.noSummits')}
            </Text>
            <Text variant="body" className="text-center text-muted-foreground">
              {t('tripStats.peaks.emptyBody')}
            </Text>
          </View>
        }
        renderItem={({ item: ascent }) => (
          <StatsRow
            icon="flag-variant-outline"
            title={ascent.summit.name}
            subtitle={[
              ascent.summit.elevationMeters != null
                ? formatElevation({ metres: ascent.summit.elevationMeters, unit })
                : null,
              ascent.tripName ?? t('tripStats.parks.handAdded'),
              ascent.date ? formatDay(ascent.date) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            onPress={ascent.tripId ? () => router.push(`/trip/${ascent.tripId}`) : undefined}
            trailing={
              ascent.tripId ? undefined : (
                <Pressable
                  onPress={() => remove(ascent.id)}
                  hitSlop={8}
                  className="p-2"
                  accessibilityRole="button"
                  accessibilityLabel={t('tripStats.peaks.remove')}
                  android_ripple={{ borderless: true, color: colors.grey5 }}
                >
                  <Icon name="delete-outline" size={24} color={colors.grey} />
                </Pressable>
              )
            }
            testID={testIds.tripStats.peakRow(peakKey(ascent.summit))}
          />
        )}
      />
      <ExtendedFab
        icon="plus"
        label={t('tripStats.peaks.addSummit')}
        onPress={() => router.push('/trip-stats/add-summit')}
        testID={testIds.tripStats.addSummitFab}
      />
    </SafeAreaView>
  );
}

/** A climb from before PackRat: the peak, and the day if the user knows it. */
export function AddSummitScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const unit = useDistanceUnit();
  const record = useTripStatsRecord();
  const [summit, setSummit] = useState<TripSummit | null>(null);
  const [knowsDate, setKnowsDate] = useState(true);
  const [date, setDate] = useState(startOfDay(new Date()));

  useFocusEffect(
    useCallback(() => {
      const picked = consumePickedPeak();
      if (picked) setSummit(picked);
    }, []),
  );

  // Search around the latest trip; the picker also takes a name typed by hand.
  const latest = record.allFinished.at(-1)?.trip.location;
  const choosePeak = () => {
    pickedPeak$.set(null);
    router.push({
      pathname: '/trip-stats/peak-picker',
      params: latest ? { lat: String(latest.latitude), lng: String(latest.longitude) } : {},
    });
  };

  const save = () => {
    if (!summit) return;
    const now = new Date().toISOString();
    const id = nanoid();
    obs({ store: tripStatsEntriesStore, id }).set({
      id,
      kind: 'summit',
      name: summit.name,
      elevationMeters: summit.elevationMeters ?? null,
      latitude: summit.latitude,
      longitude: summit.longitude,
      osmId: summit.osmId ?? null,
      date: knowsDate ? dayToString(date) : null,
      deleted: false,
      localCreatedAt: now,
      localUpdatedAt: now,
    });
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => (
            <FullScreenDialogHeader
              title={t('tripStats.peaks.addSummit')}
              onClose={() => router.back()}
              onSave={save}
              canSave={summit != null}
            />
          ),
        }}
      />
      <ScrollView contentContainerClassName="py-2">
        {summit ? (
          <StatsRow
            icon="flag-variant-outline"
            title={summit.name}
            subtitle={
              summit.elevationMeters != null
                ? formatElevation({ metres: summit.elevationMeters, unit })
                : null
            }
          />
        ) : null}
        <Button
          variant={summit ? 'plain' : 'tonal'}
          className="mx-4 my-2 self-start"
          onPress={choosePeak}
          testID={testIds.tripStats.choosePeakBtn}
        >
          <Text>
            {summit ? t('tripStats.peaks.chooseDifferent') : t('tripStats.peaks.choosePeak')}
          </Text>
        </Button>
        <View className="min-h-14 flex-row items-center gap-4 px-4">
          <Text variant="body" className="flex-1">
            {t('tripStats.parks.knowDate')}
          </Text>
          <Toggle value={knowsDate} onValueChange={setKnowsDate} />
        </View>
        {knowsDate ? (
          <DateField
            label={t('tripStats.parks.date')}
            value={date}
            maximumDate={new Date()}
            onChange={setDate}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Choose a peak: the ones a route passes over first, then nearby peaks nearest first, filtered
 * by a search field; or type one in by hand. Peaks come from OpenStreetMap through the API.
 */
export function PeakPickerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const unit = useDistanceUnit();
  const params = useLocalSearchParams<{
    lat?: string;
    lng?: string;
    route?: string;
    exclude?: string;
  }>();
  const route = useMemo(() => (params.route ? decodePolyline(params.route) : []), [params.route]);
  const center = useMemo<Coordinate | null>(() => {
    const latitude = Number(params.lat);
    const longitude = Number(params.lng);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && params.lat && params.lng) {
      return { latitude, longitude };
    }
    return route[0] ?? null;
  }, [params.lat, params.lng, route]);
  const excluded = useMemo(() => new Set(params.exclude?.split(',') ?? []), [params.exclude]);
  const box = useMemo(
    () => peakSearchBox(route.length >= 2 ? route : center ? [center] : []),
    [route, center],
  );
  const { data, isLoading, isError, refetch } = useNearbyPeaks(box);
  const [query, setQuery] = useState('');
  const [byHand, setByHand] = useState(!box);
  const [handName, setHandName] = useState('');
  const [handElevation, setHandElevation] = useState('');

  const sections = useMemo(() => {
    if (!data || !center) return [];
    const ranked = rankPeaks({ peaks: data, route, center });
    const needle = query.trim().toLowerCase();
    const keep = (item: PeakSuggestion) =>
      !excluded.has(peakKey(item.peak)) &&
      (!needle || item.peak.name.toLowerCase().includes(needle));
    return [
      { title: t('tripStats.peaks.onYourRoute'), data: ranked.onRoute.filter(keep) },
      { title: t('tripStats.peaks.nearby'), data: ranked.nearby.filter(keep) },
    ].filter((section) => section.data.length > 0);
  }, [data, center, route, query, excluded, t]);

  const selectPeak = (summit: TripSummit) => {
    pickedPeak$.set(summit);
    router.back();
  };

  const handElevationMetres = Number(handElevation.replace(',', '.'));

  return (
    <SafeAreaView className="flex-1" edges={['bottom']}>
      <Stack.Screen options={{ ...getAppBarOptions(), title: t('tripStats.peaks.choosePeak') }} />
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.peak.osmId)}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View>
            {box ? (
              <SearchField
                value={query}
                onChangeText={setQuery}
                placeholder={t('tripStats.peaks.searchPeaks')}
                testID={testIds.tripStats.peakSearchInput}
              />
            ) : null}
            <StatsRow
              icon="pencil-outline"
              title={t('tripStats.peaks.byHand')}
              onPress={() => setByHand((value) => !value)}
              trailing={<View />}
              testID={testIds.tripStats.peakByHandBtn}
            />
            {byHand ? (
              <View className="pb-2">
                <OutlinedField
                  label={t('tripStats.peaks.peakName')}
                  value={handName}
                  onChangeText={setHandName}
                  maxLength={200}
                  testID={testIds.tripStats.peakNameInput}
                />
                <OutlinedField
                  label={t('tripStats.peaks.elevation', { unit: elevationSymbol(unit) })}
                  value={handElevation}
                  onChangeText={setHandElevation}
                  keyboardType="number-pad"
                  testID={testIds.tripStats.peakElevationInput}
                />
                <Button
                  className="mx-4 mt-2 self-start"
                  disabled={!handName.trim()}
                  onPress={() =>
                    selectPeak({
                      name: handName.trim(),
                      elevationMeters:
                        handElevation && Number.isFinite(handElevationMetres)
                          ? metresFromElevation({ value: handElevationMetres, unit })
                          : null,
                      latitude: center?.latitude ?? 0,
                      longitude: center?.longitude ?? 0,
                      osmId: null,
                    })
                  }
                >
                  <Text>{t('tripStats.peaks.useThisPeak')}</Text>
                </Button>
              </View>
            ) : null}
            {isLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator />
              </View>
            ) : null}
            {isError ? (
              <View className="items-center gap-2 py-8">
                <Text variant="body" className="text-muted-foreground">
                  {t('tripStats.peaks.loadFailed')}
                </Text>
                <Button variant="plain" onPress={() => refetch()}>
                  <Text className="text-primary">{t('tripStats.peaks.retry')}</Text>
                </Button>
              </View>
            ) : null}
            {data && sections.length === 0 && !query ? (
              <Text variant="body" className="px-4 py-6 text-center text-muted-foreground">
                {t('tripStats.peaks.noneNearby')}
              </Text>
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text variant="subhead" className="px-4 pt-4 pb-1 font-medium text-primary">
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <StatsRow
            icon="image-filter-hdr"
            title={item.peak.name}
            subtitle={[
              item.peak.elevationMeters != null
                ? formatElevation({ metres: item.peak.elevationMeters, unit })
                : null,
              item.isOnRoute
                ? t('tripStats.peaks.fromRoute', {
                    distance: formatShortDistance({ metres: item.distanceMeters, unit }),
                  })
                : t('tripStats.peaks.away', {
                    distance: formatShortDistance({ metres: item.distanceMeters, unit }),
                  }),
            ]
              .filter(Boolean)
              .join(' · ')}
            onPress={() =>
              selectPeak({
                name: item.peak.name,
                elevationMeters: item.peak.elevationMeters,
                latitude: item.peak.latitude,
                longitude: item.peak.longitude,
                osmId: item.peak.osmId,
              })
            }
            trailing={<View />}
            testID={testIds.tripStats.peakRow(peakKey(item.peak))}
          />
        )}
      />
    </SafeAreaView>
  );
}
