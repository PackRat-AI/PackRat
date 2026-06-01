import { Button, useColorScheme } from '@packrat/ui/nativewindui';
import { appAlert } from 'expo-app/app/_layout';
import { Icon } from 'expo-app/components/Icon';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { t } from 'expo-app/lib/i18n';
import { testIds } from 'expo-app/lib/testIds';
import { useRouter } from 'expo-router';
import { Platform, View } from 'react-native';
import { useDeleteTrip } from '../hooks';

export function getTripDetailOptions(id: string) {
  return {
    title: t('trips.tripDetails'),
    headerRight: () => {
      const { colors } = useColorScheme();
      const { t } = useTranslation();
      const router = useRouter();
      const deleteTrip = useDeleteTrip();

      const deleteAndNavigate = () => {
        deleteTrip(id);
        if (router.canGoBack()) router.back();
      };

      const confirmDelete = () => {
        if (Platform.OS === 'web') {
          if (globalThis.confirm(t('trips.deleteTripConfirmation'))) {
            deleteAndNavigate();
          }
          return;
        }

        appAlert.current?.alert({
          title: t('trips.deleteTrip'),
          message: t('trips.deleteTripConfirmation'),
          buttons: [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('common.delete'),
              style: 'destructive',
              testID: testIds.trips.deleteConfirmBtn,
              onPress: deleteAndNavigate,
            },
          ],
        });
      };

      return (
        <View className="flex-row items-center gap-2">
          <Button
            testID={testIds.trips.deleteBtn}
            variant="plain"
            size="icon"
            onPress={confirmDelete}
          >
            <Icon name="trash-can-outline" color={colors.grey2} />
          </Button>

          <Button
            testID={testIds.trips.editBtn}
            variant="plain"
            size="icon"
            onPress={() => router.push({ pathname: '/trip/[id]/edit', params: { id } })}
          >
            <Icon name="pencil-box-outline" color={colors.grey2} />
          </Button>

          <Button
            variant="plain"
            size="icon"
            onPress={() =>
              router.push({
                pathname: '/trip/new',
                params: { copyFromTripId: id },
              })
            }
          >
            <Icon name="plus" color={colors.grey2} />
          </Button>
        </View>
      );
    },
  };
}
