import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardSubtitle,
  CardTitle,
  Text,
} from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { TouchableWithoutFeedback, View } from 'react-native';
import type { CatalogItem } from '../types';
import { CatalogItemImage } from './CatalogItemImage';

type CatalogItemSelectCardProps = {
  item: CatalogItem;
  isSelected: boolean;
  onToggle: () => void;
};

export function CatalogItemSelectCard({ item, isSelected, onToggle }: CatalogItemSelectCardProps) {
  const { colors } = useColorScheme();

  return (
    <TouchableWithoutFeedback onPress={onToggle}>
      <Card className={cn('overflow-hidden mb-3', isSelected && 'border-primary bg-primary/5')}>
        <View className="relative">
          <CatalogItemImage
            imageUrl={item.images?.[0]}
            resizeMode="cover"
            className="h-48 w-full"
          />

          {/* Selection indicator overlay */}
          <View className="absolute right-3 top-3">
            <View
              className={cn(
                'h-6 w-6 items-center justify-center rounded-full border-2',
                isSelected ? 'border-primary bg-primary' : 'border-white bg-white/80',
              )}
            >
              {isSelected && <Icon name="check" size={14} color="white" />}
            </View>
          </View>

          <CardContent className="p-3">
            <View>
              <View className="flex-row items-baseline justify-between gap-1">
                <View className="flex-1">
                  <CardTitle className={cn('text-lg', isSelected && 'text-primary')}>
                    {item.name}
                  </CardTitle>
                </View>
                {item.ratingValue && (
                  <View className="flex-row items-center">
                    <Icon name="star" size={14} color={colors.yellow} />
                    <Text className="ml-1 text-xs text-muted-foreground">
                      {item.ratingValue.toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>

              {item.brand && <CardSubtitle className="text-xs">{item.brand}</CardSubtitle>}

              <CardDescription className="mt-1 text-xs" numberOfLines={2}>
                {item.description}
              </CardDescription>
            </View>
          </CardContent>
        </View>

        <CardFooter className="flex-row items-center justify-between px-3 pb-3">
          <View className="flex-row items-center">
            <Icon name="dumbbell" size={14} color={colors.grey} />
            <Text className="ml-1 text-xs text-muted-foreground">
              {item.weight} {item.weightUnit}
            </Text>
          </View>
          {item.usageCount && item.usageCount > 0 && (
            <View className="flex-row items-center">
              <Icon name="backpack" size={14} color={colors.grey} />
              <Text className="ml-1 text-xs text-muted-foreground">
                used in {item.usageCount} {item.usageCount === 1 ? 'pack' : 'packs'}
              </Text>
            </View>
          )}
        </CardFooter>
      </Card>
    </TouchableWithoutFeedback>
  );
}
