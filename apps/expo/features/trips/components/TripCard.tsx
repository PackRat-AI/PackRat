import { Pressable, Text, View } from 'react-native';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useActionSheet } from '@expo/react-native-action-sheet';
import { Alert, type AlertRef, Button } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useRef } from 'react';
import { useRouter } from 'expo-router';
import type { Trip } from '../types';
import { useDeleteTrip } from '../hooks/useDeleteTrip';

interface TripCardProps {
  trip: Trip;
  onPress?: (trip: Trip) => void;
}

export function TripCard({ trip, onPress }: TripCardProps) {
  const router = useRouter();
  const deleteTrip = useDeleteTrip();
  const { colors } = useColorScheme();
  const { showActionSheetWithOptions } = useActionSheet();
  const alertRef = useRef<AlertRef>(null);

  const handleActionsPress = () => {
    const options = ['View Details', 'Edit', 'Delete', 'Cancel'];
    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = options.indexOf('Delete');
    const editIndex = options.indexOf('Edit');

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
              title: 'Delete trip?',
              message: 'Are you sure you want to delete this trip? This action cannot be undone.',
              buttons: [
                { text: 'Cancel', style: 'cancel' },
                { text: 'OK', onPress: () => deleteTrip(trip.id) },
              ],
            });
            break;
        }
      }
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
                    ? trip.location.name
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
