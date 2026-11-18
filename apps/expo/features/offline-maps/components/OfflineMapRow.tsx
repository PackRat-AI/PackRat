import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { type Href, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useDownloadState, useOfflineAreaFor } from '../hooks/useOfflineAreas';
import { updateArea } from '../lib/offlineMapManager';
import type { OfflineArea } from '../types';
import { failureText, ProgressLine, WaitingLine } from './DownloadStatus';

/**
 * On a trip or trail page: offers to save the map around it, then shows the download and a
 * "Saved for offline" badge once it is done.
 */
export function OfflineMapRow({
  tripId,
  trailId,
  picker,
  idPrefix,
}: {
  tripId?: string;
  trailId?: string;
  /** The picker, opened on this trip or trail. */
  picker: Href;
  /** Prefixes the test IDs, e.g. `trip` or `trail-page`. */
  idPrefix: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const area = useOfflineAreaFor({ tripId, trailId });

  if (area) return <SavedArea area={area} idPrefix={idPrefix} />;
  return (
    <Button
      variant="outlined"
      icon="download-outline"
      onPress={() => router.push(picker)}
      testID={testIds.offlineMaps.saveForOffline(idPrefix)}
    >
      <Text>{t('offlineMaps.saveForOffline')}</Text>
    </Button>
  );
}

function SavedArea({ area, idPrefix }: { area: OfflineArea; idPrefix: string }) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const { progress, failure, waiting } = useDownloadState(area.id);

  // A download restored before the manager reports on it is still a download, not a saved map.
  if (progress || waiting || (!failure && !area.isComplete)) {
    return (
      <View className="gap-2" testID={testIds.offlineMaps.progress(idPrefix)}>
        <View className="flex-row items-center gap-2">
          <Icon name="download-outline" size={18} color={colors.foreground} />
          <Text variant="subhead">{t('offlineMaps.savingForOffline')}</Text>
        </View>
        {progress ? <ProgressLine progress={progress} t={t} /> : <WaitingLine t={t} />}
      </View>
    );
  }
  if (failure === 'tooLarge') {
    // Saving the same area again would fail the same way; the Offline maps screen offers the fix.
    return (
      <View className="flex-row items-center gap-2">
        <Icon name="alert-outline" size={18} color={colors.destructive} />
        <Text variant="subhead" className="flex-1 text-destructive" wrap>
          {failureText({ area, failure, t })}
        </Text>
      </View>
    );
  }
  if (failure) {
    return (
      <Pressable
        onPress={() => void updateArea(area)}
        className="min-h-10 flex-row items-center gap-2"
        accessibilityRole="button"
        testID={testIds.offlineMaps.retry(idPrefix)}
      >
        <Icon name="alert-outline" size={18} color={colors.destructive} />
        <Text variant="subhead" className="text-destructive">
          {t('offlineMaps.retrySave')}
        </Text>
      </Pressable>
    );
  }
  return (
    <View className="flex-row items-center gap-2" testID={testIds.offlineMaps.saved(idPrefix)}>
      <Icon name="check-circle" size={18} color={colors.green} />
      <Text variant="subhead" textColor={colors.green}>
        {t('offlineMaps.savedForOffline')}
      </Text>
    </View>
  );
}
