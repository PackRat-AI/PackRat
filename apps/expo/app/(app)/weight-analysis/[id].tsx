'use client';

import { LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { userStore } from 'expo-app/features/auth/store';
import { usePackWeightAnalysis } from 'expo-app/features/packs/hooks/usePackWeightAnalysis';
import { cn } from 'expo-app/lib/cn';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView, ScrollView, View } from 'react-native';

function WeightCard({
  title,
  weight,
  percentage,
  className,
}: {
  title: string;
  weight: string;
  percentage?: number;
  className?: string;
}) {
  return (
    <View className={cn('rounded-lg bg-card p-4', className)}>
      <Text variant="subhead" className="text-muted-foreground">
        {title}
      </Text>
      <Text variant="title2" className="mt-1 font-semibold">
        {weight}
      </Text>
      {percentage && (
        <Text variant="footnote" className="mt-1 text-muted-foreground">
          {percentage}% of total
        </Text>
      )}
    </View>
  );
}

export default function WeightAnalysisScreen() {
  const params = useLocalSearchParams();
  const packId = params.id;
  const { t } = useTranslation();

  const { data, items } = usePackWeightAnalysis(packId as string);

  const preferredWeightUnit = userStore.preferredWeightUnit.peek() ?? 'g';

  return (
    <SafeAreaView className="flex-1">
      <LargeTitleHeader title={t('packs.weightAnalysis')} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        removeClippedSubviews={false}
      >
        <View className="grid grid-cols-2 gap-3 p-4">
          <WeightCard
            title={t('packs.baseWeight')}
            weight={`${data.baseWeight} g`}
            className="col-span-1"
          />
          <WeightCard
            title={t('packs.consumablesWeight')}
            weight={`${data.consumableWeight} ${preferredWeightUnit}`}
            className="col-span-1"
          />
          <WeightCard
            title={t('packs.wornWeight')}
            weight={`${data.wornWeight} ${preferredWeightUnit}`}
            className="col-span-1"
          />
          <WeightCard
            title={t('packs.totalWeight')}
            weight={`${data.totalWeight} ${preferredWeightUnit}`}
            className="col-span-1"
          />
        </View>

        <View className="mb-4 px-4">
          <Text variant="heading" className="mb-2 font-semibold">
            {t('packs.weightBreakdown')}
          </Text>
          <Text variant="subhead" className="mb-4 text-muted-foreground">
            {t('packs.detailedAnalysis')}
          </Text>
        </View>

        {data.categories.map((category, categoryIndex) => (
          <View key={category.name} className="mx-4 mb-4 rounded-lg bg-card">
            {/* Category Header */}
            <View className="border-border/25 dark:border-border/80 flex-row items-center justify-between border-b p-4">
              <View>
                <Text variant="heading" className="font-semibold">
                  {category.name}
                </Text>
                <Text variant="subhead" className="text-muted-foreground">
                  {category.weight} {preferredWeightUnit}
                </Text>
              </View>
            </View>

            {/* Items */}
            <View>
              {items
                .filter((item) => item.category.trim() === category.name.trim())
                .map((item, itemIndex) => (
                  <View
                    key={`${categoryIndex}-${item.id}`}
                    className={cn(
                      'flex-row items-center justify-between p-4',
                      itemIndex > 0 ? 'border-border/25 dark:border-border/80 border-t' : '',
                    )}
                  >
                    <View>
                      <Text>{item.name}</Text>
                      {item.notes && (
                        <Text variant="footnote" className="text-muted-foreground">
                          {item.notes}
                        </Text>
                      )}
                    </View>
                    <Text variant="subhead" className="text-muted-foreground">
                      {item.weight} {item.weightUnit}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        ))}

        {!data.categories.length && (
          <Text className="px-8 text-center">{t('packs.addItemsForBreakdown')}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
