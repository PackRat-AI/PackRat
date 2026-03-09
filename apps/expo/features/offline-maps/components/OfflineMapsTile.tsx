import { ListItem, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { featureFlags } from 'expo-app/config';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useOfflineMapsStorageInfo } from '../hooks/useOfflineMapsStorageInfo';
import { formatBytes } from '../utils/regions';

export function OfflineMapsTile() {
  const router = useRouter();
  const { t } = useTranslation();
  const { completedCount, downloadingCount, totalSize } = useOfflineMapsStorageInfo();

  if (!featureFlags.enableOfflineMaps) return null;

  const subtitle =
    downloadingCount > 0
      ? t('offlineMaps.downloading', { count: downloadingCount })
      : completedCount > 0
        ? `${completedCount} ${completedCount === 1 ? t('offlineMaps.region') : t('offlineMaps.regions')} · ${formatBytes(totalSize)}`
        : t('offlineMaps.noRegions');

  return (
    <ListItem
      className="ios:pl-0 pl-2"
      titleClassName="text-lg"
      leftView={
        <View className="px-3">
          <View className="h-6 w-6 items-center justify-center rounded-md bg-teal-500">
            <Icon name="download" size={15} color="white" />
          </View>
        </View>
      }
      rightView={
        <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
          {downloadingCount > 0 && (
            <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
              <Text variant="footnote" className="font-bold leading-4 text-primary-foreground">
                {downloadingCount}
              </Text>
            </View>
          )}
          <ChevronRight />
        </View>
      }
      item={{ title: t('offlineMaps.title'), subTitle: subtitle }}
      onPress={() => router.push('/offline-maps')}
      target="Cell"
      index={0}
    />
  );
}

function ChevronRight() {
  const { colors } = useColorScheme();
  return <Icon name="chevron-right" size={17} color={colors.grey} />;
}
