import { Alert, Button, useColorScheme } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { t } from 'expo-app/lib/i18n';
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

      const handleDelete = () => {
        // TODO(e2e-web): replace one-off web confirm branches with a shared Alert-compatible web shim.
        if (Platform.OS === 'web') {
          const confirmed =
            globalThis.confirm?.(
              `${t('trips.deleteTrip')}\n\n${t('trips.deleteTripConfirmation')}`,
            ) ?? false;

          if (!confirmed) return;

          deleteTrip(id);
          if (router.canGoBack()) router.back();
          return;
        }

        deleteTrip(id);
        if (router.canGoBack()) router.back();
      };

      return (
        <View className="flex-row items-center gap-2">
          {Platform.OS === 'web' ? (
            <Button variant="plain" size="icon" onPress={handleDelete}>
              <Icon name="trash-can-outline" color={colors.grey2} />
            </Button>
          ) : (
            <Alert
              title={t('trips.deleteTrip')}
              message={t('trips.deleteTripConfirmation')}
              buttons={[
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.ok'), onPress: handleDelete },
              ]}
            >
              <Button variant="plain" size="icon">
                <Icon name="trash-can-outline" color={colors.grey2} />
              </Button>
            </Alert>
          )}

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
