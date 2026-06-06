import { Button, useColorScheme } from '@packrat/ui/nativewindui';
import { appAlert } from 'expo-app/app/_layout';
import { Icon } from 'expo-app/components/Icon';
import { useTripDetailsFromStore } from 'expo-app/features/trips/hooks/useTripDetailsFromStore';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { t } from 'expo-app/lib/i18n';
import { testIds } from 'expo-app/lib/testIds';
import { useRouter } from 'expo-router';
import { Platform, Share, View } from 'react-native';
import { useDeleteTrip } from '../hooks';

export function getTripDetailOptions(id: string) {
  return {
    title: t('trips.tripDetails'),
    headerRight: () => {
      const { colors } = useColorScheme();
      const { t } = useTranslation();
      const router = useRouter();
      const deleteTrip = useDeleteTrip();
      const trip = useTripDetailsFromStore(id);

      const handleShare = async () => {
        if (!trip) return;
        try {
          const formatDate = (d?: string) => (d ? new Date(d).toISOString().split('T')[0] : '—');
          const lines: string[] = [trip.name];
          if (trip.location?.name) lines.push(` ${trip.location.name.split(',')[0]}`);
          if (trip.startDate || trip.endDate) {
            lines.push(`${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}`);
          }
          if (trip.description) lines.push(`\n${trip.description}`);
          await Share.share({ message: lines.join('\n') });
        } catch {
          // ignore
        }
      };

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
          <Button variant="plain" size="icon" onPress={handleShare}>
            <Icon
              materialIcon={{ type: 'MaterialIcons', name: 'share' }}
              ios={{ name: 'square.and.arrow.up' }}
              color={colors.grey2}
            />
          </Button>

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
