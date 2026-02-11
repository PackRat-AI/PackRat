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
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { TouchableWithoutFeedback, View } from 'react-native';
import type { CatalogItem } from '../types';
import { CatalogItemImage } from './CatalogItemImage';

type CatalogItemCardProps = {
  item: CatalogItem;
  onPress: () => void;
};

export function CatalogItemCard({ item, onPress }: CatalogItemCardProps) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();

  return (
    <TouchableWithoutFeedback onPress={onPress} className="mb-3">
      <Card className="overflow-hidden">
        <View>
          <CatalogItemImage
            imageUrl={item.images?.[0]}
            resizeMode="cover"
            className="h-48 w-full"
          />

          <CardContent className="p-3">
            <View>
              <View className="flex-row items-baseline justify-between gap-1">
                <View className="flex-1">
                  <CardTitle className="text-lg">{item.name}</CardTitle>
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
                {t('catalog.usedInPacks', {
                  count: item.usageCount,
                  unit: item.usageCount === 1 ? t('catalog.pack') : t('catalog.packs'),
                })}
              </Text>
            </View>
          )}
        </CardFooter>
      </Card>
    </TouchableWithoutFeedback>
  );
}
