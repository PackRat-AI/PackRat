import { Text } from '@packrat/ui/nativewindui';
import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import { Icon, type MaterialIconName } from 'expo-app/components/Icon';
import { useWeightUnit } from 'expo-app/features/auth/hooks/useWeightUnit';
import { usePackDetailsFromStore } from 'expo-app/features/packs/hooks/usePackDetailsFromStore';
import { computeCategorySummaries } from 'expo-app/features/packs/utils';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

function CategoryCard({
  category,
  weightUnit,
}: {
  category: {
    name: string;
    items: number;
    weight: number;
    percentage: number;
    icon?: MaterialIconName;
  };
  weightUnit: string;
}) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const itemLabel = category.items === 1 ? t('packs.item') : t('packs.items');

  return (
    <View className="mx-4 mb-3 overflow-hidden rounded-xl bg-card shadow-sm">
      <View className="flex-row items-center p-4">
        <View
          className="h-12 w-12 items-center justify-center rounded-md"
          style={{ backgroundColor: colors.grey4 }}
        >
          <Icon name={category.icon || 'backpack'} size={24} color="white" />
        </View>

        <View className="ml-4 flex-1">
          <Text variant="heading" className="font-semibold">
            {category.name}
          </Text>
          <View className="flex-row items-center justify-between">
            <Text variant="subhead" className="text-muted-foreground">
              {category.items} {itemLabel}
            </Text>
            <View className="flex-row items-center gap-1">
              <Icon name="dumbbell" size={14} color={colors.grey3} />
              <Text variant="subhead" className="text-muted-foreground">
                {category.weight} {weightUnit}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function PackCategoriesScreen() {
  const params = useLocalSearchParams();
  const pack = usePackDetailsFromStore(params.id as string);
  const { t } = useTranslation();

  const { unit: weightUnit } = useWeightUnit();
  const categories = computeCategorySummaries({ pack, preferredUnit: weightUnit });

  return (
    <>
      <Stack.Screen
        options={{
          ...getAppBarOptions(),
          headerLargeTitle: false,
          title: t('packs.packCategories'),
        }}
      />
      {categories.length ? (
        <ScrollView className="flex-1" contentInsetAdjustmentBehavior="automatic">
          <View className="p-4">
            <Text variant="subhead" className="mb-2 text-muted-foreground">
              {t('packs.organizeGear')}
            </Text>
          </View>

          <View className="pb-4">
            {categories.map((category) => (
              <CategoryCard key={category.name} category={category} weightUnit={weightUnit} />
            ))}
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className="text-center">{t('packs.noCategorizedItems')}</Text>
        </View>
      )}
    </>
  );
}
