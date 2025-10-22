import { Text, useColorScheme } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { CatalogItemImage } from 'expo-app/features/catalog/components/CatalogItemImage';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { TouchableWithoutFeedback, View } from 'react-native';

type HorizontalCatalogItemCardProps = {
  item: CatalogItem & { similarity?: number };
} & (
  | {
      onPress: () => void;
    }
  | {
      onSelect: (item: CatalogItem) => void;
      selected: boolean;
    }
);

const formatPrice = (price?: number | null, currency?: string | null) => {
  if (!price) return '';
  return `${currency || '$'}${price.toFixed(2)}`;
};

const formatWeight = (weight?: number | null, unit?: string | null) => {
  if (!weight) return '';
  return `${weight}${unit || 'g'}`;
};

export function HorizontalCatalogItemCard({ item, ...restProps }: HorizontalCatalogItemCardProps) {
  const isSelectable = 'onSelect' in restProps;
  const { colors } = useColorScheme();
  return (
    <TouchableWithoutFeedback
      key={item.id}
      onPress={isSelectable ? () => restProps.onSelect(item) : restProps.onPress}
    >
      <View
        className={`rounded-lg flex-row gap-3 border p-4 ${
          isSelectable && restProps.selected
            ? 'border-primary bg-primary/5'
            : 'border-border bg-card'
        }`}
      >
        {/* Image */}
        <CatalogItemImage
          imageUrl={item.images?.[0]}
          className="h-16 w-16 rounded-md"
          resizeMode="cover"
        />

        {/* Content */}
        <View className="flex-1">
          <Text className="font-medium text-foreground" numberOfLines={2}>
            {item.name}
          </Text>
          {item.brand && <Text className="text-sm text-muted-foreground">{item.brand}</Text>}

          <View className="mt-2 flex-row items-center gap-4">
            {item.price && (
              <Text className="text-sm font-medium text-foreground">
                {formatPrice(item.price, item.currency)}
              </Text>
            )}
            {item.weight && (
              <Text className="text-sm text-muted-foreground">
                {formatWeight(item.weight, item.weightUnit)}
              </Text>
            )}
            {item.ratingValue && (
              <View className="flex-row items-center gap-1">
                <Icon name="star" size={12} color={colors.yellow} />
                <Text className="text-sm text-muted-foreground">{item.ratingValue.toFixed(1)}</Text>
              </View>
            )}
          </View>
          {item.similarity && (
            <Text
              className={`text-xs font-medium mt-4 ${
                item.similarity >= 0.8
                  ? 'text-primary'
                  : item.similarity >= 0.5
                    ? 'text-foreground'
                    : 'text-muted-foreground'
              }`}
            >
              {Math.round(item.similarity * 100)}% confident
            </Text>
          )}
        </View>

        {/* Selection indicator */}
        {isSelectable && (
          <View className="items-center justify-center">
            {restProps.selected ? (
              <Icon name="check-circle" size={24} color={colors.primary} />
            ) : (
              <Icon name="circle-outline" size={24} color={colors.grey2} />
            )}
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}
