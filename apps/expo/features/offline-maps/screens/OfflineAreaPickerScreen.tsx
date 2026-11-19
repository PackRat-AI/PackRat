import { use$ } from '@legendapp/state/react';
import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { Button } from '@packrat/ui/src/button';
import { SegmentedControl } from '@packrat/ui/src/segmented-control';
import { Text } from '@packrat/ui/src/text';
import { TextField } from '@packrat/ui/src/text-field';
import Mapbox from '@rnmapbox/maps';
import { useTrail } from 'expo-app/features/trail-conditions/hooks/useTrailConditions';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AreaOutline, cameraBounds, TrailLines } from '../components/MapLayers';
import { useOfflineAreas } from '../hooks/useOfflineAreas';
import { getNamedRegion } from '../lib/namedRegions';
import { connectionIsCellular, OUTDOORS_STYLE, saveArea } from '../lib/offlineMapManager';
import { offlineMapsStore } from '../store/offlineMaps';
import type { OfflineAreaBounds, OfflineDetailLevel } from '../types';
import {
  boundsEnclosing,
  boundsFromCorners,
  boundsRing,
  DETAIL_LEVELS,
  estimateBytes,
  formatBytes,
  packFit,
} from '../utils/offlineArea';

type PickerParams = {
  name?: string;
  tripId?: string;
  tripEndsAt?: string;
  trailId?: string;
  lat?: string;
  lon?: string;
  /** A named region from the region list: saves what lies inside its outline. */
  regionId?: string;
};

/**
 * Frame an area on the map, choose the detail, see the size, and save it. The visible map is the
 * frame: what the user sees is what gets saved. A trip opens on its destination; a trail opens
 * framed on its line, which is drawn on the map and kept with the saved area. A named region
 * instead saves what lies inside its outline, wherever the map is panned; one too large to save
 * whole offers to frame part of it right here, with its outline left on the map as a guide.
 */
export function OfflineAreaPickerScreen() {
  const params = useLocalSearchParams<PickerParams>();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const alertRef = useRef<AlertMethods>(null);
  const saved = useOfflineAreas();
  const allowCellular = use$(offlineMapsStore.allowCellular);
  const trail = useTrail(params.trailId ?? '');
  const lines = trail.data?.lines ?? [];
  const region = params.regionId ? getNamedRegion(params.regionId) : undefined;
  const regionBounds = useMemo(() => (region ? boundsEnclosing(region.rings) : null), [region]);

  const [bounds, setBounds] = useState<OfflineAreaBounds | null>(null);
  // While the map moves, the last settled bounds are no longer what the frame shows.
  const [isMoving, setIsMoving] = useState(false);
  const [detail, setDetail] = useState<OfflineDetailLevel>('standard');
  const [name, setName] = useState(params.name ?? region?.name ?? '');
  // The region is too large, so the user is framing part of it instead of saving its outline.
  const [framingPart, setFramingPart] = useState(false);
  const outline = framingPart ? undefined : region;

  const lat = Number(params.lat);
  const lon = Number(params.lon);
  const center = Number.isFinite(lat) && Number.isFinite(lon) ? [lon, lat] : undefined;
  const lineBounds = boundsEnclosing(lines);
  // The trail's line arrives after the first render; remount the camera on it so it frames the line.
  const cameraKey = lineBounds ? 'trail' : 'initial';

  // What gets saved: the region's outline, or the visible frame.
  const rings = useMemo(
    () => outline?.rings ?? (bounds ? [boundsRing(bounds)] : null),
    [outline, bounds],
  );
  const fit = useMemo(
    () => (rings ? packFit({ rings, detail, saved }) : null),
    [rings, detail, saved],
  );
  const estimate = rings && fit?.fitsAlone ? estimateBytes({ rings, detail }) : null;
  const isTooLarge = fit?.fitsAlone === false;
  const isOutOfRoom = fit?.fitsAlone === true && !fit.fits;
  // An area saved from a trail keeps its line, so wait for it before saving.
  const trailReady = !params.trailId || trail.isSuccess;
  const canSave =
    estimate !== null &&
    fit?.fits === true &&
    name.trim().length > 0 &&
    (outline !== undefined || !isMoving) &&
    trailReady;

  const footer = isTooLarge
    ? tooLargeMessage({ named: outline !== undefined, detail, name: name.trim(), t })
    : isOutOfRoom
      ? t('offlineMaps.outOfRoom')
      : outline
        ? t('offlineMaps.outlineFooter')
        : t('offlineMaps.frameFooter');

  const startSave = (allowCellularOnce: boolean) => {
    const savedBounds = outline ? regionBounds : bounds;
    if (!savedBounds) return;
    const tripEndsAt = Number(params.tripEndsAt);
    saveArea({
      name: name.trim(),
      bounds: savedBounds,
      boundary: outline?.rings,
      detail,
      tripId: params.tripId,
      tripEndsAt: Number.isFinite(tripEndsAt) ? tripEndsAt : undefined,
      trailId: params.trailId,
      trailLines: lines,
      allowCellularOnce,
    });
    // From the region list, close the whole flow and land on the download.
    if (region) router.dismissTo('/offline-maps');
    else router.back();
  };

  const confirmNetworkThenSave = () => {
    if (estimate === null) return;
    if (!connectionIsCellular() || allowCellular) {
      startSave(false);
      return;
    }
    alertRef.current?.alert({
      title: t('offlineMaps.cellularTitle'),
      message: t('offlineMaps.cellularMessage', { size: formatBytes(estimate) }),
      buttons: [
        { text: t('offlineMaps.cellularWait'), style: 'cancel', onPress: () => startSave(false) },
        { text: t('offlineMaps.cellularDownload'), onPress: () => startSave(true) },
      ],
    });
  };

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: t('offlineMaps.pickerTitle'),
          headerRight: () => (
            <Pressable
              onPress={confirmNetworkThenSave}
              disabled={!canSave}
              hitSlop={8}
              className="h-10 justify-center px-3"
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
              testID={testIds.offlineMaps.save}
            >
              <Text
                className="font-medium"
                style={{ color: canSave ? colors.primary : colors.grey }}
              >
                {t('common.save')}
              </Text>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="flex-1" testID={testIds.offlineMaps.areaMap}>
          <Mapbox.MapView
            style={{ flex: 1 }}
            styleURL={OUTDOORS_STYLE}
            scaleBarEnabled={false}
            onCameraChanged={() => setIsMoving(true)}
            onMapIdle={(state) => {
              setIsMoving(false);
              // Kept for a region too, so framing part of it starts from what is on screen.
              const visible = boundsFromCorners(state.properties.bounds);
              if (visible) setBounds(visible);
            }}
          >
            <Mapbox.Camera
              key={cameraKey}
              defaultSettings={
                regionBounds
                  ? { bounds: cameraBounds({ bounds: regionBounds, padding: 32 }) }
                  : lineBounds
                    ? { bounds: cameraBounds({ bounds: lineBounds, padding: 48 }) }
                    : center
                      ? { centerCoordinate: center, zoomLevel: 11 }
                      : { zoomLevel: 11 }
              }
              followUserLocation={!regionBounds && !lineBounds && !center}
              followZoomLevel={11}
              maxZoomLevel={14}
            />
            <Mapbox.LocationPuck />
            <TrailLines id="picker-trail" lines={lines} />
            {region ? <AreaOutline rings={region.rings} filled={!framingPart} /> : null}
          </Mapbox.MapView>
          {/* The frame: everything inside it is saved. */}
          {outline ? null : (
            <View
              pointerEvents="none"
              className="absolute inset-0 rounded border-[3px]"
              style={{ borderColor: colors.primary }}
            />
          )}
        </View>

        <View className="gap-4 border-t border-border bg-card p-4">
          <View className="gap-1">
            <SegmentedControl
              values={DETAIL_LEVELS.map((level) =>
                level === 'trail' ? t('offlineMaps.trail') : t('offlineMaps.standard'),
              )}
              selectedIndex={DETAIL_LEVELS.indexOf(detail)}
              onIndexChange={(index) => setDetail(DETAIL_LEVELS[index] ?? 'standard')}
              testID={testIds.offlineMaps.detail}
            />
            <Text variant="footnote" className="text-muted-foreground">
              {detail === 'trail'
                ? t('offlineMaps.trailSummary')
                : t('offlineMaps.standardSummary')}
            </Text>
          </View>
          <TextField
            label={t('offlineMaps.name')}
            value={name}
            onChangeText={setName}
            testID={testIds.offlineMaps.name}
          />
          <View className="flex-row items-center justify-between">
            <Text className="font-medium">{t('offlineMaps.size')}</Text>
            <Text
              className={isTooLarge || isOutOfRoom ? 'text-destructive' : 'text-muted-foreground'}
            >
              {isTooLarge
                ? t('offlineMaps.tooLarge')
                : estimate !== null
                  ? t('offlineMaps.about', { size: formatBytes(estimate) })
                  : '—'}
            </Text>
          </View>
          <Text
            variant="footnote"
            className={isTooLarge || isOutOfRoom ? 'text-destructive' : 'text-muted-foreground'}
            wrap
          >
            {footer}
          </Text>
          {outline && isTooLarge ? (
            <Button
              variant="tonal"
              icon="crop-free"
              className="self-start"
              onPress={() => setFramingPart(true)}
              testID={testIds.offlineMaps.framePart}
            >
              <Text>{t('offlineMaps.framePart')}</Text>
            </Button>
          ) : null}
        </View>
      </KeyboardAvoidingView>
      <Alert title="" buttons={[]} ref={alertRef} />
    </SafeAreaView>
  );
}

/** Why the area can't be saved, and the fix that applies to how it was chosen. */
function tooLargeMessage({
  named,
  detail,
  name,
  t,
}: {
  named: boolean;
  detail: OfflineDetailLevel;
  name: string;
  t: ReturnType<typeof useTranslation>['t'];
}): string {
  if (!named) {
    return detail === 'trail' ? t('offlineMaps.tooLargeTrail') : t('offlineMaps.tooLargeStandard');
  }
  return detail === 'trail'
    ? t('offlineMaps.tooLargeRegionTrail', { name })
    : t('offlineMaps.tooLargeRegionStandard', { name });
}
