import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useWeightUnit } from 'expo-app/features/auth/hooks/useWeightUnit';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatsRow } from '../components/StatsParts';
import { useIdleGear, useTripStatsRecord } from '../hooks/useTripStats';
import { formatDecimal, formatList, formatMonthYear } from '../lib/useStatsFormat';
import type { IdleGearItem } from '../utils/idleGear';

/** Gear no finished trip carried in a year: never taken first, then the longest idle. */
export function IdleGearScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const { unit, convertWeight } = useWeightUnit();
  const record = useTripStatsRecord();
  const gear = useIdleGear(record);
  const neverTaken = gear.items.filter((item) => !item.lastTrip);
  const takenBefore = gear.items.filter((item) => item.lastTrip);

  const row = (item: IdleGearItem) => {
    const packs = formatList(item.packNames);
    return (
      <StatsRow
        key={item.id}
        title={item.name}
        subtitle={
          item.lastTrip
            ? t('tripStats.idleGear.lastDetail', {
                packs,
                trip: item.lastTrip.name,
                date: formatMonthYear(item.lastTrip.date),
              })
            : packs
        }
        trailing={
          item.grams > 0 ? (
            <Text
              variant="subhead"
              className="text-muted-foreground"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {`${formatDecimal(convertWeight({ weight: item.grams, fromUnit: 'g' }))} ${unit}`}
            </Text>
          ) : undefined
        }
        onPress={() => router.push({ pathname: '/pack/[id]', params: { id: item.packId } })}
        testID={testIds.tripStats.idleGearRow(item.id)}
      />
    );
  };

  return (
    <SafeAreaView className="flex-1" edges={['bottom']}>
      <Stack.Screen options={{ ...getAppBarOptions(), title: t('tripStats.idleGear.title') }} />
      {gear.items.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Icon name="check-circle-outline" size={48} color={colors.grey} />
          <Text variant="title3" className="text-center font-medium">
            {t('tripStats.idleGear.emptyTitle')}
          </Text>
          <Text variant="body" className="text-center text-muted-foreground">
            {t('tripStats.idleGear.emptyBody')}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerClassName="pb-8">
          {neverTaken.length > 0 ? (
            <>
              <Text variant="subhead" className="px-4 pt-4 pb-1 font-medium text-primary">
                {t('tripStats.idleGear.neverTitle')}
              </Text>
              {neverTaken.map(row)}
              <Text variant="footnote" className="px-4 pt-1 text-muted-foreground">
                {t('tripStats.idleGear.neverFooter')}
              </Text>
            </>
          ) : null}
          {takenBefore.length > 0 ? (
            <>
              <Text variant="subhead" className="px-4 pt-4 pb-1 font-medium text-primary">
                {t('tripStats.idleGear.lastTitle')}
              </Text>
              {takenBefore.map(row)}
            </>
          ) : null}
          <Text variant="footnote" className="px-4 pt-4 text-muted-foreground">
            {t('tripStats.idleGear.footer')}
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
