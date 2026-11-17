import { use$ } from '@legendapp/state/react';
import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
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
import { cameraBounds, TrailLines } from '../components/MapLayers';
import { useOfflineAreas } from '../hooks/useOfflineAreas';
import {
  connectionIsCellular,
  deleteArea,
  OUTDOORS_STYLE,
  saveArea,
} from '../lib/offlineMapManager';
import { offlineMapsStore } from '../store/offlineMaps';
import type { OfflineAreaBounds, OfflineDetailLevel } from '../types';
import {
  areasToFree,
  boundsEnclosing,
  boundsFromCorners,
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
};

/**
 * Frame an area on the map, choose the detail, see the size, and save it. The visible map is the
 * frame: what the user sees is what gets saved. A trip opens on its destination; a trail opens
 * framed on its line, which is drawn on the map and kept with the saved area.
 */
export function OfflineAreaPickerScreen() {
  const params = useLocalSearchParams<PickerParams>();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const alertRef = useRef<AlertMethods>(null);
  const saved = useOfflineAreas();
  const allowCellular = use$(offlineMapsStore.allowCellular);
  const storageLimit = use$(offlineMapsStore.storageLimitBytes);
  const trail = useTrail(params.trailId ?? '', { enabled: !!params.trailId });
  const lines = trail.data?.lines ?? [];

  const [bounds, setBounds] = useState<OfflineAreaBounds | null>(null);
  const [detail, setDetail] = useState<OfflineDetailLevel>('standard');
  const [name, setName] = useState(params.name ?? '');

  const lat = Number(params.lat);
  const lon = Number(params.lon);
  const center = Number.isFinite(lat) && Number.isFinite(lon) ? [lon, lat] : undefined;
  const lineBounds = boundsEnclosing(lines);
  // The trail's line arrives after the first render; remount the camera on it so it frames the line.
  const cameraKey = lineBounds ? 'trail' : 'initial';

  const fit = useMemo(
    () =>
      bounds ? packFit({ bounds, detail, saved: saved.filter((area) => area.isComplete) }) : null,
    [bounds, detail, saved],
  );
  const estimate = bounds && fit?.fitsAlone ? estimateBytes(bounds, detail) : null;
  const isTooLarge = fit?.fitsAlone === false;
  const isOutOfRoom = fit?.fitsAlone === true && !fit.fits;
  const canSave = estimate !== null && fit?.fits === true && name.trim().length > 0;

  const footer = isTooLarge
    ? detail === 'trail'
      ? t('offlineMaps.tooLargeTrail')
      : t('offlineMaps.tooLargeStandard')
    : isOutOfRoom
      ? t('offlineMaps.outOfRoom')
      : t('offlineMaps.frameFooter');

  const startSave = (allowCellularOnce: boolean) => {
    if (!bounds) return;
    const tripEndsAt = Number(params.tripEndsAt);
    saveArea({
      name: name.trim(),
      bounds,
      detail,
      tripId: params.tripId,
      tripEndsAt: Number.isFinite(tripEndsAt) ? tripEndsAt : undefined,
      trailId: params.trailId,
      trailLines: lines,
      allowCellularOnce,
    });
    router.back();
  };

  const attemptSave = () => {
    if (estimate === null) return;
    const toFree = areasToFree({ areas: saved, bytes: estimate, limit: storageLimit });
    if (toFree === null) {
      alertRef.current?.alert({
        title: t('offlineMaps.overLimitTitle'),
        message: t('offlineMaps.overLimitMessage'),
        buttons: [{ text: t('common.ok'), style: 'cancel' }],
      });
      return;
    }
    if (toFree.length > 0) {
      alertRef.current?.alert({
        title: t('offlineMaps.freeSpaceTitle'),
        message: t('offlineMaps.freeSpaceMessage', {
          names: new Intl.ListFormat(undefined, { type: 'conjunction' }).format(
            toFree.map((area) => area.name),
          ),
        }),
        buttons: [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('offlineMaps.freeSpaceConfirm'),
            style: 'destructive',
            onPress: async () => {
              for (const area of toFree) await deleteArea(area);
              confirmNetworkThenSave();
            },
          },
        ],
      });
      return;
    }
    confirmNetworkThenSave();
  };

  const confirmNetworkThenSave = () => {
    if (!connectionIsCellular() || allowCellular) {
      startSave(false);
      return;
    }
    alertRef.current?.alert({
      title: t('offlineMaps.cellularTitle'),
      message: t('offlineMaps.cellularMessage', { size: formatBytes(estimate ?? 0) }),
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
              onPress={attemptSave}
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
            onMapIdle={(state) => {
              const visible = boundsFromCorners(state.properties.bounds);
              if (visible) setBounds(visible);
            }}
          >
            <Mapbox.Camera
              key={cameraKey}
              defaultSettings={
                lineBounds
                  ? { bounds: cameraBounds(lineBounds, 48) }
                  : center
                    ? { centerCoordinate: center, zoomLevel: 11 }
                    : { zoomLevel: 11 }
              }
              followUserLocation={!lineBounds && !center}
              followZoomLevel={11}
              maxZoomLevel={14}
            />
            <Mapbox.LocationPuck />
            <TrailLines id="picker-trail" lines={lines} />
          </Mapbox.MapView>
          {/* The frame: everything inside it is saved. */}
          <View
            pointerEvents="none"
            className="absolute inset-0 rounded border-[3px]"
            style={{ borderColor: colors.primary }}
          />
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
        </View>
      </KeyboardAvoidingView>
      <Alert title="" buttons={[]} ref={alertRef} />
    </SafeAreaView>
  );
}
