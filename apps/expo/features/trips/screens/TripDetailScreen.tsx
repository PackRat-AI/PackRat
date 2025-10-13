import { BottomSheetView } from '@gorhom/bottom-sheet';
import {
  ActivityIndicator,
  Button,
  Sheet,
  Text,
  useSheetRef,
  Alert,
  Card,
} from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, ScrollView, View } from 'react-native';
import { useRef } from 'react';
import { useTripDetailsFromStore } from '../hooks/useTripDetailsFromStore';
import { useDeleteTrip } from '../hooks/useDeleteTrip';
import { useDetailedPacks } from '../../packs/hooks/useDetailedPacks';
import type { Trip } from '../types';
import MapView, { Marker } from 'react-native-maps';

export function TripDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { colors } = useColorScheme();
  const alertRef = useRef<Alert>(null);

  const trip = useTripDetailsFromStore(id as string) as Trip;
  const deleteTrip = useDeleteTrip();
  const packs = useDetailedPacks();

  if (!trip) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const pack = packs.find((p) => p.id === trip.packId);

  const handleDelete = () => {
    alertRef.current?.alert({
      title: 'Delete trip?',
      message:
        'Are you sure you want to delete this trip? This action cannot be undone.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          onPress: () => {
            deleteTrip(trip.id);
            router.back();
          },
        },
      ],
    });
  };

  const handleEdit = () => router.push({ pathname: `/trip/${trip.id}/edit` });

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toISOString().split('T')[0];
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header Section */}
        <View className="p-4">
          <Text className="text-3xl font-bold text-foreground mb-3">
            {trip.name}
          </Text>

          {/* Trip Dates */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-2">
              Dates
            </Text>
            <View className="rounded-xl bg-card border border-border">
              <View className="p-3 flex-row justify-between">
                <View>
                  <Text className="text-sm text-muted-foreground">Start Date</Text>
                  <Text className="text-base font-semibold text-foreground">
                    {formatDate(trip.startDate)}
                  </Text>
                </View>
                <View>
                  <Text className="text-sm text-muted-foreground">End Date</Text>
                  <Text className="text-base font-semibold text-foreground">
                    {formatDate(trip.endDate)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Details */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-2">
              Details
            </Text>
            {trip.description ? (
              <Text className="text-sm text-muted-foreground leading-relaxed">
                {trip.description}
              </Text>
            ) : (
              <Text className="text-sm text-muted-foreground italic">
                No details available.
              </Text>
            )}
          </View>

          {/* Location */}
          {trip.location ? (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-foreground mb-2">
                Location
              </Text>
              <Card className="rounded-xl bg-card border border-border">
                <View className="p-3 border-b border-border bg-card">
                  <Text className="text-base font-semibold text-foreground text-center">
                    {trip.location.name
                      ? trip.location.name.split(',')[0]
                      : `${trip.location.latitude.toFixed(3)}, ${trip.location.longitude.toFixed(3)}`}
                  </Text>
                </View>

                <View className="w-full h-36 overflow-hidden rounded-b-xl">
                  <MapView
                    style={{ flex: 1 }}
                    initialRegion={{
                      latitude: trip.location.latitude,
                      longitude: trip.location.longitude,
                      latitudeDelta: 0.05,
                      longitudeDelta: 0.05,
                    }}
                  >
                    <Marker
                      coordinate={{
                        latitude: trip.location.latitude,
                        longitude: trip.location.longitude,
                      }}
                      title={trip.location.name || 'Trip Location'}
                    />
                  </MapView>
                </View>

                <View className="p-3 flex-row justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      const { latitude, longitude } = trip.location!;
                      const url =  `https://www.google.com/maps?q=${latitude},${longitude}`;
                      router.push(url);
                    }}
                    className="flex-row items-center gap-2"
                  >
                    <Icon
                      name="map-marker-outline"
                      size={16}
                      color={colors.primary}
                    />
                    <Text className="text-sm">Open in Maps</Text>
                  </Button>
                </View>
              </Card>
            </View>
          ):null}

          {/* Notes */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-2">
              Notes
            </Text>
            {trip.notes ? (
              <Text className="text-sm text-muted-foreground leading-relaxed">
                {trip.notes}
              </Text>
            ) : (
              <Text className="text-sm text-muted-foreground italic">
                No notes available.
              </Text>
            )}
          </View>

          {/* Pack */}
          {pack ? (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-foreground mb-2">
                Pack
              </Text>
              <Card className="rounded-xl bg-card border border-border">
                <View className="p-3 border-b border-border bg-card">
                  <Text className="text-base font-semibold text-foreground text-center">
                    {pack.name}
                  </Text>
                </View>
                <View className="p-3">
                  <Text className="text-sm text-muted-foreground">
                    Items: {pack.items.length}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    Total Weight: {pack.totalWeight?.toFixed(2) ?? 0} kg
                  </Text>
                </View>
                <View className="p-3 flex-row justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => router.push(`/pack/${pack.id}`)}
                    className="flex-row items-center gap-2"
                  >
                    <Text className="text-sm">View Pack</Text>
                  </Button>
                </View>
              </Card>
            </View>
          ) : (
            <Text className="text-sm text-muted-foreground italic">
              No pack linked to this trip.
            </Text>
          )}

          {/* Action Buttons */}
          <View className="flex-row justify-between mt-8">
            <Button variant="secondary" onPress={handleEdit}>
              <Text>Edit</Text>
            </Button>
            <Button variant="destructive" onPress={handleDelete}>
              <Text>Delete</Text>
            </Button>
          </View>
        </View>
      </ScrollView>

      <Alert title="" buttons={[]} ref={alertRef} />
    </SafeAreaView>
  );
}
