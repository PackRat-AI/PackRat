import { Alert, Button, useColorScheme } from '@packrat-ai/nativewindui';
import { Icon } from '@roninoss/icons';
import { assertDefined } from 'expo-app/utils/typeAssertions';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import {
  useDeletePackItem,
  usePackItemDetailsFromStore,
  usePackItemOwnershipCheck,
} from '../hooks';

export function getPackItemDetailOptions({ route }: { route: { params?: { id?: string } } }) {
  return {
    title: 'Item Details',
    headerRight: () => {
      const { colors } = useColorScheme();
      const router = useRouter();
      const id = route.params?.id as string;

      const isOwner = usePackItemOwnershipCheck(id);
      const item = usePackItemDetailsFromStore(id);

      const deleteItem = useDeletePackItem();

      if (!isOwner) return null;
      assertDefined(item);

      return (
        <View className="flex-row items-center gap-[.4]">
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
                  router.back();
                },
              },
            ]}
          >
            <Button variant="plain" size="icon">
              <Icon name="trash-can" color={colors.grey2} />
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
            <Icon name="pencil-box-outline" color={colors.grey2} />
          </Button>
        </View>
      );
    },
  };
}
