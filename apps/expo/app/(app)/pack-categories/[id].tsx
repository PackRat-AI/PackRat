import { Icon } from '@roninoss/icons';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { LargeTitleHeader } from '~/components/nativewindui/LargeTitleHeader';
import { Text } from '~/components/nativewindui/Text';
import { userStore } from '~/features/auth/store';
import { usePackDetailsFromStore } from '~/features/packs/hooks/usePackDetailsFromStore';
import { computeCategorySummaries } from '~/features/packs/utils';
import { useColorScheme } from '~/lib/hooks/useColorScheme';

function CategoryCard({
  category,
}: {
  category: {
    name: string;
    items: number;
    weight: number;
    percentage: number;
  };
}) {
  const { colors } = useColorScheme();
  const itemLabel = category.items === 1 ? 'item' : 'items';

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

  const categories = computeCategorySummaries(pack);

  return (
    <>
      <LargeTitleHeader title="Pack Categories" />
      {categories.length ? (
        <ScrollView className="flex-1">
          <View className="p-4">
            <Text variant="subhead" className="mb-2 text-muted-foreground">
              Organize your gear by functional categories
            </Text>
          </View>

          <View className="pb-4">
            {categories.map((category: any) => (
              <CategoryCard key={category.name} category={category} />
            ))}
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text>Either there are no items in this pack or they aren't categorized yet.</Text>
        </View>
      )}
    </>
  );
}
