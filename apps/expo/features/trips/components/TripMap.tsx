import Mapbox from '@rnmapbox/maps';
import { OUTDOORS_STYLE } from 'expo-app/features/offline-maps/lib/offlineMapManager';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { type Ref, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { Coords } from '../lib/places';

export type TripMapHandle = {
  /** Brings the trip's place back into view. */
  recentre: () => void;
  /** Moves the camera to a point, e.g. where the phone is. */
  focusOn: (coords: Coords) => void;
};

type TripMapProps = {
  location: Coords;
  /** Mapbox Outdoors, which draws from saved offline areas; Google Maps otherwise. */
  outdoors: boolean;
  /** Pan and pinch to zoom. A still map when false. */
  interactive?: boolean;
  /**
   * Full-screen use: rotation and a compass, with the map's own chrome kept clear of the controls
   * laid over it. `top` is where the compass sits on the left edge; `bottom` keeps the logo and
   * attribution above a bottom panel.
   */
  fullScreen?: { top: number; bottom: number };
  satellite?: boolean;
  showsUserLocation?: boolean;
  ref?: Ref<TripMapHandle>;
};

const PREVIEW_DELTA = 0.08;
const PREVIEW_ZOOM = 11;
const FOCUS_ZOOM = 13;

/** The trip's place on a map, shared by the trip page preview and the full-screen map. */
export function TripMap(props: TripMapProps) {
  return props.outdoors ? <OutdoorsTripMap {...props} /> : <GoogleTripMap {...props} />;
}

function GoogleTripMap({
  location,
  interactive = false,
  fullScreen,
  satellite = false,
  showsUserLocation = false,
  ref,
}: TripMapProps) {
  const mapRef = useRef<MapView>(null);
  const region = { ...location, latitudeDelta: PREVIEW_DELTA, longitudeDelta: PREVIEW_DELTA };

  useImperativeHandle(ref, () => ({
    recentre: () => mapRef.current?.animateToRegion(region, 500),
    focusOn: (coords) =>
      mapRef.current?.animateToRegion(
        { ...coords, latitudeDelta: 0.03, longitudeDelta: 0.03 },
        500,
      ),
  }));

  return (
    <View className="flex-1" pointerEvents={interactive ? 'auto' : 'none'}>
      <MapView
        // Remount when the place changes: initialRegion is only read on mount.
        key={`${location.latitude},${location.longitude}`}
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={region}
        mapType={satellite ? 'hybrid' : 'standard'}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={false}
        showsCompass={!!fullScreen}
        toolbarEnabled={false}
        liteMode={!interactive}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={!!fullScreen}
        pitchEnabled={!!fullScreen}
        // The compass draws at the top left of the padded area: below the close button.
        mapPadding={
          fullScreen
            ? { top: fullScreen.top, right: 0, bottom: fullScreen.bottom, left: 8 }
            : undefined
        }
      >
        <Marker coordinate={location} />
      </MapView>
    </View>
  );
}

function OutdoorsTripMap({
  location,
  interactive = false,
  fullScreen,
  satellite = false,
  showsUserLocation = false,
  ref,
}: TripMapProps) {
  const { colors } = useColorScheme();
  const cameraRef = useRef<Mapbox.Camera>(null);
  const center: [number, number] = [location.longitude, location.latitude];

  useImperativeHandle(ref, () => ({
    recentre: () =>
      cameraRef.current?.setCamera({
        centerCoordinate: center,
        zoomLevel: PREVIEW_ZOOM,
        heading: 0,
        animationDuration: 500,
      }),
    focusOn: (coords) =>
      cameraRef.current?.setCamera({
        centerCoordinate: [coords.longitude, coords.latitude],
        zoomLevel: FOCUS_ZOOM,
        animationDuration: 500,
      }),
  }));

  return (
    <View className="flex-1" pointerEvents={interactive ? 'auto' : 'none'}>
      <Mapbox.MapView
        style={{ flex: 1 }}
        styleURL={satellite ? Mapbox.StyleURL.SatelliteStreet : OUTDOORS_STYLE}
        scaleBarEnabled={false}
        compassEnabled={!!fullScreen}
        compassPosition={fullScreen ? { top: fullScreen.top, left: 16 } : undefined}
        logoPosition={{ bottom: (fullScreen?.bottom ?? 0) + 8, left: 8 }}
        attributionPosition={{ bottom: (fullScreen?.bottom ?? 0) + 8, right: 8 }}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={!!fullScreen}
        pitchEnabled={false}
        // Inside a scrolling page, so a drag on the map pans it instead of scrolling the page.
        requestDisallowInterceptTouchEvent={interactive}
      >
        <Mapbox.Camera
          key={center.join()}
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: center, zoomLevel: PREVIEW_ZOOM }}
        />
        {showsUserLocation ? <Mapbox.UserLocation /> : null}
        <Mapbox.ShapeSource
          id="trip-map-pin-source"
          shape={{
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: center },
          }}
        >
          <Mapbox.CircleLayer
            id="trip-map-pin"
            style={{
              circleRadius: 8,
              circleColor: colors.destructive,
              circleStrokeColor: '#FFFFFF',
              circleStrokeWidth: 3,
            }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>
    </View>
  );
}
