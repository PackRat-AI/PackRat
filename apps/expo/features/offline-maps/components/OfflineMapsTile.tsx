import { ListItem } from '@packrat/ui/src/list';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useOfflineAreas } from '../hooks/useOfflineAreas';

/**
 * The dashboard's Offline maps row, one tap from Home like the maps apps hikers already use, with
 * the saved-map count on the right. Settings keeps its entry too.
 */
export function OfflineMapsTile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const enableOfflineMaps = useFeatureFlag('enableOfflineMaps');
  const areas = useOfflineAreas();
  if (!enableOfflineMaps) return null;

  return (
    <ListItem
      className="ios:pl-0 pl-2"
      titleClassName="text-lg"
      testID={testIds.offlineMaps.dashboardTile}
      leftView={
        <View className="px-3">
          <View className="h-6 w-6 items-center justify-center rounded-md bg-green-700">
            <Icon name="download-circle" size={15} color="white" />
          </View>
        </View>
      }
      rightView={
        <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
          <Text className="mr-2 text-muted-foreground">
            {areas.length === 0
              ? t('offlineMaps.tileEmpty')
              : t('offlineMaps.tileCount', { count: areas.length })}
          </Text>
          <Icon name="chevron-right" size={17} color={colors.grey} />
        </View>
      }
      item={{ title: t('offlineMaps.title') }}
      onPress={() => router.push('/offline-maps')}
      target="Cell"
      index={0}
    />
  );
}
