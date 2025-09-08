import { useActionSheet } from '@expo/react-native-action-sheet';
import { Alert, type AlertRef, Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { WeightBadge } from 'expo-app/components/initial/WeightBadge';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { assertDefined } from 'expo-app/utils/typeAssertions';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import {
  useDeletePackItem,
  usePackItemDetailsFromStore,
  usePackItemOwnershipCheck,
} from '../hooks';
import type { PackItem } from '../types';
import { PackItemImage } from './PackItemImage';

type PackItemCardProps = {
  item: PackItem;
  onPress?: (item: PackItem) => void;
  isGenUI?: boolean; // Used to tweak styling & layout when card is being used in a generative UI context.
};

export function PackItemCard({ item: itemArg, onPress, isGenUI = false }: PackItemCardProps) {
  const router = useRouter();
  const { showActionSheetWithOptions } = useActionSheet();
  const alertRef = useRef<AlertRef>(null);
  const isOwnedByUser = usePackItemOwnershipCheck(itemArg.id);
  const itemFromStore = usePackItemDetailsFromStore(itemArg.id); // Use item from store if it's user owned so that component observe changes to it and thus update properly.
  const item = isOwnedByUser ? itemFromStore : itemArg; // Use passed item if it's not owned by the current user.
  assertDefined(item);

  const deleteItem = useDeletePackItem();
  const { colors } = useColorScheme();

  const handleActionsPress = () => {
    const options =
      isOwnedByUser && !isGenUI
        ? ['View Details', 'Edit', 'Delete', 'Cancel']
        : ['View Details', 'Cancel'];

    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = options.indexOf('Delete');
    const viewDetailsIndex = 0;
    const editIndex = options.indexOf('Edit');

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex,
        title: item.name,
        message: item.description,
        containerStyle: {
          backgroundColor: colors.card,
        },
        textStyle: {
          color: colors.foreground,
        },
        titleTextStyle: {
          color: colors.foreground,
          fontWeight: '600',
        },
        messageTextStyle: {
          color: colors.grey2,
        },
      },
      (selectedIndex) => {
        switch (selectedIndex) {
          case viewDetailsIndex:
            onPress?.(item);
            break;
          case editIndex:
            router.push({
              pathname: '/item/[id]/edit',
              params: { id: item.id, packId: item.packId },
            });
            break;
          case destructiveButtonIndex:
            alertRef.current?.alert({
              title: 'Delete item?',
              message: 'Are you sure you want to delete this item?',
              buttons: [
                { text: 'Cancel', style: 'cancel' },
                { text: 'OK', onPress: () => deleteItem(item.id) },
              ],
            });
            break;
        }
      },
    );
  };

  return (
    <Pressable
      className="mb-3 flex-row overflow-hidden rounded-lg bg-card shadow-sm"
      onPress={() => onPress?.(item)}
    >
      <View className="flex-1 p-2">
        <View className="flex-row items-start justify-between gap-2 mb-2">
          <PackItemImage
            item={item}
            className="w-32 h-20 rounded-lg border border-neutral-200 dark:border-neutral-700"
            resizeMode="cover"
          />
          <View className="flex-1 py-1">
            <Text
              className="text-foreground tracking-tight leading-6"
              variant="title3"
              numberOfLines={2}
            >
              {item.name}
            </Text>
            <Text variant="footnote" className="text-muted-foreground">
              {item.category}
            </Text>
          </View>
        </View>

        <View className="flex-row pl-1 items-start justify-between">
          <View className="mt-2 flex-row items-center gap-2">
            <WeightBadge
              weight={item.weight * item.quantity}
              unit={item.weightUnit}
              textClassName="font-normal"
              containerClassName="py-0.5"
            />

            <View className="rounded-full bg-muted dark:bg-neutral-700 px-2 py-0.5">
              <Text className="text-xs dark:text-neutral-200">Qty: {item.quantity}</Text>
            </View>

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
          <Button variant="plain" size="icon" onPress={handleActionsPress}>
            <Icon name="dots-horizontal" size={20} color={colors.grey2} />
          </Button>
        </View>
        <Alert title="" buttons={[]} ref={alertRef} />
      </View>
    </Pressable>
  );
}
