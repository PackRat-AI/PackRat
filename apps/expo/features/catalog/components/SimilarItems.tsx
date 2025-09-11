import { Text } from '@packrat/ui/nativewindui';
import { type SimilarItem, useSimilarCatalogItems } from 'expo-app/features/catalog/hooks';
import { useRouter } from 'expo-router';
import type React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { CatalogItemImage } from './CatalogItemImage';

interface SimilarItemsProps {
  catalogItemId: string;
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

export const SimilarItems: React.FC<SimilarItemsProps> = ({
  catalogItemId,
  itemName,
  limit = 5,
  threshold = 0.1,
}) => {
  const router = useRouter();
  const { data, isLoading, isError } = useSimilarCatalogItems(catalogItemId, {
    limit,
    threshold,
  });

  const handleItemPress = (itemId: string) => {
    router.push(`/catalog/${itemId}`);
  };

  if (isError) {
    return null; // Silently fail - similar items are not critical
  }

  if (isLoading) {
    return (
      <View className="mt-6">
        <Text className="mb-3 text-lg font-semibold text-foreground">More like {itemName}</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={Array(3).fill(null)}
          renderItem={() => <LoadingCard />}
          keyExtractor={(_, index) => `loading-${index}`}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        />
      </View>
    );
  }

  if (!data?.items || data.items.length === 0) {
    return null; // Don't show section if no similar items
  }

  return (
    <View className="mt-6">
      <Text className="mb-3 text-lg font-semibold text-foreground">More like {itemName}</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data.items}
        renderItem={({ item }) => <SimilarItemCard item={item} onPress={handleItemPress} />}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      />
    </View>
  );
};
