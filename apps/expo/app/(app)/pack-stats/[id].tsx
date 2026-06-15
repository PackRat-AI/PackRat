import { Button, Text } from '@packrat/ui/nativewindui';
import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import { featureFlags } from 'expo-app/config';
import { userStore } from 'expo-app/features/auth/store';
import { usePackDetailsFromStore } from 'expo-app/features/packs/hooks/usePackDetailsFromStore';
import { usePackWeightHistory } from 'expo-app/features/packs/hooks/usePackWeightHistory';
import { computeCategorySummaries } from 'expo-app/features/packs/utils';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PackStatsScreen() {
  const params = useLocalSearchParams();
  const packId = params.id as string;
  const { t } = useTranslation();
  const router = useRouter();

  const pack = usePackDetailsFromStore(packId);
  const weightHistory = usePackWeightHistory(packId);

  const categories = computeCategorySummaries(pack);
  const CATEGORY_DISTRIBUTION = categories.map((category) => ({
    name: category.name,
    weight: category.weight,
    color: '#888',
    percentage: category.percentage,
  }));

  const WEIGHT_HISTORY = weightHistory?.map((entry) => ({
    month: entry.month,
    weight: entry.average_weight,
  }));

  return (
    <SafeAreaView className="flex-1" edges={['bottom']}>
      <Stack.Screen
        options={{ ...getAppBarOptions(), title: pack?.name ?? t('packs.packStats') }}
      />
      <ScrollView className="flex-1 px-4" contentInsetAdjustmentBehavior="automatic">
        {/* Weight History Section */}
        <View className="my-4 rounded-lg bg-card p-4">
          <Text variant="heading" className="mb-4 font-semibold">
            {t('packs.weightHistory')}
          </Text>

          {WEIGHT_HISTORY && WEIGHT_HISTORY.length > 0 ? (
            <>
              <View className="mb-2 h-40 flex-row items-end justify-between">
                {WEIGHT_HISTORY.map((item) => {
                  const maxWeight = Math.max(...WEIGHT_HISTORY.map((w) => w.weight));
                  const minWeight = Math.min(...WEIGHT_HISTORY.map((w) => w.weight));
                  const range = maxWeight - minWeight || 1;
                  const heightPercentage = ((item.weight - minWeight) / range) * 80 + 20;

                  return (
                    <View key={`${item.month}-${item.weight}`} className="flex-1 items-center">
                      <View
                        className="w-6 rounded-t-md bg-primary"
                        style={{ height: `${heightPercentage}%` }}
                      />
                      <Text variant="caption2" className="mt-1">
                        {item.month}
                      </Text>
                      <Text variant="caption2" className="text-muted-foreground">
                        {item.weight.toFixed(1)} g
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text variant="footnote" className="mt-2 text-center text-muted-foreground">
                {t('packs.packWeightOverMonths')}
              </Text>
            </>
          ) : (
            <View className="items-center gap-3 py-6">
              <Text variant="subhead" className="text-center font-medium">
                No weight history yet
              </Text>
              <Text variant="footnote" className="text-center text-muted-foreground">
                Add gear to your pack — your pack weight over time will appear here.
              </Text>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => router.dismissTo({ pathname: '/pack/[id]', params: { id: packId } })}
              >
                <Text>Open Pack</Text>
              </Button>
            </View>
          )}
        </View>

        {/* Category Distribution Section */}
        <View className="my-4 rounded-lg bg-card p-4">
          <Text variant="heading" className="mb-4 font-semibold">
            {t('packs.categoryDistribution')}
          </Text>

          {CATEGORY_DISTRIBUTION.length > 0 ? (
            <>
              <View className="mb-4">
                {CATEGORY_DISTRIBUTION.map((item) => (
                  <View key={item.name} className="mb-2">
                    <View className="mb-1 flex-row justify-between">
                      <Text variant="subhead">{item.name}</Text>
                      <Text variant="subhead">
                        {item.weight.toFixed(1)} {userStore.preferredWeightUnit.peek() ?? 'g'}(
                        {item.percentage}%)
                      </Text>
                    </View>
                    <View className="h-2 overflow-hidden rounded-full bg-muted">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
              <Text variant="footnote" className="mt-2 text-center text-muted-foreground">
                {t('packs.weightDistribution')}
              </Text>
            </>
          ) : (
            <View className="items-center gap-3 py-6">
              <Text variant="subhead" className="text-center font-medium">
                No categorized items
              </Text>
              <Text variant="footnote" className="text-center text-muted-foreground">
                Add items to your pack and assign categories to see weight distribution.
              </Text>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => router.dismissTo({ pathname: '/pack/[id]', params: { id: packId } })}
              >
                <Text>Open Pack</Text>
              </Button>
            </View>
          )}
        </View>

        {/* Pack Insights Section */}
        {featureFlags.enablePackInsights && (
          <View className="my-4 mb-8 rounded-lg bg-card p-4">
            <Text variant="heading" className="mb-4 font-semibold">
              {t('packs.packInsights')}
            </Text>

            <View className="mb-3 rounded-md bg-muted p-3 dark:bg-gray-100/5">
              <Text variant="subhead" className="font-medium">
                {t('packs.lighterThanSimilar')}
              </Text>
              <Text variant="footnote" className="mt-1 text-muted-foreground">
                {t('packs.basedOnData')}
              </Text>
            </View>

            <View className="mb-3 rounded-md bg-muted p-3 dark:bg-gray-100/5">
              <Text variant="subhead" className="font-medium">
                {t('packs.reducedWeight')}
              </Text>
              <Text variant="footnote" className="mt-1 text-muted-foreground">
                {t('packs.weightReduction')}
              </Text>
            </View>

            <View className="rounded-md bg-muted p-3 dark:bg-gray-100/5">
              <Text variant="subhead" className="font-medium">
                {t('packs.heaviestCategory')}
              </Text>
              <Text variant="footnote" className="mt-1 text-muted-foreground">
                {t('packs.considerUltralight')}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
