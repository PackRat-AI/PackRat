import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TripMap, type TripMapHandle } from '../components/TripMap';
import { useTripDetailsFromStore } from '../hooks/useTripDetailsFromStore';
import { currentCoords, openDirections, splitPlaceName } from '../lib/places';

/** The trip's place edge to edge, for exploring the area around it. */
export function TripMapScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTripDetailsFromStore(id);
  const enableOfflineMaps = useFeatureFlag('enableOfflineMaps');
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const mapRef = useRef<TripMapHandle>(null);
  const alertRef = useRef<AlertMethods>(null);
  const [satellite, setSatellite] = useState(false);
  const [showsUserLocation, setShowsUserLocation] = useState(false);

  const location = trip?.location;
  if (!location) return null;

  const { title, region } = location.name
    ? splitPlaceName(location.name)
    : { title: trip.name, region: undefined };

  const showMyLocation = async () => {
    const coords = await currentCoords();
    if (!coords) {
      alertRef.current?.alert({
        title: t('trips.map.locationOffTitle'),
        message: t('trips.map.locationOffMessage'),
        buttons: [{ text: t('common.ok') }],
      });
      return;
    }
    setShowsUserLocation(true);
    mapRef.current?.focusOn(coords);
  };

  return (
    <View className="flex-1 bg-background" testID={testIds.trips.fullMapScreen}>
      <TripMap
        ref={mapRef}
        location={location}
        outdoors={enableOfflineMaps}
        interactive
        satellite={satellite}
        showsUserLocation={showsUserLocation}
      />

      <View
        pointerEvents="box-none"
        className="absolute left-4 right-4 flex-row items-start justify-between"
        style={{ top: insets.top + 8 }}
      >
        <MapFab
          icon="close"
          label={t('common.close')}
          onPress={() => router.back()}
          testID={testIds.trips.fullMapClose}
        />
        <View className="gap-3">
          <MapFab
            icon={satellite ? 'map-outline' : 'satellite-variant'}
            label={satellite ? t('trips.map.showMap') : t('trips.map.showSatellite')}
            onPress={() => setSatellite((on) => !on)}
            testID={testIds.trips.fullMapStyle}
          />
          <MapFab
            icon="crosshairs-gps"
            label={t('trips.map.myLocation')}
            onPress={showMyLocation}
            testID={testIds.trips.fullMapMyLocation}
          />
          <MapFab
            icon="map-marker-radius-outline"
            label={t('trips.map.recentre')}
            onPress={() => mapRef.current?.recentre()}
            testID={testIds.trips.fullMapRecentre}
          />
        </View>
      </View>

      <View
        className="absolute left-4 right-4 flex-row items-center gap-3 rounded-3xl bg-card p-4"
        style={{ bottom: insets.bottom + 16, elevation: 6 }}
      >
        <View className="flex-1">
          <Text variant="heading" numberOfLines={1}>
            {title}
          </Text>
          {region ? (
            <Text variant="subhead" className="text-muted-foreground" numberOfLines={1}>
              {region}
            </Text>
          ) : null}
        </View>
        <Button
          icon="directions"
          onPress={() => openDirections(location)}
          testID={testIds.trips.fullMapDirections}
        >
          <Text>{t('trips.map.directions')}</Text>
        </Button>
      </View>

      <Alert title="" buttons={[]} ref={alertRef} />
    </View>
  );
}

/** A small MD3 floating action button laid over the map. */
function MapFab({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const { colors } = useColorScheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      android_ripple={{ color: colors.grey4, borderless: false }}
      className="h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-card"
      style={{ elevation: 4 }}
    >
      <Icon name={icon} size={24} color={colors.foreground} />
    </Pressable>
  );
}
