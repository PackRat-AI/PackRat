import { assertDefined } from '@packrat/guards';
import { ActivityIndicator, Button, Card, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { appAlert } from 'expo-app/app/_layout';
import { useLocations } from 'expo-app/features/weather/hooks';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Share, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDetailedPacks } from '../../packs/hooks/useDetailedPacks';
import { useTripDetailsFromStore } from '../hooks/useTripDetailsFromStore';
import type { Trip } from '../types';

export function TripDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { colors } = useColorScheme();
  const { t } = useTranslation();

  const { locationsState } = useLocations();

  const locations = locationsState.state === 'hasData' ? locationsState.data : [];

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

  const handleShareTrip = async () => {
    try {
      const lines: string[] = [`${trip.name}`];
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

  const handleWeatherPress = () => {
    if (!trip.location) return;

    const { latitude, longitude } = trip.location;

    const matchedLocation = locations.find(
      (loc) => Math.abs(loc.lat - latitude) < 0.05 && Math.abs(loc.lon - longitude) < 0.05,
    );

    if (matchedLocation) {
      router.push(`/weather/${matchedLocation.id}`);
    } else {
      appAlert.current?.alert({
        title: 'Location not found',
        message: 'Please add this location in Weather first.',
        buttons: [
          {
            text: 'Go to Weather',
            onPress: () => router.push('/weather'),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
      });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="p-4">
          {/* Header */}
          <View className="mb-3 flex-row items-start justify-between">
            <Text className="flex-1 text-3xl font-bold text-foreground">{trip.name}</Text>
            <Button variant="plain" size="icon" onPress={handleShareTrip}>
              <Icon
                materialIcon={{ type: 'MaterialIcons', name: 'share' }}
                ios={{ name: 'square.and.arrow.up' }}
                size={22}
                color={colors.grey2}
              />
            </Button>
          </View>

          {/* Dates */}
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
              <Text className="text-sm text-muted-foreground">{trip.description}</Text>
            ) : (
              <Text className="text-sm text-muted-foreground italic">
                {t('trips.noDetailsAvailable')}
              </Text>
            )}
          </View>

          {/* Location */}
          {trip.location && (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-foreground mb-2">
                {t('trips.location')}
              </Text>

              <Card className="rounded-xl bg-card border border-border">
                <View className="p-3 border-b border-border">
                  <Text className="text-center font-semibold">
                    {trip.location.name
                      ? trip.location.name.split(',')[0]
                      : `${trip.location.latitude.toFixed(3)}, ${trip.location.longitude.toFixed(3)}`}
                  </Text>
                </View>

                <View className="h-36">
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
                    <Marker coordinate={trip.location} />
                  </MapView>
                </View>

                <View className="p-3 flex-row justify-center gap-2">
                  {/* Open Maps */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      assertDefined(trip.location);
                      const { latitude, longitude } = trip.location;
                      router.push(`https://www.google.com/maps?q=${latitude},${longitude}`);
                    }}
                  >
                    <Text>{t('trips.openInMaps')}</Text>
                  </Button>

                  {/* Weather */}
                  <Button variant="secondary" size="sm" onPress={handleWeatherPress}>
                    <Text>{t('trips.viewWeather')}</Text>
                  </Button>
                </View>
              </Card>
            </View>
          )}

          {/* Pack */}
          {pack && (
            <View className="mb-6">
              <Text className="text-lg font-semibold mb-2">{t('trips.pack')}</Text>

              <Card>
                <View className="p-3">
                  <Text>{pack.name}</Text>
                  <Text>{t('trips.items', { count: pack.items.length })}</Text>
                </View>

                <View className="p-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => router.push(`/pack/${pack.id}`)}
                  >
                    <Text>{t('trips.viewPack')}</Text>
                  </Button>
                </View>
              </Card>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
