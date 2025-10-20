import { useActionSheet } from '@expo/react-native-action-sheet';
import { Alert, type AlertRef, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { assertDefined } from 'expo-app/utils/typeAssertions';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Pressable, TouchableWithoutFeedback, View } from 'react-native';
import {
  useDeletePackItem,
  usePackItemDetailsFromStore,
  usePackItemOwnershipCheck,
} from '../hooks';
import type { PackItem } from '../types';
import { PackItemImage } from './PackItemImage';

type Base = {
  item: PackItem;
  onPress?: (item: PackItem) => void;
  isGenUI?: boolean; // Used to tweak styling & layout when card is being used in a generative UI context.
};

type PackItemCardProps =
  | Base
  | (Base & {
      onSelect: (item: PackItem) => void;
      selected: boolean;
      dimOnSelect?: boolean;
    });

export function PackItemCard({
  item: itemArg,
  onPress,
  isGenUI = false,
  ...restProps
}: PackItemCardProps) {
  const router = useRouter();
  const { showActionSheetWithOptions } = useActionSheet();
  const alertRef = useRef<AlertRef>(null);
  const isOwnedByUser = usePackItemOwnershipCheck(itemArg.id);
  const itemFromStore = usePackItemDetailsFromStore(itemArg.id); // Use item from store if it's user owned so that component observe changes to it and thus update properly.
  const item = isOwnedByUser ? itemFromStore : itemArg; // Use passed item if it's not owned by the current user.
  assertDefined(item);

  const deleteItem = useDeletePackItem();
  const { colors } = useColorScheme();

  const isSelectable = 'onSelect' in restProps;

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
    <>
      <TouchableWithoutFeedback
        key={item.id}
        onPress={() => (isSelectable ? restProps.onSelect(item) : onPress?.(item))}
      >
        <View
          className={`mb-4 rounded-lg flex-row gap-3 border p-4 ${
            isSelectable && restProps.selected
              ? cn(
                  'border-primary bg-primary/5',
                  restProps.dimOnSelect && 'border-neutral-300 opacity-50',
                )
              : 'border-border bg-card'
          }`}
        >
          {/* Image */}
          <PackItemImage item={item} className="h-16 w-16 rounded-md" resizeMode="cover" />

          {/* Content */}
          <View className="flex-1">
            <View className="flex-row gap-2 justify-between items-start">
              <Text className="flex-1 font-medium text-foreground" numberOfLines={2}>
                {item.name}
              </Text>
              {!isSelectable && (
                <Pressable onPress={handleActionsPress}>
                  <Icon name="dots-horizontal" size={20} color={colors.grey2} />
                </Pressable>
              )}
            </View>
            <Text className="text-sm text-muted-foreground mb-2">{item.category}</Text>

            <View className="flex-row items-center gap-4 flex-wrap">
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
            <View className="mt-2 flex-row items-center gap-4 flex-wrap">
              <Text className="text-sm font-medium text-foreground">
                {item.weight}
                {item.weightUnit}
              </Text>

              <Text className="text-sm text-muted-foreground">{item.quantity} qty</Text>
            </View>
          </View>

          {/* Selection indicator */}
          {isSelectable && (
            <View className="items-center justify-center">
              {restProps.selected ? (
                <Icon
                  name="check-circle"
                  size={24}
                  color={restProps.dimOnSelect ? colors.grey2 : colors.primary}
                />
              ) : (
                <Icon name="circle-outline" size={24} color={colors.grey2} />
              )}
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>
      <Alert title="" buttons={[]} ref={alertRef} />
    </>
  );
}
