import { Alert, type AlertRef, Button, LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import MapView, { Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { REGION_FILL_COLOR, REGION_TEAL_COLOR } from '../constants';
import { useDeleteMapRegion } from '../hooks/useDeleteMapRegion';
import { useDownloadMapRegion } from '../hooks/useDownloadMapRegion';
import { useOfflineMapRegions } from '../hooks/useOfflineMapRegions';
import { useOfflineMapsStorageInfo } from '../hooks/useOfflineMapsStorageInfo';
import type { OfflineMapRegion, PredefinedRegion } from '../types';
import { estimateDownloadSize, formatBytes, PREDEFINED_REGIONS } from '../utils/regions';

/** Extra space for the full-screen region view modal */
const MAP_VIEW_BOUNDS_PADDING = 1.2;

// ─── Storage Banner ──────────────────────────────────────────────────────────

function StorageBanner() {
  const { t } = useTranslation();
  const { totalSize, completedCount, downloadingCount } = useOfflineMapsStorageInfo();

  return (
    <View className="mx-4 mb-4 rounded-xl bg-card border border-border p-4">
      <Text variant="subhead" className="font-semibold text-foreground mb-1">
        {t('offlineMaps.storageUsed')}
      </Text>
      <Text variant="title3" className="font-bold text-foreground">
        {formatBytes(totalSize)}
      </Text>
      <Text variant="footnote" className="text-muted-foreground mt-1">
        {completedCount} {t('offlineMaps.completedRegions')}
        {downloadingCount > 0
          ? ` · ${downloadingCount} ${t('offlineMaps.downloading', { count: downloadingCount })}`
          : ''}
      </Text>
    </View>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ progress }: { progress: number }) {
  return (
    <View className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <View
        className="h-1.5 rounded-full bg-teal-500"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </View>
  );
}

// ─── Lightweight Region Bounds Preview ───────────────────────────────────────

/**
 * Renders a static bounding-box preview without spawning a native MapView.
 * Uses absolute-positioned Views to approximate the region rectangle,
 * avoiding the memory/jank cost of multiple MapView instances in a ScrollView.
 */
function RegionBoundsPreview({ region }: { region: OfflineMapRegion }) {
  const latSpan = Math.abs(region.bounds.maxLat - region.bounds.minLat);
  const lonSpan = Math.abs(region.bounds.maxLon - region.bounds.minLon);

  // Use the larger span to determine a rough aspect ratio for the preview box.
  const aspectRatio = lonSpan > 0 && latSpan > 0 ? lonSpan / latSpan : 1.5;
  const clampedAspect = Math.min(Math.max(aspectRatio, 0.5), 3);

  return (
    <View
      className="w-full bg-sky-50 dark:bg-slate-800 items-center justify-center overflow-hidden"
      style={{ aspectRatio: clampedAspect, maxHeight: 96, minHeight: 48 }}
    >
      {/* Grid lines to give a map-like appearance */}
      <View className="absolute inset-0 opacity-20">
        {[0.25, 0.5, 0.75].map((frac) => (
          <View
            key={`h-${frac}`}
            className="absolute w-full border-b border-sky-400 dark:border-slate-500"
            style={{ top: `${frac * 100}%` }}
          />
        ))}
        {[0.25, 0.5, 0.75].map((frac) => (
          <View
            key={`v-${frac}`}
            className="absolute h-full border-r border-sky-400 dark:border-slate-500"
            style={{ left: `${frac * 100}%` }}
          />
        ))}
      </View>
      {/* Region highlight box — fills most of the preview since it IS the region */}
      <View
        className="w-3/4 h-3/4 rounded"
        style={{
          borderWidth: 2,
          borderColor: REGION_TEAL_COLOR,
          backgroundColor: REGION_FILL_COLOR,
        }}
      />
    </View>
  );
}

// ─── Region Card ─────────────────────────────────────────────────────────────

function RegionCard({
  region,
  onDelete,
  onViewMap,
  onCancel,
}: {
  region: OfflineMapRegion;
  onDelete: () => void;
  onViewMap: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();

  const statusColor = {
    idle: 'bg-gray-400',
    downloading: 'bg-teal-500',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
    paused: 'bg-amber-500',
  }[region.status];

  const statusLabel = {
    idle: t('offlineMaps.statusIdle'),
    downloading: t('offlineMaps.statusDownloading'),
    completed: t('offlineMaps.statusCompleted'),
    failed: t('offlineMaps.statusFailed'),
    paused: t('offlineMaps.statusPaused'),
  }[region.status];

  return (
    <View className="mx-4 mb-3 rounded-xl bg-card border border-border overflow-hidden">
      {/* Lightweight static region preview (no MapView) */}
      <RegionBoundsPreview region={region} />

      <View className="p-3">
        <View className="flex-row items-center justify-between mb-1">
          <Text
            variant="heading"
            className="flex-1 font-semibold text-foreground"
            numberOfLines={1}
          >
            {region.name}
          </Text>
          <View className={`ml-2 rounded-full px-2 py-0.5 ${statusColor}`}>
            <Text variant="caption2" className="text-white font-medium">
              {statusLabel}
            </Text>
          </View>
        </View>

        <Text variant="footnote" className="text-muted-foreground">
          {t('offlineMaps.zoomRange', { min: region.minZoom, max: region.maxZoom })} ·{' '}
          {formatBytes(region.downloadedSize)} / {formatBytes(region.estimatedSize)}
        </Text>

        {region.status === 'downloading' && <ProgressBar progress={region.progress} />}

        <View className="flex-row mt-3 gap-2">
          {region.status === 'completed' && (
            <Button
              variant="secondary"
              size="sm"
              onPress={onViewMap}
              className="flex-1 flex-row items-center gap-1"
              accessibilityLabel={t('offlineMaps.viewMap')}
              accessibilityRole="button"
            >
              <Icon name="map" size={14} color={colors.foreground} />
              <Text variant="footnote">{t('offlineMaps.viewMap')}</Text>
            </Button>
          )}
          {region.status === 'downloading' && (
            <Button
              variant="secondary"
              size="sm"
              onPress={onCancel}
              className="flex-1 flex-row items-center gap-1"
              accessibilityLabel={t('offlineMaps.cancelDownloadButtonLabel')}
              accessibilityRole="button"
            >
              <Icon name="close" size={14} color={colors.destructive} />
              <Text variant="footnote" style={{ color: colors.destructive }}>
                {t('offlineMaps.cancelDownload')}
              </Text>
            </Button>
          )}
          {region.status !== 'downloading' && (
            <Button
              variant="secondary"
              size="sm"
              onPress={onDelete}
              className="flex-1 flex-row items-center gap-1"
              accessibilityLabel={t('offlineMaps.delete')}
              accessibilityRole="button"
            >
              <Icon name="trash-can-outline" size={14} color={colors.destructive} />
              <Text variant="footnote" style={{ color: colors.destructive }}>
                {t('offlineMaps.delete')}
              </Text>
            </Button>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Add Region Modal ─────────────────────────────────────────────────────────

function AddRegionModal({
  visible,
  onClose,
  onStartDownload,
}: {
  visible: boolean;
  onClose: () => void;
  /** Called with the selected region and zoom levels; hook lifecycle lives in parent */
  onStartDownload: (region: PredefinedRegion, minZoom: number, maxZoom: number) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const [selected, setSelected] = useState<PredefinedRegion | null>(null);
  const [minZoom, setMinZoom] = useState(10);
  const [maxZoom, setMaxZoom] = useState(15);
  const [isStarting, setIsStarting] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!selected || isStarting) return;
    setDownloadError(null);
    setIsStarting(true);
    try {
      // Validation (storage check, duplicate guard) happens inside onStartDownload.
      // We await it BEFORE closing so errors can be shown inline in the modal.
      // The actual tile simulation runs in the background, so this returns quickly.
      await onStartDownload(selected, minZoom, maxZoom);
      onClose();
    } catch (error) {
      const isStorageError = error instanceof Error && error.message === 'insufficient_storage';
      setDownloadError(
        isStorageError
          ? t('offlineMaps.insufficientStorageMessage')
          : t('offlineMaps.downloadError'),
      );
      console.error('[OfflineMaps] Failed to start download:', error);
    } finally {
      setIsStarting(false);
    }
  };

  const estimatedSize = selected ? estimateDownloadSize(selected.bounds, minZoom, maxZoom) : 0;

  const sizeLabelForCategory = (cat: PredefinedRegion['sizeCategory']) => {
    if (cat === 'state-park') return t('offlineMaps.sizeCategoryStatePark');
    if (cat === 'county') return t('offlineMaps.sizeCategoryCounty');
    return t('offlineMaps.sizeCategoryState');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2 border-b border-border">
          <Text variant="title3" className="font-bold text-foreground">
            {t('offlineMaps.addRegionTitle')}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityLabel={t('offlineMaps.closeButtonLabel')}
            accessibilityRole="button"
          >
            <Icon name="close" size={22} color={colors.foreground} />
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
          {/* Region list */}
          <View className="px-4 pt-4">
            <Text
              variant="subhead"
              className="font-semibold text-muted-foreground mb-2 uppercase tracking-wide"
            >
              {t('offlineMaps.selectRegion')}
            </Text>

            {PREDEFINED_REGIONS.map((region) => (
              <Pressable
                key={region.id}
                onPress={() => setSelected(region)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected?.id === region.id }}
                accessibilityLabel={region.name}
                className={`mb-2 rounded-xl border p-3 ${
                  selected?.id === region.id
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                    : 'border-border bg-card'
                }`}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text variant="body" className="font-semibold text-foreground">
                      {region.name}
                    </Text>
                    <Text variant="footnote" className="text-muted-foreground mt-0.5">
                      {region.description}
                    </Text>
                  </View>
                  <View className="ml-2 mt-0.5">
                    <View
                      className={`rounded-full px-2 py-0.5 ${
                        region.sizeCategory === 'state-park'
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : region.sizeCategory === 'county'
                            ? 'bg-blue-100 dark:bg-blue-900/30'
                            : 'bg-orange-100 dark:bg-orange-900/30'
                      }`}
                    >
                      <Text
                        variant="caption2"
                        className={`font-medium ${
                          region.sizeCategory === 'state-park'
                            ? 'text-green-700 dark:text-green-400'
                            : region.sizeCategory === 'county'
                              ? 'text-blue-700 dark:text-blue-400'
                              : 'text-orange-700 dark:text-orange-400'
                        }`}
                      >
                        {sizeLabelForCategory(region.sizeCategory)}
                      </Text>
                    </View>
                  </View>
                </View>
                {selected?.id === region.id && (
                  <Icon
                    name="check-circle"
                    size={18}
                    color={REGION_TEAL_COLOR}
                    style={{ position: 'absolute', top: 8, right: 8 }}
                  />
                )}
              </Pressable>
            ))}
          </View>

          {/* Zoom range */}
          {selected && (
            <View className="px-4 mt-4">
              <Text
                variant="subhead"
                className="font-semibold text-muted-foreground mb-3 uppercase tracking-wide"
              >
                {t('offlineMaps.zoomLevel')}
              </Text>

              <View className="flex-row gap-3">
                <View className="flex-1 rounded-xl border border-border bg-card p-3">
                  <Text variant="footnote" className="text-muted-foreground mb-1">
                    {t('offlineMaps.minZoom')}
                  </Text>
                  <View className="flex-row items-center justify-between">
                    <Pressable
                      onPress={() => setMinZoom((z) => Math.max(8, z - 1))}
                      className="h-8 w-8 items-center justify-center rounded-full bg-muted"
                      accessibilityLabel="Decrease minimum zoom"
                      accessibilityRole="button"
                    >
                      <Text variant="body" className="font-bold">
                        -
                      </Text>
                    </Pressable>
                    <Text variant="title3" className="font-bold text-foreground">
                      {minZoom}
                    </Text>
                    <Pressable
                      onPress={() => setMinZoom((z) => Math.min(maxZoom - 1, z + 1))}
                      className="h-8 w-8 items-center justify-center rounded-full bg-muted"
                      accessibilityLabel="Increase minimum zoom"
                      accessibilityRole="button"
                    >
                      <Text variant="body" className="font-bold">
                        +
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View className="flex-1 rounded-xl border border-border bg-card p-3">
                  <Text variant="footnote" className="text-muted-foreground mb-1">
                    {t('offlineMaps.maxZoom')}
                  </Text>
                  <View className="flex-row items-center justify-between">
                    <Pressable
                      onPress={() => setMaxZoom((z) => Math.max(minZoom + 1, z - 1))}
                      className="h-8 w-8 items-center justify-center rounded-full bg-muted"
                      accessibilityLabel="Decrease maximum zoom"
                      accessibilityRole="button"
                    >
                      <Text variant="body" className="font-bold">
                        -
                      </Text>
                    </Pressable>
                    <Text variant="title3" className="font-bold text-foreground">
                      {maxZoom}
                    </Text>
                    <Pressable
                      onPress={() => setMaxZoom((z) => Math.min(18, z + 1))}
                      className="h-8 w-8 items-center justify-center rounded-full bg-muted"
                      accessibilityLabel="Increase maximum zoom"
                      accessibilityRole="button"
                    >
                      <Text variant="body" className="font-bold">
                        +
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Size estimate */}
              <View className="mt-3 rounded-xl bg-muted p-3 dark:bg-gray-50/10">
                <Text variant="footnote" className="text-muted-foreground">
                  {t('offlineMaps.estimatedSize')}:{' '}
                  <Text variant="footnote" className="font-semibold text-foreground">
                    {formatBytes(estimatedSize)}
                  </Text>
                </Text>
                <Text variant="caption2" className="text-muted-foreground mt-1">
                  {t('offlineMaps.estimatedSizeNote')}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View className="px-4 py-4 border-t border-border gap-2">
          {downloadError && (
            <Text variant="footnote" className="text-red-500 text-center">
              {downloadError}
            </Text>
          )}
          <Button onPress={handleDownload} disabled={!selected || isStarting} className="w-full">
            <Text className="text-primary-foreground font-semibold">
              {t('offlineMaps.startDownload')}
            </Text>
          </Button>
        </View>
      </View>
    </Modal>
  );
}

// ─── View Region Map Modal ─────────────────────────────────────────────────────

function ViewRegionModal({
  region,
  onClose,
}: {
  region: OfflineMapRegion | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();

  // Single null guard: do not render when region is null
  if (!region) return null;

  const centerLat = (region.bounds.minLat + region.bounds.maxLat) / 2;
  const centerLon = (region.bounds.minLon + region.bounds.maxLon) / 2;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2 border-b border-border">
          <Text variant="title3" className="font-bold text-foreground flex-1" numberOfLines={1}>
            {region.name}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityLabel={t('offlineMaps.closeButtonLabel')}
            accessibilityRole="button"
          >
            <Icon name="close" size={22} color={colors.foreground} />
          </Pressable>
        </View>

        <View className="flex-1">
          <MapView
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={{
              latitude: centerLat,
              longitude: centerLon,
              latitudeDelta:
                Math.abs(region.bounds.maxLat - region.bounds.minLat) * MAP_VIEW_BOUNDS_PADDING,
              longitudeDelta:
                Math.abs(region.bounds.maxLon - region.bounds.minLon) * MAP_VIEW_BOUNDS_PADDING,
            }}
          >
            <Polygon
              coordinates={[
                { latitude: region.bounds.minLat, longitude: region.bounds.minLon },
                { latitude: region.bounds.maxLat, longitude: region.bounds.minLon },
                { latitude: region.bounds.maxLat, longitude: region.bounds.maxLon },
                { latitude: region.bounds.minLat, longitude: region.bounds.maxLon },
              ]}
              strokeColor={REGION_TEAL_COLOR}
              fillColor={REGION_FILL_COLOR}
              strokeWidth={2}
            />
          </MapView>
        </View>

        <View className="px-4 py-3 border-t border-border">
          <Text variant="footnote" className="text-muted-foreground text-center">
            {t('offlineMaps.viewMapOnlineNote')}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function OfflineMapsScreen() {
  const { t } = useTranslation();
  const regions = useOfflineMapRegions();
  const { deleteRegion } = useDeleteMapRegion();
  // Hook lives here so cancelRefs persists beyond modal unmount (issue #1)
  const { downloadRegion, cancelDownload } = useDownloadMapRegion();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [viewRegion, setViewRegion] = useState<OfflineMapRegion | null>(null);
  const deleteAlertRef = useRef<AlertRef>(null);
  const pendingDeleteRef = useRef<string | null>(null);

  const handleDeletePress = (id: string) => {
    pendingDeleteRef.current = id;
    deleteAlertRef.current?.show();
  };

  const handleDeleteConfirm = async () => {
    if (pendingDeleteRef.current) {
      await deleteRegion(pendingDeleteRef.current);
      pendingDeleteRef.current = null;
    }
  };

  return (
    <>
      <LargeTitleHeader
        title={t('offlineMaps.title')}
        rightView={() => (
          <Pressable
            onPress={() => setAddModalVisible(true)}
            hitSlop={8}
            className="pr-2"
            accessibilityLabel={t('offlineMaps.addRegionButtonLabel')}
            accessibilityRole="button"
          >
            <Icon name="plus" size={24} color={REGION_TEAL_COLOR} />
          </Pressable>
        )}
        backVisible
      />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Storage info */}
        <View className="pt-4">
          <StorageBanner />
        </View>

        {/* Empty state */}
        {regions.length === 0 && (
          <View className="items-center justify-center px-8 py-12">
            <Icon name="map-outline" size={56} color="#9ca3af" />
            <View className="h-4" />
            <Text variant="title3" className="text-center font-semibold text-foreground">
              {t('offlineMaps.noRegionsTitle')}
            </Text>
            <Text variant="body" className="mt-2 text-center text-muted-foreground">
              {t('offlineMaps.noRegionsSubtitle')}
            </Text>
            <View className="h-6" />
            <Button onPress={() => setAddModalVisible(true)}>
              <Text className="text-primary-foreground font-semibold">
                {t('offlineMaps.downloadRegion')}
              </Text>
            </Button>
          </View>
        )}

        {/* Region cards */}
        {regions.length > 0 && (
          <View>
            <Text
              variant="subhead"
              className="mx-4 mb-2 font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {t('offlineMaps.downloadedRegions')}
            </Text>
            {regions.map((region) => (
              <RegionCard
                key={region.id}
                region={region}
                onDelete={() => handleDeletePress(region.id)}
                onViewMap={() => setViewRegion(region)}
                onCancel={() => cancelDownload(region.id)}
              />
            ))}
          </View>
        )}

        {/* Info note */}
        <View className="mx-4 mt-4 rounded-xl bg-muted p-4 dark:bg-gray-50/10">
          <Text variant="footnote" className="text-muted-foreground">
            {t('offlineMaps.storageNote')}
          </Text>
        </View>
      </ScrollView>

      {/* Add Region Modal — receives downloadRegion from parent so cancelRefs survives close */}
      <AddRegionModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onStartDownload={downloadRegion}
      />

      {/* View Region Map Modal — conditionally rendered via null guard inside component */}
      <ViewRegionModal region={viewRegion} onClose={() => setViewRegion(null)} />

      {/* Delete Alert */}
      <Alert
        title={t('offlineMaps.deleteTitle')}
        message={t('offlineMaps.deleteMessage')}
        materialIcon={{ name: 'trash-can-outline' }}
        materialWidth={370}
        buttons={[
          {
            text: t('common.cancel'),
            style: 'cancel',
          },
          {
            text: t('offlineMaps.delete'),
            style: 'destructive',
            onPress: handleDeleteConfirm,
          },
        ]}
        ref={deleteAlertRef}
      />
    </>
  );
}
