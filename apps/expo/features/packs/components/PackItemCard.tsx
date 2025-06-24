import { Icon } from '@roninoss/icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Alert } from 'nativewindui/Alert';
import { Button } from 'nativewindui/Button';
import { useDeletePackItem } from '../hooks';
import { CachedImage } from 'expo-app/features/packs/components/CachedImage';

import { WeightBadge } from 'expo-app/components/initial/WeightBadge';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/useColorScheme';
import type { PackItem } from '../types';

type PackItemCardProps = {
  item: PackItem;
  onPress: (item: PackItem) => void;
};

export function PackItemCard({ item, onPress }: PackItemCardProps) {
  const router = useRouter();
  const deleteItem = useDeletePackItem();
  const { colors } = useColorScheme();

  return (
    <Pressable
      className="mb-3 flex-row overflow-hidden rounded-lg bg-card shadow-sm"
      onPress={() => onPress(item)}
    >
      <CachedImage localFileName={item.image} className="w-28" resizeMode="cover" />

      <View className="flex-1 p-3">
        <View className="flex-row items-start justify-between">
          <View className="mr-2 flex-1">
            <Text className="text-base font-medium text-foreground" numberOfLines={1}>
              {item.name}
            </Text>
            <Text className="mb-1 text-xs text-muted-foreground">{item.category}</Text>
          </View>

          <WeightBadge weight={item.weight * item.quantity} unit={item.weightUnit} />
        </View>

        {item.description && (
          <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View className="flex-row items-start justify-between">
          <View className="mt-2 flex-row items-center gap-2">
            {item.quantity > 1 && (
              <View className="rounded-full bg-muted px-2 py-0.5">
                <Text className="text-xs text-muted-foreground">Qty: {item.quantity}</Text>
              </View>
            )}

            {item.consumable && (
              <View className={cn('rounded-full px-2 py-0.5', 'bg-amber-100')}>
                <Text className={cn('text-xs', 'text-amber-600')}>Consumable</Text>
              </View>
            )}

            {item.worn && (
              <View className={cn('rounded-full px-2 py-0.5', 'bg-emerald-100')}>
                <Text className={cn('text-xs', 'text-emerald-600')}>Worn</Text>
              </View>
            )}
          </View>
          <View className="flex-row gap-[.4]">
            <Alert
              title="Delete item?"
              message="Are you sure you want to delete this item?"
              buttons={[
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'OK',
                  onPress: () => {
                    deleteItem(item.id);
                  },
                },
              ]}
            >
              <Button variant="plain" size="icon">
                <Icon name="trash-can" size={21} color={colors.grey2} />
              </Button>
            </Alert>
            <Button
              variant="plain"
              size="icon"
              onPress={() =>
                router.push({
                  pathname: '/item/[id]/edit',
                  params: { id: item.id, packId: item.packId },
                })
              }
            >
              <Icon name="pencil-box-outline" size={21} color={colors.grey2} />
            </Button>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
