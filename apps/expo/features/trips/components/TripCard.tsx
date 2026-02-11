import { useActionSheet } from '@expo/react-native-action-sheet';
import { Alert, type AlertRef, Button } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useDeleteTrip } from '../hooks/useDeleteTrip';
import type { Trip } from '../types';

interface TripCardProps {
  trip: Trip;
  onPress?: (trip: Trip) => void;
}

export function TripCard({ trip, onPress }: TripCardProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const deleteTrip = useDeleteTrip();
  const { colors } = useColorScheme();
  const { showActionSheetWithOptions } = useActionSheet();
  const alertRef = useRef<AlertRef>(null);

  const handleActionsPress = () => {
    const options = [
      t('trips.viewDetails'),
      t('common.edit'),
      t('common.delete'),
      t('common.cancel'),
    ];
    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = 2; // Delete option index
    const editIndex = 1; // Edit option index

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex,
        title: trip.name,
        message: trip.description || undefined,
        containerStyle: { backgroundColor: colors.card },
        textStyle: { color: colors.foreground },
        titleTextStyle: { color: colors.foreground, fontWeight: '600' },
        messageTextStyle: { color: colors.grey2 },
      },
      (selectedIndex) => {
        switch (selectedIndex) {
          case 0: // View Details
            onPress?.(trip);
            break;
          case editIndex: // Edit
            router.push({ pathname: '/trip/[id]/edit', params: { id: trip.id } });
            break;
          case destructiveButtonIndex: // Delete
            alertRef.current?.alert({
              title: t('trips.deleteTrip'),
              message: t('trips.deleteTripConfirmation'),
              buttons: [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.ok'), onPress: () => deleteTrip(trip.id) },
              ],
            });
            break;
        }
      },
    );
  };

  return (
    <Pressable
      className="mb-4 overflow-hidden rounded-xl bg-card border border-border"
      onPress={() => onPress?.(trip)}
    >
      <View className="p-4">
        {/* Header */}
        <View className="mb-2 flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground">{trip.name}</Text>

            {/* Location */}
            {trip.location && (
              <View className="flex-row items-center mt-1">
                <Icon name="map-marker-outline" size={14} color={colors.primary} />
                <Text className="ml-1 text-sm text-muted-foreground">
                  {trip.location.name
                    ? trip.location.name.split(',')[0]
                    : `${trip.location.latitude.toFixed(3)}, ${trip.location.longitude.toFixed(3)}`}
                </Text>
              </View>
            )}
          </View>

          {/* Actions Button */}
          <Button variant="plain" size="icon" onPress={handleActionsPress}>
            <Icon name="dots-horizontal" size={20} color={colors.grey2} />
          </Button>
        </View>

        {/* Description */}
        {trip.description && (
          <Text className="text-sm text-muted-foreground mt-2" numberOfLines={2}>
            {trip.description}
          </Text>
        )}

        {/* Alert */}
        <Alert title="" buttons={[]} ref={alertRef} />
      </View>
    </Pressable>
  );
}
