import { Alert, Button, useColorScheme, useSheetRef } from '@packrat-ai/nativewindui';
import { Icon } from '@roninoss/icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import AddPackTemplateItemActions from '../components/AddPackTemplateItemActions';
import { useDeletePackTemplate } from '../hooks';
import { useWritePermissionCheck } from '../hooks/useWritePermissionCheck';

export function getPackTemplateDetailOptions(id: string) {
  return {
    title: 'Pack Template Details',
    headerRight: () => {
      const { colors } = useColorScheme();
      const router = useRouter();
      const addPackTemplateItemActionsRef = useSheetRef();

      const deletePackTemplate = useDeletePackTemplate();

      const canWrite = useWritePermissionCheck(id as string);

      if (!canWrite) return null;

      return (
        <View className="flex-row items-center gap-2">
          <Alert
            title="Delete Pack Template?"
            message="This action cannot be undone."
            buttons={[
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'OK',
                onPress: () => {
                  deletePackTemplate(id);
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
            onPress={() => router.push({ pathname: '/pack-templates/[id]/edit', params: { id } })}
          >
            <Icon name="pencil-box-outline" color={colors.grey2} />
          </Button>
          <Button
            variant="plain"
            size="icon"
            onPress={() => addPackTemplateItemActionsRef.current?.present()}
          >
            <Icon name="plus" color={colors.grey2} />
          </Button>

          <AddPackTemplateItemActions ref={addPackTemplateItemActionsRef} packTemplateId={id} />
        </View>
      );
    },
  };
}
