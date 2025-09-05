import { Alert, Button, useColorScheme } from '@packrat-ai/nativewindui';
import { Icon } from '@roninoss/icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useDeletePack, usePackOwnershipCheck } from '../hooks';

export function getPackDetailOptions(id: string) {
  return {
    title: 'Pack Details',
    headerRight: () => {
      const { colors } = useColorScheme();
      const router = useRouter();
      const deletePack = useDeletePack();

      const isOwner = usePackOwnershipCheck(id as string);

      if (!isOwner) return null;

      return (
        <View className="flex-row items-center gap-2">
          <Alert
            title="Delete pack?"
            message="Are you sure you want to delete this pack? This action cannot be undone."
            buttons={[
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'OK',
                onPress: () => {
                  deletePack(id);
                  if (router.canGoBack()) {
                    router.back();
                  }
                },
              },
            ]}
          >
            <Button variant="plain" size="icon">
              <Icon name="trash-can-outline" color={colors.grey2} />
            </Button>
          </Alert>
          <Button
            variant="plain"
            size="icon"
            onPress={() => router.push({ pathname: '/pack/[id]/edit', params: { id } })}
          >
            <Icon name="pencil-box-outline" color={colors.grey2} />
          </Button>
          <Button
            variant="plain"
            size="icon"
            onPress={() => router.push({ pathname: '/item/new', params: { packId: id } })}
          >
            <Icon name="plus" color={colors.grey2} />
          </Button>
        </View>
      );
    },
  };
}
