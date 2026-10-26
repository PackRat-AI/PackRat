import { ListItem } from '@packrat/ui/src/list';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTripStatsRecord } from '../hooks/useTripStats';

/**
 * The dashboard's Trip Stats row, a single line like its neighbours with the count on the right:
 * this year's trips, or all-time trips before the year's first trip. Hidden until a trip has
 * finished, since there is nothing to show before then.
 */
export function TripStatsTile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const enableTripStats = useFeatureFlag('enableTripStats');
  const record = useTripStatsRecord();
  if (!enableTripStats || !record.hasTrips) return null;

  const useThisYear = record.thisYear.trips > 0;
  const totals = useThisYear ? record.thisYear : record.totals;
  const summary = t(useThisYear ? 'tripStats.tileThisYear' : 'tripStats.tileAllTime', {
    trips: t('tripStats.countTrips', { count: totals.trips }),
  });

  return (
    <ListItem
      className="ios:pl-0 pl-2"
      titleClassName="text-lg"
      testID={testIds.tripStats.dashboardTile}
      leftView={
        <View className="px-3">
          <View className="h-6 w-6 items-center justify-center rounded-md bg-green-600">
            <Icon name="chart-bar" size={15} color="white" />
          </View>
        </View>
      }
      rightView={
        <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
          <Text className="mr-2 text-muted-foreground">{summary}</Text>
          <Icon name="chevron-right" size={17} color={colors.grey} />
        </View>
      }
      item={{ title: t('tripStats.title') }}
      onPress={() => router.push('/trip-stats')}
      target="Cell"
      index={0}
    />
  );
}
