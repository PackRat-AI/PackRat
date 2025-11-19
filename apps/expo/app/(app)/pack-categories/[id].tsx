import { LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { Icon, type IconProps } from '@roninoss/icons';
import { userStore } from 'expo-app/features/auth/store';
import { usePackDetailsFromStore } from 'expo-app/features/packs/hooks/usePackDetailsFromStore';
import { computeCategorySummaries } from 'expo-app/features/packs/utils';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

function CategoryCard({
  category,
}: {
  category: {
    name: string;
    items: number;
    weight: number;
    percentage: number;
    icon?: IconProps<'material'>['name'];
  };
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
                {category.weight} {userStore.preferredWeightUnit.peek() ?? 'g'}
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

  const categories = computeCategorySummaries(pack);

  return (
    <>
      <LargeTitleHeader title={t('packs.packCategories')} />
      {categories.length ? (
        <ScrollView className="flex-1">
          <View className="p-4">
            <Text variant="subhead" className="mb-2 text-muted-foreground">
              {t('packs.organizeGear')}
            </Text>
          </View>

          <View className="pb-4">
            {categories.map((category) => (
              <CategoryCard key={category.name} category={category} />
            ))}
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text>{t('packs.noCategorizedItems')}</Text>
        </View>
      )}
    </>
  );
}
