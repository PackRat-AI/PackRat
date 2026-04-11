import { Alert, Button, useColorScheme } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { t } from 'expo-app/lib/i18n';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useDeleteTrip } from '../hooks';

export function getTripDetailOptions(id: string) {
  return {
    title: t('trips.tripDetails'),
    headerRight: () => {
      const { colors } = useColorScheme();
      const { t } = useTranslation();
      const router = useRouter();
      const deleteTrip = useDeleteTrip();

      return (
        <View className="flex-row items-center gap-2">
          <Alert
            title={t('trips.deleteTrip')}
            message={t('trips.deleteTripConfirmation')}
            buttons={[
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('common.ok'),
                onPress: () => {
                  deleteTrip(id);
                  if (router.canGoBack()) router.back();
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
            onPress={() => router.push({ pathname: '/trip/[id]/edit', params: { id } })}
          >
            <Icon name="pencil-box-outline" color={colors.grey2} />
          </Button>

          <Button
            variant="plain"
            size="icon"
            onPress={() => router.push({ pathname: '/trip/new', params: { copyFromTripId: id } })}
          >
            <Icon name="plus" color={colors.grey2} />
          </Button>
        </View>
      );
    },
  };
}
