import { Pressable, Text, View } from 'react-native';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import type { Trip } from '../types';

interface TripCardProps {
  trip: Trip;
  onPress?: (trip: Trip) => void;
}

export function TripCard({ trip, onPress }: TripCardProps) {
  const { colors } = useColorScheme();

  return (
    <Pressable
      onPress={() => onPress?.(trip)}
      className="mb-4 overflow-hidden rounded-xl border p-4"
      style={{ borderColor: colors.border, backgroundColor: colors.card }}
    >
      <Text className="text-lg font-semibold text-foreground mb-1">{trip.name}</Text>

      {trip.location && (
        <Text className="text-sm text-muted-foreground mb-1">
          Location: {trip.location}
        </Text>
      )}

      {trip.startDate && trip.endDate && (
        <Text className="text-sm text-muted-foreground">
          {trip.startDate} - {trip.endDate}
        </Text>
      )}

      {trip.description && (
        <Text className="text-sm text-muted-foreground mt-2" numberOfLines={2}>
          {trip.description}
        </Text>
      )}
    </Pressable>
  );
}
