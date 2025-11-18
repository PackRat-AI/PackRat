import { Alert, Button, useColorScheme } from '@packrat-ai/nativewindui';
import { Icon } from '@roninoss/icons';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { assertDefined } from 'expo-app/utils/typeAssertions';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useDeletePackTemplateItem, usePackTemplateItem } from '../hooks';
import { useWritePermissionCheck } from '../hooks/useWritePermissionCheck';

export function getPackTemplateItemDetailOptions(id: string) {
  return {
    title: 'Item Details',
    headerRight: () => {
      const { colors } = useColorScheme();
      const { t } = useTranslation();
      const router = useRouter();

      const item = usePackTemplateItem(id);
      assertDefined(item);
      const canWrite = useWritePermissionCheck(item.packTemplateId as string);

      const deleteItem = useDeletePackTemplateItem();

      if (!canWrite) return null;
      assertDefined(item);

      return (
        <View className="flex-row items-center gap-[.4]">
          <Alert
            title={t('packTemplates.deleteItem')}
            message={t('packTemplates.deleteItemMessage')}
            buttons={[
              {
                text: t('common.cancel'),
                style: 'cancel',
              },
              {
                text: t('common.ok'),
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
                pathname: '/templateItem/[id]/edit',
                params: { id: item.id, packTemplateId: item.packTemplateId },
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
