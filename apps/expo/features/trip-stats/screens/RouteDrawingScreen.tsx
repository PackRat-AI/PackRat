import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FullScreenDialogHeader } from '../components/DialogParts';
import { useDistanceUnit } from '../hooks/useDistanceUnit';
import { drawnRoute$ } from '../lib/routeDrawing';
import { type Coordinate, decodePolyline } from '../utils/polyline';
import { drawnDistance, outAndBack } from '../utils/routeDrawing';
import { fitMapRegion, type MapRegion } from '../utils/shareMap';
import { formatDistance } from '../utils/units';

// About 5 km across around the trip's spot when there is no line to frame yet.
const START_SPAN_DEGREES = 0.045;
const MIN_SPAN_METRES = 1_000;

/**
 * Draws a trip's route by tapping points on the map, joined by straight lines: the "draw" mode of
 * AllTrails' and Gaia GPS's route builders. Saving hands the line back to the trip log.
 */
export function RouteDrawingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const unit = useDistanceUnit();
  const params = useLocalSearchParams<{ route?: string; lat?: string; lng?: string }>();
  const [points, setPoints] = useState<Coordinate[]>(() =>
    params.route ? decodePolyline(params.route) : [],
  );
  // Framed once, from what the screen opened with; taps don't move the map.
  const [initialRegion] = useState<MapRegion | undefined>(() => {
    if (points.length >= 2) {
      return fitMapRegion({ points, aspect: 1, minSpanMetres: MIN_SPAN_METRES }) ?? undefined;
    }
    const latitude = Number(params.lat);
    const longitude = Number(params.lng);
    const center =
      points[0] ??
      (params.lat && params.lng && Number.isFinite(latitude) && Number.isFinite(longitude)
        ? { latitude, longitude }
        : null);
    return center
      ? { ...center, latitudeDelta: START_SPAN_DEGREES, longitudeDelta: START_SPAN_DEGREES }
      : undefined;
  });
  const distance = useMemo(() => drawnDistance(points), [points]);
  const hasLine = points.length >= 2;

  const save = () => {
    drawnRoute$.set(points);
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => (
            <FullScreenDialogHeader
              title={t('tripStats.log.drawTitle')}
              onClose={() => router.back()}
              onSave={save}
              canSave={hasLine}
            />
          ),
        }}
      />
      <MapView
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        toolbarEnabled={false}
        onPress={(event) => {
          const { coordinate } = event.nativeEvent;
          setPoints((current) => [...current, coordinate]);
        }}
        testID={testIds.tripStats.drawRouteMap}
      >
        {hasLine ? (
          <Polyline
            coordinates={points}
            strokeColor={colors.primary}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}
        {points.map((point, index) => {
          const isEnd = index === 0 || index === points.length - 1;
          const size = isEnd ? 14 : 9;
          return (
            <Marker
              key={index}
              coordinate={point}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View
                style={{
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                  backgroundColor:
                    index === 0
                      ? '#2E7D32'
                      : index === points.length - 1
                        ? '#C62828'
                        : colors.primary,
                }}
              />
            </Marker>
          );
        })}
      </MapView>
      <View className="items-center gap-3 border-t border-border px-4 pt-4 pb-2">
        <Text
          variant={hasLine ? 'title3' : 'subhead'}
          className={hasLine ? 'font-semibold' : 'text-muted-foreground'}
          style={hasLine ? { fontVariant: ['tabular-nums'] } : undefined}
          testID={testIds.tripStats.drawRouteDistance}
        >
          {hasLine ? formatDistance({ metres: distance, unit }) : t('tripStats.log.drawPrompt')}
        </Text>
        <View className="flex-row flex-wrap justify-center gap-2">
          <Button
            variant="tonal"
            disabled={points.length === 0}
            onPress={() => setPoints((current) => current.slice(0, -1))}
            testID={testIds.tripStats.drawRouteUndo}
          >
            <Icon name="undo" size={18} color={colors.foreground} />
            <Text>{t('tripStats.log.undo')}</Text>
          </Button>
          <Button
            variant="tonal"
            disabled={!hasLine}
            onPress={() => setPoints((current) => outAndBack(current))}
            testID={testIds.tripStats.drawRouteOutAndBack}
          >
            <Icon name="swap-horizontal" size={18} color={colors.foreground} />
            <Text>{t('tripStats.log.outAndBack')}</Text>
          </Button>
          <Button
            variant="tonal"
            disabled={points.length === 0}
            onPress={() => setPoints([])}
            testID={testIds.tripStats.drawRouteClear}
          >
            <Icon name="delete-outline" size={18} color={colors.foreground} />
            <Text>{t('tripStats.log.clear')}</Text>
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
