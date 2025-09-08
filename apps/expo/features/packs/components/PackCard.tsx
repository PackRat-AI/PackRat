import { useActionSheet } from '@expo/react-native-action-sheet';
import { Alert, type AlertRef, Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { WeightBadge } from 'expo-app/components/initial/WeightBadge';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { router } from 'expo-router';
import { isArray } from 'radash';
import { useRef } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useDeletePack, usePackDetailsFromStore } from '../hooks';
import { usePackOwnershipCheck } from '../hooks/usePackOwnershipCheck';
import type { Pack, PackInStore } from '../types';

type PackCardProps = {
  pack: Pack | PackInStore;
  onPress?: (pack: Pack) => void;
  isGenUI?: boolean; // Used to tweak styling & layout when card is being used in a generative UI context.
};

export function PackCard({ pack: packArg, onPress, isGenUI = false }: PackCardProps) {
  const deletePack = useDeletePack();
  const { colors } = useColorScheme();
  const { showActionSheetWithOptions } = useActionSheet();
  const alertRef = useRef<AlertRef>(null);
  const isOwnedByUser = usePackOwnershipCheck(packArg.id);
  const packFromStore = usePackDetailsFromStore(packArg.id); // Use pack from store if it's owned by the current user so that component observe changes to it and thus update properly.
  const pack = (isOwnedByUser ? packFromStore : packArg) as Pack; // Use passed pack for non user owned pack.

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
        title: pack.name,
        message: pack.description,
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
            onPress?.(pack);
            break;
          case editIndex:
            router.push({ pathname: '/pack/[id]/edit', params: { id: pack.id } });
            break;
          case destructiveButtonIndex:
            alertRef.current?.alert({
              title: 'Delete pack?',
              message: 'Are you sure you want to delete this pack? This action cannot be undone.',
              buttons: [
                { text: 'Cancel', style: 'cancel' },
                { text: 'OK', onPress: () => deletePack(pack.id) },
              ],
            });
            break;
        }
      },
    );
  };

  return (
    <Pressable
      className="mb-4 overflow-hidden rounded-xl bg-card shadow-sm"
      onPress={() => onPress?.(pack)}
    >
      {pack.image && (
        <Image source={{ uri: pack.image }} className="h-40 w-full" resizeMode="cover" />
      )}
      <View className="p-4">
        <View className="mb-2 flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground">{pack.name}</Text>
            {pack.category && <Text variant="footnote">{pack.category}</Text>}
          </View>
          <Button variant="plain" size="icon" onPress={handleActionsPress}>
            <Icon name="dots-horizontal" size={20} color={colors.grey2} />
          </Button>
        </View>

        {pack.description && (
          <Text className="text-sm text-muted-foreground" numberOfLines={2}>
            {pack.description}
          </Text>
        )}

        <View className="mt-3 flex-row items-center justify-between">
          <View className="flex-row gap-2">
            <WeightBadge weight={pack.baseWeight ?? 0} unit="g" type="base" />
            <WeightBadge weight={pack.totalWeight ?? 0} unit="g" type="total" />
          </View>
          <Text className="text-xs text-foreground">
            {pack.items && isArray(pack.items) && pack.items.length > 0
              ? `${pack.items.length} item${pack.items.length > 1 ? 's' : ''}`
              : '0 items'}
          </Text>
        </View>

        <View className="flex-row items-baseline justify-between">
          {pack.tags && isArray(pack.tags) && pack.tags.length > 0 ? (
            <View className="mt-3 flex-row flex-wrap">
              {pack.tags.map((tag) => (
                <View
                  key={tag}
                  className="mb-1 mr-2 rounded-full bg-neutral-200 dark:bg-neutral-700 px-2 py-1"
                >
                  <Text className="text-xs text-foreground">#{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Alert title="" buttons={[]} ref={alertRef} />
        </View>
      </View>
    </Pressable>
  );
}
