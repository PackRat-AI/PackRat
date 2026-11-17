import Mapbox from '@rnmapbox/maps';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { View } from 'react-native';
import { OUTDOORS_STYLE } from '../lib/offlineMapManager';
import type { LonLat } from '../types';
import { boundsEnclosing } from '../utils/offlineArea';
import { cameraBounds, TrailLines } from './MapLayers';

/**
 * A small, still Mapbox Outdoors map for a trip or trail page. It draws from saved areas when the
 * phone is offline, which the Google map it replaces cannot.
 */
export function OutdoorsMap({
  id,
  lines = [],
  pin,
}: {
  id: string;
  lines?: LonLat[][];
  /** A destination to mark and centre on when there is no line. */
  pin?: LonLat;
}) {
  const { colors } = useColorScheme();
  const lineBounds = boundsEnclosing(lines);
  return (
    <View className="flex-1" pointerEvents="none">
      <Mapbox.MapView style={{ flex: 1 }} styleURL={OUTDOORS_STYLE} scaleBarEnabled={false}>
        <Mapbox.Camera
          key={lineBounds ? 'line' : 'pin'}
          defaultSettings={
            lineBounds
              ? { bounds: cameraBounds(lineBounds, 24) }
              : { centerCoordinate: pin, zoomLevel: 11 }
          }
          maxZoomLevel={15}
        />
        <TrailLines id={id} lines={lines} />
        {pin ? (
          <Mapbox.ShapeSource
            id={`${id}-pin-source`}
            shape={{
              type: 'Feature',
              properties: {},
              geometry: { type: 'Point', coordinates: pin },
            }}
          >
            <Mapbox.CircleLayer
              id={`${id}-pin`}
              style={{
                circleRadius: 7,
                circleColor: colors.destructive,
                circleStrokeColor: '#FFFFFF',
                circleStrokeWidth: 2,
              }}
            />
          </Mapbox.ShapeSource>
        ) : null}
      </Mapbox.MapView>
    </View>
  );
}
