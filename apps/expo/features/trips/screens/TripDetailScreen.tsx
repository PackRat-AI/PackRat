import { BottomSheetView } from '@gorhom/bottom-sheet';
import { ActivityIndicator, Button, Sheet, Text, useSheetRef, Alert, Card } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, ScrollView, View } from 'react-native';
import { useRef } from 'react';
import { useTripDetailsFromStore } from '../hooks/useTripDetailsFromStore';
import { useDeleteTrip } from '../hooks/useDeleteTrip';
import type { Trip } from '../types';

export function TripDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { colors } = useColorScheme();
  const alertRef = useRef<Alert>(null);

  const trip = useTripDetailsFromStore(id as string) as Trip;
  const deleteTrip = useDeleteTrip();

  if (!trip) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const handleDelete = () => {
    alertRef.current?.alert({
      title: 'Delete trip?',
      message: 'Are you sure you want to delete this trip? This action cannot be undone.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK', onPress: () => { deleteTrip(trip.id); router.back(); } },
      ],
    });
  };

  const handleEdit = () => router.push({ pathname: `/trip/${trip.id}/edit` });

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header Section */}
        <View className="p-4">
          <Text className="text-3xl font-bold text-foreground mb-3">{trip.name}</Text>

          {/* Details */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-2">Details</Text>
            {trip.description ? (
              <Text className="text-sm text-muted-foreground leading-relaxed">
                {trip.description}
              </Text>
            ) : (
              <Text className="text-sm text-muted-foreground italic">No details available.</Text>
            )}
          </View>

          {/* Location */}
          {trip.location && (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-foreground mb-2">Location</Text>
              <Card className="rounded-xl bg-card border border-border">
                <View className="p-3 border-b border-border bg-card">
                  <Text className="text-base font-semibold text-foreground text-center">
                    {trip.location}
                  </Text>
                </View>
                {/* Placeholder Map */}
                <View className="w-full h-36 bg-muted items-center justify-center">
                  <Icon name="map-outline" size={48} color={colors.grey2} />
                  <Text className="text-muted-foreground mt-2 text-xs">Map Preview Coming Soon</Text>
                </View>
                <View className="p-3 flex-row justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => console.log(`Open ${trip.location} in Maps`)}
                    className="flex-row items-center gap-2"
                  >
                    <Icon name="map-marker-outline" size={16} color={colors.primary} />
                    <Text className="text-sm">Open in Maps</Text>
                  </Button>
                </View>
              </Card>
            </View>
          )}

          {/* Notes */}
          <View>
            <Text className="text-lg font-semibold text-foreground mb-2">Notes</Text>
            {trip.notes ? (
              <Text className="text-sm text-muted-foreground leading-relaxed">
                {trip.notes}
              </Text>
            ) : (
              <Text className="text-sm text-muted-foreground italic">No notes available.</Text>
            )}
          </View>

          
        </View>
      </ScrollView>

      <Alert title="" buttons={[]} ref={alertRef} />
    </SafeAreaView>
  );
}
