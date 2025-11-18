import {
  ActivityIndicator,
  Alert,
  type AlertRef,
  Button,
  Card,
  Text,
} from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { assertDefined } from 'expo-app/utils/typeAssertions';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { SafeAreaView, ScrollView, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useDetailedPacks } from '../../packs/hooks/useDetailedPacks';
import { useTripDetailsFromStore } from '../hooks/useTripDetailsFromStore';
import type { Trip } from '../types';

export function TripDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const alertRef = useRef<AlertRef>(null);

  const trip = useTripDetailsFromStore(id as string) as Trip;
  const packs = useDetailedPacks();

  if (!trip) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const pack = packs.find((p) => p.id === trip.packId);

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
          <Text className="text-3xl font-bold text-foreground mb-3">{trip.name}</Text>

          {/* Trip Dates */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-2">{t('trips.dates')}</Text>
            <View className="rounded-xl bg-card border border-border">
              <View className="p-3 flex-row justify-between">
                <View>
                  <Text className="text-sm text-muted-foreground">{t('trips.startDate')}</Text>
                  <Text className="text-base font-semibold text-foreground">
                    {formatDate(trip.startDate)}
                  </Text>
                </View>
                <View>
                  <Text className="text-sm text-muted-foreground">{t('trips.endDate')}</Text>
                  <Text className="text-base font-semibold text-foreground">
                    {formatDate(trip.endDate)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Details */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-2">{t('trips.details')}</Text>
            {trip.description ? (
              <Text className="text-sm text-muted-foreground leading-relaxed">
                {trip.description}
              </Text>
            ) : (
              <Text className="text-sm text-muted-foreground italic">
                {t('trips.noDetailsAvailable')}
              </Text>
            )}
          </View>

          {/* Location */}
          {trip.location ? (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-foreground mb-2">
                {t('trips.location')}
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
                    provider={PROVIDER_GOOGLE}
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
                      title={trip.location.name || t('trips.tripLocation')}
                    />
                  </MapView>
                </View>

                <View className="p-3 flex-row justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      assertDefined(trip.location);
                      const { latitude, longitude } = trip.location;
                      const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
                      router.push(url);
                    }}
                    className="flex-row items-center gap-2"
                  >
                    <Icon name="map-marker-outline" size={16} color={colors.primary} />
                    <Text className="text-sm">{t('trips.openInMaps')}</Text>
                  </Button>
                </View>
              </Card>
            </View>
          ) : null}

          {/* Notes */}
          {/* <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-2">Notes</Text>
            {trip.notes ? (
              <Text className="text-sm text-muted-foreground leading-relaxed">{trip.notes}</Text>
            ) : (
              <Text className="text-sm text-muted-foreground italic">No notes available.</Text>
            )}
          </View> */}

          {/* Pack */}
          {pack ? (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-foreground mb-2">{t('trips.pack')}</Text>
              <Card className="rounded-xl bg-card border border-border">
                <View className="p-3 border-b border-border bg-card">
                  <Text className="text-base font-semibold text-foreground text-center">
                    {pack.name}
                  </Text>
                </View>
                <View className="p-3">
                  <Text className="text-sm text-muted-foreground">
                    {t('trips.items', { count: pack.items.length })}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {t('trips.totalWeight', { weight: pack.totalWeight?.toFixed(2) ?? 0 })}
                  </Text>
                </View>
                <View className="p-3 flex-row justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => router.push(`/pack/${pack.id}`)}
                    className="flex-row items-center gap-2"
                  >
                    <Text className="text-sm">{t('trips.viewPack')}</Text>
                  </Button>
                </View>
              </Card>
            </View>
          ) : (
            <Text className="text-sm text-muted-foreground italic">
              {t('trips.noPackLinked')}
            </Text>
          )}
        </View>
      </ScrollView>

      <Alert title="" buttons={[]} ref={alertRef} />
    </SafeAreaView>
  );
}
