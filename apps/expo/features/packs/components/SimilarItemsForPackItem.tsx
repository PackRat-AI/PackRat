import { Text } from '@packrat/ui/nativewindui';
import { CatalogItemImage } from 'expo-app/features/catalog/components/CatalogItemImage';
import { type SimilarItem, useSimilarPackItems } from 'expo-app/features/catalog/hooks';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import type React from 'react';
import { FlatList, Pressable, View } from 'react-native';

interface SimilarItemsForPackItemProps {
  packId: string;
  itemId: string;
  itemName: string;
  limit?: number;
  threshold?: number;
}

interface SimilarItemCardProps {
  item: SimilarItem;
  onPress: (itemId: string) => void;
}

const SimilarItemCard: React.FC<SimilarItemCardProps> = ({ item, onPress }) => {
  return (
    <Pressable
      onPress={() => onPress(item.id.toString())}
      className="mr-3 w-32 rounded-lg bg-card p-2 shadow-sm"
      style={{ elevation: 2 }}
    >
      <CatalogItemImage
        imageUrl={item.images?.[0]}
        resizeMode="cover"
        className="h-24 w-full rounded-md"
      />

      <View className="mt-2">
        <Text className="text-xs font-medium text-foreground" numberOfLines={2}>
          {item.name}
        </Text>

        {item.brand && (
          <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={1}>
            {item.brand}
          </Text>
        )}

        <View className="mt-1 flex-row items-center justify-between">
          {item.price && (
            <Text className="text-xs font-semibold text-foreground">${item.price.toFixed(0)}</Text>
          )}

          <Text className="text-xs text-muted-foreground">
            {Math.round(item.similarity * 100)}% match
          </Text>
        </View>

        <Text className="mt-1 text-xs text-muted-foreground">
          {item.weight} {item.weightUnit}
        </Text>
      </View>
    </Pressable>
  );
};

const LoadingCard: React.FC = () => (
  <View className="mr-3 w-32 rounded-lg bg-card p-2">
    <View className="h-24 w-full rounded-md bg-muted" />
    <View className="mt-2">
      <View className="h-4 rounded bg-muted" />
      <View className="mt-1 h-3 w-3/4 rounded bg-muted" />
      <View className="mt-1 h-3 w-1/2 rounded bg-muted" />
    </View>
  </View>
);

export const SimilarItemsForPackItem: React.FC<SimilarItemsForPackItemProps> = ({
  packId,
  itemId,
  itemName,
  limit = 5,
  threshold = 0.1,
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { data, isLoading, isError } = useSimilarPackItems(packId, itemId, {
    limit,
    threshold,
  });

  const handleItemPress = (catalogItemId: string) => {
    router.push(`/catalog/${catalogItemId}`);
  };

  if (isError) {
    return null; // Silently fail - similar items are not critical
  }

  if (isLoading) {
    return (
      <View className="mt-10 px-4">
        <Text className="mb-3 text-lg font-semibold text-foreground">
          {t('packs.moreLike', { itemName })}
        </Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={Array(3).fill(null)}
          renderItem={() => <LoadingCard />}
          keyExtractor={(_, index) => `loading-${index}`}
        />
      </View>
    );
  }

  if (!data?.items || data.items.length === 0) {
    return null; // Don't show section if no similar items
  }

  return (
    <View className="mt-10 px-4">
      <Text className="mb-3 text-lg font-semibold text-foreground">
        {t('packs.moreLike', { itemName })}
      </Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data.items}
        renderItem={({ item }) => <SimilarItemCard item={item} onPress={handleItemPress} />}
        keyExtractor={(item) => item.id.toString()}
      />
    </View>
  );
};
