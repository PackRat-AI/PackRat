import { FilterChip, FlowRow, Host, Text as JCText } from '@expo/ui/jetpack-compose';
import { testID as testIDModifier } from '@expo/ui/jetpack-compose/modifiers';
import type {
  TripActivity,
  TripLandscape,
  TripLog,
  TripSummit,
  TripTrail,
} from '@packrat/schemas/trips';
import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import * as Sentry from '@sentry/react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from 'expo-app/components/Icon';
import { useTripDetailsFromStore } from 'expo-app/features/trips/hooks/useTripDetailsFromStore';
import { useUpdateTrip } from 'expo-app/features/trips/hooks/useUpdateTrip';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FullScreenDialogHeader, OutlinedField, SectionLabel } from '../components/DialogParts';
import { MenuField } from '../components/MenuField';
import { StatsRow } from '../components/StatsParts';
import { useDistanceUnit } from '../hooks/useDistanceUnit';
import { fetchRegistryTrail } from '../hooks/useTrailRegistry';
import { getLandscapeGrid } from '../lib/landscapes';
import { consumePickedPeak, pickedPeak$ } from '../lib/peakPicker';
import { consumeDrawnRoute, drawnRoute$ } from '../lib/routeDrawing';
import { consumePickedTrail, pickedTrail$ } from '../lib/trailPicker';
import { TRIP_LANDSCAPES, tripLandscape } from '../utils/landscapes';
import { peakKey } from '../utils/parksAndPeaks';
import { decodePolyline, encodePolyline } from '../utils/polyline';
import { drawnDistance, totalTrailLength, trailDistances } from '../utils/routeDrawing';
import { GpxParseError, parseGpx, summarizeTrack } from '../utils/trackGeometry';
import { TRIP_ACTIVITIES } from '../utils/tripStats';
import { trailRoute } from '../utils/tripTrails';
import {
  distanceSymbol,
  distanceValue,
  elevationSymbol,
  elevationValue,
  formatDistance,
  formatElevation,
  metresFromDistance,
  metresFromElevation,
} from '../utils/units';

const MAX_SUMMITS = 100;
const MAX_TRAILS = 50;
const LANDSCAPE_OPTIONS = Object.freeze(['automatic', ...TRIP_LANDSCAPES] as const);

function shown(value: number | null | undefined): string {
  return value == null ? '' : String(Math.round(value * 10) / 10);
}

function parsed(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * The trip log, as a Material 3 full-screen dialog: activities as filter chips, distance and
 * climbing in the user's units, a route imported from a GPX file, and the trails walked and
 * summits reached.
 */
export function TripLogEditorScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const unit = useDistanceUnit();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTripDetailsFromStore(id);
  const updateTrip = useUpdateTrip();
  const queryClient = useQueryClient();
  const log = trip?.log;
  // Material 3 AlertDialog (Compose), not the legacy platform dialog `Alert.alert` draws.
  const alertRef = useRef<AlertMethods>(null);
  const showImportError = (message?: string) =>
    alertRef.current?.alert({
      title: t('tripStats.log.importFailed'),
      message,
      buttons: [{ text: t('tripStats.dialog.close'), style: 'default' }],
    });

  const [activities, setActivities] = useState<TripActivity[]>(log?.activities ?? []);
  const [distanceText, setDistanceText] = useState(
    shown(log?.distanceMeters != null ? distanceValue({ metres: log.distanceMeters, unit }) : null),
  );
  const [elevationText, setElevationText] = useState(
    shown(
      log?.elevationGainMeters != null
        ? elevationValue({ metres: log.elevationGainMeters, unit })
        : null,
    ),
  );
  const [route, setRoute] = useState<string | null>(log?.route ?? null);
  const [source, setSource] = useState<TripLog['source']>(log?.source ?? null);
  const [summits, setSummits] = useState<TripSummit[]>(log?.summits ?? []);
  const [trails, setTrails] = useState<TripTrail[]>(log?.trails ?? []);
  const [landscape, setLandscape] = useState<TripLandscape | null>(log?.landscape ?? null);
  // The latest values, for the trail fill that resolves after a network round trip.
  const routeRef = useRef(route);
  routeRef.current = route;
  const distanceRef = useRef(distanceText);
  distanceRef.current = distanceText;

  /** The first trail picked on a log without a route supplies the trail's line. */
  const fillFromTrail = async (trail: TripTrail) => {
    if (routeRef.current) return;
    try {
      const detail = await fetchRegistryTrail({ queryClient, id: trail.id });
      const line = trailRoute(detail.lines);
      if (!line || routeRef.current) return;
      setRoute(line);
      setSource('trail');
    } catch {
      // Without the trail's line the log just has no route.
    }
  };

  useFocusEffect(
    useCallback(() => {
      const picked = consumePickedPeak();
      if (picked) {
        setSummits((current) =>
          current.some((summit) => peakKey(summit) === peakKey(picked))
            ? current
            : [...current, picked].slice(0, MAX_SUMMITS),
        );
      }
      const trail = consumePickedTrail();
      if (trail) {
        setTrails((current) =>
          current.some((item) => item.id === trail.id)
            ? current
            : [...current, trail].slice(0, MAX_TRAILS),
        );
        fillFromTrail(trail);
      }
      const drawn = consumeDrawnRoute();
      if (drawn) {
        setRoute(encodePolyline(drawn));
        setSource('manual');
        setDistanceText(shown(distanceValue({ metres: drawnDistance(drawn), unit })));
      }
    }, [unit]),
  );

  if (!trip) return null;

  const toggleActivity = (activity: TripActivity) =>
    setActivities((current) =>
      current.includes(activity)
        ? current.filter((item) => item !== activity)
        : TRIP_ACTIVITIES.filter((item) => item === activity || current.includes(item)),
    );

  const importGpx = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/gpx+xml', 'application/xml', 'text/xml', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      const summary = summarizeTrack(parseGpx(await FileSystem.readAsStringAsync(asset.uri)));
      if (!summary) throw new GpxParseError('noPoints');
      setRoute(summary.route);
      setSource('track');
      setDistanceText(shown(distanceValue({ metres: summary.distanceMeters, unit })));
      // A file without elevations keeps a typed-in figure.
      if (summary.elevationGainMeters != null) {
        setElevationText(shown(elevationValue({ metres: summary.elevationGainMeters, unit })));
      }
    } catch (error) {
      if (error instanceof GpxParseError) {
        showImportError(
          error.reason === 'unreadable'
            ? t('tripStats.log.gpxUnreadable')
            : t('tripStats.log.gpxNoPoints'),
        );
        return;
      }
      Sentry.captureException(error, {
        tags: { feature: 'tripStats', action: 'importGpx' },
        extra: { tripId: trip.id },
      });
      showImportError();
    }
  };

  const addSummit = () => {
    pickedPeak$.set(null);
    const location = trip.location;
    router.push({
      pathname: '/trip-stats/peak-picker',
      params: {
        ...(route ? { route } : {}),
        ...(location ? { lat: String(location.latitude), lng: String(location.longitude) } : {}),
        exclude: summits.map(peakKey).join(','),
      },
    });
  };

  const drawRoute = () => {
    drawnRoute$.set(null);
    const location = trip.location;
    router.push({
      pathname: '/trip-stats/draw-route',
      params: {
        ...(route && source === 'manual' ? { route } : {}),
        ...(location ? { lat: String(location.latitude), lng: String(location.longitude) } : {}),
      },
    });
  };

  const addTrail = () => {
    pickedTrail$.set(null);
    const location = trip.location;
    router.push({
      pathname: '/trip-stats/trail-picker',
      params: {
        ...(route ? { route } : {}),
        ...(location ? { lat: String(location.latitude), lng: String(location.longitude) } : {}),
        exclude: trails.map((trail) => trail.id).join(','),
      },
    });
  };

  const distance = parsed(distanceText);
  const elevation = parsed(elevationText);

  const save = () => {
    const next: TripLog = {
      activities,
      distanceMeters: distance == null ? null : metresFromDistance({ value: distance, unit }),
      elevationGainMeters:
        elevation == null ? null : metresFromElevation({ value: elevation, unit }),
      route,
      source: route ? (source ?? 'track') : distance != null ? 'manual' : null,
      summits,
      trails,
      landscape,
    };
    updateTrip({ ...trip, log: next });
    router.back();
  };

  const routePoints = route ? decodePolyline(route).length : 0;
  const trailLength = totalTrailLength(trails);
  // A distance read from a GPS track is kept as recorded, so trails offer none.
  const showsTrailDistances = trailLength > 0 && source !== 'track';
  // "Automatic (Mountain)": what the trip reads as with the figures entered so far.
  const automaticLandscape = tripLandscape({
    trip: {
      location: trip.location,
      log: {
        activities,
        distanceMeters: distance == null ? null : metresFromDistance({ value: distance, unit }),
        elevationGainMeters:
          elevation == null ? null : metresFromElevation({ value: elevation, unit }),
        route,
        summits,
      },
    },
    grid: getLandscapeGrid(),
  });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => (
            <FullScreenDialogHeader
              title={t('tripStats.log.title')}
              onClose={() => router.back()}
              onSave={save}
              canSave
            />
          ),
        }}
      />
      <KeyboardAvoidingView behavior="height" className="flex-1">
        <ScrollView contentContainerClassName="pb-8" keyboardShouldPersistTaps="handled">
          <Text variant="title3" className="px-4 pt-2 font-medium" numberOfLines={2}>
            {trip.name}
          </Text>

          <SectionLabel>{t('tripStats.log.activities')}</SectionLabel>
          {/* Material 3 filter chips: the multi-select control for a handful of tags. */}
          <View className="px-4 py-2">
            <Host matchContents={{ vertical: true, horizontal: false }} style={{ width: '100%' }}>
              <FlowRow
                horizontalArrangement={{ spacedBy: 8 }}
                verticalArrangement={{ spacedBy: 8 }}
              >
                {TRIP_ACTIVITIES.map((activity) => (
                  <FilterChip
                    key={activity}
                    selected={activities.includes(activity)}
                    onClick={() => toggleActivity(activity)}
                    modifiers={[testIDModifier(testIds.tripStats.logActivity(activity))]}
                  >
                    <FilterChip.Label>
                      <JCText>{t(`tripStats.activities.names.${activity}`)}</JCText>
                    </FilterChip.Label>
                  </FilterChip>
                ))}
              </FlowRow>
            </Host>
          </View>

          <SectionLabel>{t('tripStats.totals.distance')}</SectionLabel>
          <OutlinedField
            label={t('tripStats.log.distance', { unit: distanceSymbol(unit) })}
            value={distanceText}
            onChangeText={setDistanceText}
            keyboardType="decimal-pad"
            testID={testIds.tripStats.logDistanceInput}
          />
          {showsTrailDistances ? (
            <View className="px-4 pb-1">
              <Host matchContents={{ vertical: true, horizontal: false }} style={{ width: '100%' }}>
                <FlowRow horizontalArrangement={{ spacedBy: 8 }}>
                  {trailDistances(trailLength).map((option) => {
                    const text = shown(distanceValue({ metres: option.metres, unit }));
                    return (
                      <FilterChip
                        key={option.kind}
                        selected={text === distanceText.trim()}
                        onClick={() => setDistanceText(text)}
                        modifiers={[
                          testIDModifier(testIds.tripStats.logTrailDistance(option.kind)),
                        ]}
                      >
                        <FilterChip.Label>
                          <JCText>
                            {t(`tripStats.log.${option.kind}`, {
                              distance: `${text} ${distanceSymbol(unit)}`,
                            })}
                          </JCText>
                        </FilterChip.Label>
                      </FilterChip>
                    );
                  })}
                </FlowRow>
              </Host>
              <Text variant="footnote" className="pt-1 text-muted-foreground">
                {t('tripStats.log.trailDistanceHint')}
              </Text>
            </View>
          ) : null}
          <OutlinedField
            label={t('tripStats.log.elevationGain', { unit: elevationSymbol(unit) })}
            value={elevationText}
            onChangeText={setElevationText}
            keyboardType="number-pad"
            testID={testIds.tripStats.logElevationInput}
          />

          <SectionLabel>{t('tripStats.log.route')}</SectionLabel>
          {route ? (
            <StatsRow
              icon="map-marker-path"
              title={t('tripStats.log.routePoints', { count: routePoints })}
              subtitle={
                source === 'track'
                  ? t('tripStats.log.routeImported')
                  : source === 'manual'
                    ? t('tripStats.log.routeDrawn')
                    : null
              }
              trailing={
                <Pressable
                  onPress={() => {
                    setRoute(null);
                    setSource(null);
                  }}
                  hitSlop={8}
                  className="p-2"
                  accessibilityRole="button"
                  accessibilityLabel={t('tripStats.log.removeRoute')}
                  android_ripple={{ borderless: true, color: colors.grey5 }}
                  testID={testIds.tripStats.removeRouteBtn}
                >
                  <Icon name="delete-outline" size={24} color={colors.grey} />
                </Pressable>
              }
            />
          ) : null}
          <View className="flex-row flex-wrap gap-2 px-4 py-2">
            <Button variant="tonal" onPress={importGpx} testID={testIds.tripStats.importGpxBtn}>
              <Icon name="file-upload-outline" size={18} color={colors.foreground} />
              <Text>{route ? t('tripStats.log.replaceRoute') : t('tripStats.log.importGpx')}</Text>
            </Button>
            {!route || source === 'manual' ? (
              <Button variant="tonal" onPress={drawRoute} testID={testIds.tripStats.drawRouteBtn}>
                <Icon name="draw" size={18} color={colors.foreground} />
                <Text>{route ? t('tripStats.log.editRoute') : t('tripStats.log.drawRoute')}</Text>
              </Button>
            ) : null}
          </View>

          <SectionLabel>{t('tripStats.log.trails')}</SectionLabel>
          {trails.map((trail, index) => (
            <StatsRow
              key={trail.id}
              icon="map-marker-path"
              title={trail.name}
              subtitle={
                trail.lengthMeters != null
                  ? formatDistance({ metres: trail.lengthMeters, unit })
                  : null
              }
              trailing={
                <Pressable
                  onPress={() => setTrails((current) => current.filter((_, i) => i !== index))}
                  hitSlop={8}
                  className="p-2"
                  accessibilityRole="button"
                  accessibilityLabel={t('tripStats.trails.remove')}
                  android_ripple={{ borderless: true, color: colors.grey5 }}
                  testID={testIds.tripStats.logRemoveTrail(index)}
                >
                  <Icon name="close" size={24} color={colors.grey} />
                </Pressable>
              }
            />
          ))}
          {trails.length < MAX_TRAILS ? (
            <Button
              variant="plain"
              className="mx-2 self-start"
              onPress={addTrail}
              testID={testIds.tripStats.logAddTrailBtn}
            >
              <Icon name="plus" size={18} color={colors.primary} />
              <Text className="text-primary">{t('tripStats.trails.addTrail')}</Text>
            </Button>
          ) : null}
          <Text variant="footnote" className="px-4 pb-2 text-muted-foreground">
            {route ? t('tripStats.trails.logHintRoute') : t('tripStats.trails.logHintNoRoute')}
          </Text>

          <SectionLabel>{t('tripStats.log.summits')}</SectionLabel>
          {summits.map((summit, index) => (
            <StatsRow
              key={peakKey(summit)}
              icon="flag-variant-outline"
              title={summit.name}
              subtitle={
                summit.elevationMeters != null
                  ? formatElevation({ metres: summit.elevationMeters, unit })
                  : null
              }
              trailing={
                <Pressable
                  onPress={() => setSummits((current) => current.filter((_, i) => i !== index))}
                  hitSlop={8}
                  className="p-2"
                  accessibilityRole="button"
                  accessibilityLabel={t('tripStats.peaks.remove')}
                  android_ripple={{ borderless: true, color: colors.grey5 }}
                  testID={testIds.tripStats.logRemoveSummit(index)}
                >
                  <Icon name="close" size={24} color={colors.grey} />
                </Pressable>
              }
            />
          ))}
          {summits.length < MAX_SUMMITS ? (
            <Button
              variant="plain"
              className="mx-2 self-start"
              onPress={addSummit}
              testID={testIds.tripStats.logAddSummitBtn}
            >
              <Icon name="plus" size={18} color={colors.primary} />
              <Text className="text-primary">{t('tripStats.log.addSummit')}</Text>
            </Button>
          ) : null}

          <SectionLabel>{t('tripStats.landscapes.title')}</SectionLabel>
          <MenuField
            label={t('tripStats.landscapes.field')}
            options={LANDSCAPE_OPTIONS}
            value={landscape ?? 'automatic'}
            onChange={(value) =>
              setLandscape(TRIP_LANDSCAPES.find((option) => option === value) ?? null)
            }
            optionLabel={(value) =>
              value !== 'automatic'
                ? t(`tripStats.landscapes.names.${value}`)
                : automaticLandscape
                  ? t('tripStats.landscapes.automaticWith', {
                      landscape: t(`tripStats.landscapes.names.${automaticLandscape}`),
                    })
                  : t('tripStats.landscapes.automatic')
            }
            testIDFor={() => testIds.tripStats.logLandscape}
          />
          <Text variant="footnote" className="px-4 pb-2 text-muted-foreground">
            {t('tripStats.landscapes.fieldHint')}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <Alert title="" buttons={[]} ref={alertRef} />
    </SafeAreaView>
  );
}
