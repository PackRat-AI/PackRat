import { use$ } from '@legendapp/state/react';
import { Text } from '@packrat/ui/src/text';
import type { TranslationFunction } from 'expo-app/lib/i18n/types';
import { View } from 'react-native';
import { offlineMapsStore } from '../store/offlineMaps';
import type { OfflineArea, OfflineDownloadFailure, OfflineProgress } from '../types';
import { formatBytes } from '../utils/offlineArea';

export function failureText({
  area,
  failure,
  t,
}: {
  area: OfflineArea;
  failure: OfflineDownloadFailure;
  t: TranslationFunction;
}): string {
  if (failure === 'tooLarge') {
    return area.detail === 'trail'
      ? t('offlineMaps.failedTooLargeTrail')
      : t('offlineMaps.failedTooLarge');
  }
  return failure === 'diskFull' ? t('offlineMaps.failedDiskFull') : t('offlineMaps.failedOther');
}

/** A determinate bar plus the percentage and size so far. */
export function ProgressLine({
  progress,
  t,
}: {
  progress: OfflineProgress;
  t: TranslationFunction;
}) {
  const percent = Math.round(progress.fraction * 100);
  return (
    <View className="gap-1">
      <View
        className="h-1 overflow-hidden rounded-full bg-primary/20"
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
      >
        <View className="h-1 rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </View>
      <Text
        variant="caption1"
        className="text-muted-foreground"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {t('offlineMaps.progress', { percent, size: formatBytes(progress.bytes) })}
      </Text>
    </View>
  );
}

/** Why a download has not started yet: no Wi-Fi, or no connection at all. */
export function WaitingLine({ t }: { t: TranslationFunction }) {
  const allowCellular = use$(offlineMapsStore.allowCellular);
  return (
    <Text variant="caption1" className="text-muted-foreground">
      {allowCellular ? t('offlineMaps.waitingForConnection') : t('offlineMaps.waitingForWifi')}
    </Text>
  );
}
