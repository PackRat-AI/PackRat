import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardImage,
  CardSubtitle,
  CardTitle,
  Text,
} from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Platform, TouchableWithoutFeedback, View } from 'react-native';
import type { CatalogItem } from '../types';

const fallbackImage = require('expo-app/assets/image-not-available.png');

type CatalogItemCardProps = {
  item: CatalogItem;
  onPress: () => void;
};

export function CatalogItemCard({ item, onPress }: CatalogItemCardProps) {
  const { colors } = useColorScheme();

  return (
    <TouchableWithoutFeedback onPress={onPress} className="mb-3">
      <Card className="overflow-hidden">
        <View>
          <View className="h-48 w-full">
            <CardImage
              source={
                item.images?.[0]
                  ? {
                      uri: item.images?.[0],
                      ...(Platform.OS === 'android'
                        ? {
                            headers: {
                              'User-Agent':
                                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
                              Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
                            },
                          }
                        : {}),
                    }
                  : fallbackImage
              }
              contentFit="cover"
              transition={200}
            />
          </View>

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
                used in {item.usageCount} {item.usageCount === 1 ? 'pack' : 'packs'}
              </Text>
            </View>
          )}
        </CardFooter>
      </Card>
    </TouchableWithoutFeedback>
  );
}
