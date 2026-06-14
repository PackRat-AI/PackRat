import { Button, useSheetRef } from '@packrat/ui/nativewindui';
import { appAlert } from 'expo-app/app/_layout';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { t } from 'expo-app/lib/i18n';
import { testIds } from 'expo-app/lib/testIds';
import { useRouter } from 'expo-router';
import { Platform, View } from 'react-native';
import AddPackItemActions from '../components/AddPackItemActions';
import { useDeletePack, usePackOwnershipCheck } from '../hooks';

export function getPackDetailOptions(id: string) {
  return {
    title: t('packs.packDetails'),
    headerRight: () => {
      const router = useRouter();
      const addItemActionsRef = useSheetRef();
      const { colors } = useColorScheme();

      const deletePack = useDeletePack();

      const isOwner = usePackOwnershipCheck(id as string);

      if (!isOwner) return null;

      const confirmDelete = () => {
        const deleteAndNavigate = () => {
          deletePack(id);
          if (router.canGoBack()) {
            router.back();
          }
        };

        if (Platform.OS === 'web') {
          if (globalThis.confirm(t('packs.deletePackConfirm'))) {
            deleteAndNavigate();
          }
          return;
        }

        appAlert.current?.alert({
          title: t('packs.deletePack'),
          message: t('packs.deletePackConfirm'),
          buttons: [
            {
              text: t('common.cancel'),
              style: 'cancel',
            },
            {
              text: t('common.delete'),
              style: 'destructive',
              onPress: deleteAndNavigate,
            },
          ],
        });
      };

      return (
        <View className="flex-row items-center gap-2">
          <Button
            testID={testIds.packs.deleteBtn}
            variant="plain"
            size="icon"
            onPress={confirmDelete}
          >
            <Icon name="trash-can-outline" color={colors.grey2} />
          </Button>
          <Button
            testID={testIds.packs.editBtn}
            variant="plain"
            size="icon"
            onPress={() => router.push({ pathname: '/pack/[id]/edit', params: { id } })}
          >
            <Icon name="pencil-box-outline" color={colors.grey2} />
          </Button>
          <Button variant="plain" size="icon" onPress={() => addItemActionsRef.current?.present()}>
            <Icon name="plus" color={colors.grey2} />
          </Button>
          <AddPackItemActions ref={addItemActionsRef} packId={id} />
        </View>
      );
    },
  };
}
