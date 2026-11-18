import { use$ } from '@legendapp/state/react';
import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import Mapbox from '@rnmapbox/maps';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { obs } from 'expo-app/lib/store';
import { testIds } from 'expo-app/lib/testIds';
import * as Location from 'expo-location';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { AreaOutline, cameraBounds, TrailLines } from '../components/MapLayers';
import { OUTDOORS_STYLE } from '../lib/offlineMapManager';
import { offlineMapsStore } from '../store/offlineMaps';
import { DETAIL_MAX_ZOOM } from '../utils/offlineArea';

/**
 * A saved area full screen, with the user's location and, for an area saved from a trail, the
 * trail's line. Draws from the saved tiles, so it works without signal.
 */
export function OfflineAreaMapScreen() {
  const { areaId } = useLocalSearchParams<{ areaId: string }>();
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const area = use$(obs({ store: offlineMapsStore.areas, id: areaId }));
  const [following, setFollowing] = useState(false);
  const alertRef = useRef<AlertMethods>(null);

  if (!area) return <Redirect href="/offline-maps" />;
  const maxZoom = DETAIL_MAX_ZOOM[area.detail];

  const toggleFollowing = async () => {
    if (following) {
      setFollowing(false);
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === Location.PermissionStatus.GRANTED) {
      setFollowing(true);
      return;
    }
    alertRef.current?.alert({
      title: t('offlineMaps.locationOffTitle'),
      message: t('offlineMaps.locationOffMessage'),
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('permissions.openSettings'), onPress: () => void Linking.openSettings() },
      ],
    });
  };

  return (
    <View className="flex-1" testID={testIds.offlineMaps.fullMap}>
      <Stack.Screen
        options={{
          title: area.name,
          headerRight: () => (
            <Pressable
              onPress={() => void toggleFollowing()}
              hitSlop={8}
              className="p-2"
              accessibilityRole="button"
              accessibilityLabel={
                following ? t('offlineMaps.showWholeArea') : t('offlineMaps.showMyLocation')
              }
              testID={testIds.offlineMaps.locate}
            >
              <Icon
                name={following ? 'map-outline' : 'crosshairs-gps'}
                size={24}
                color={colors.foreground}
              />
            </Pressable>
          ),
        }}
      />
      <Mapbox.MapView style={{ flex: 1 }} styleURL={OUTDOORS_STYLE} scaleBarEnabled={false}>
        <Mapbox.Camera
          // Remounting snaps back to the whole area when the user stops following.
          key={following ? 'follow' : 'area'}
          defaultSettings={{ bounds: cameraBounds(area.bounds, 16) }}
          followUserLocation={following}
          followZoomLevel={14}
          maxZoomLevel={maxZoom + 2}
        />
        <Mapbox.LocationPuck puckBearingEnabled puckBearing="heading" />
        <AreaOutline bounds={area.bounds} />
        <TrailLines id="area-trail" lines={area.trailLines ?? []} />
      </Mapbox.MapView>
      <Alert title="" buttons={[]} ref={alertRef} />
    </View>
  );
}
