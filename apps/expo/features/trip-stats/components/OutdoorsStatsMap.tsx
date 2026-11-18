import Mapbox from '@rnmapbox/maps';
import { OUTDOORS_STYLE } from 'expo-app/features/offline-maps/lib/offlineMapManager';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import type { Coordinate } from '../utils/polyline';

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type StatsMapLine = { coordinates: readonly Coordinate[]; color: string; width: number };

const lonLat = (point: Coordinate): [number, number] => [point.longitude, point.latitude];

/**
 * A Trip Stats map on Mapbox Outdoors, so it draws from saved offline maps without signal: lines,
 * filled outlines and trip pins, framed on `region` like the Google map it stands in for. Used when
 * offline maps are on; the screens keep their Google map otherwise.
 */
export function OutdoorsStatsMap({
  id,
  region,
  lines = [],
  outlines = [],
  pins = [],
  zoomEnabled = true,
}: {
  id: string;
  region: Region;
  /** Drawn in order, so later lines sit on top. */
  lines?: StatsMapLine[];
  /** Filled in the primary colour. */
  outlines?: readonly (readonly Coordinate[])[];
  pins?: readonly Coordinate[];
  /** Pinch to zoom; dragging always scrolls the page instead. */
  zoomEnabled?: boolean;
}) {
  const { colors } = useColorScheme();
  const halfLat = region.latitudeDelta / 2;
  const halfLon = region.longitudeDelta / 2;
  return (
    <Mapbox.MapView
      style={{ flex: 1 }}
      styleURL={OUTDOORS_STYLE}
      scaleBarEnabled={false}
      scrollEnabled={false}
      zoomEnabled={zoomEnabled}
      rotateEnabled={false}
      pitchEnabled={false}
    >
      <Mapbox.Camera
        defaultSettings={{
          bounds: {
            ne: [region.longitude + halfLon, region.latitude + halfLat],
            sw: [region.longitude - halfLon, region.latitude - halfLat],
          },
        }}
      />
      {outlines.length > 0 ? (
        <Mapbox.ShapeSource
          id={`${id}-outlines`}
          shape={{
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'MultiPolygon',
              coordinates: outlines.map((ring) => [ring.map(lonLat)]),
            },
          }}
        >
          <Mapbox.FillLayer
            id={`${id}-outlines-fill`}
            style={{ fillColor: colors.primary, fillOpacity: 0.18 }}
          />
          <Mapbox.LineLayer
            id={`${id}-outlines-line`}
            style={{ lineColor: colors.primary, lineWidth: 1.5 }}
          />
        </Mapbox.ShapeSource>
      ) : null}
      {lines.map((line, index) => (
        <Mapbox.ShapeSource
          // Lines never reorder within a mounted map, so the index is a stable key.
          key={`${id}-line-${index}`}
          id={`${id}-line-${index}`}
          shape={{
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: line.coordinates.map(lonLat) },
          }}
        >
          <Mapbox.LineLayer
            id={`${id}-line-${index}-layer`}
            style={{
              lineColor: line.color,
              lineWidth: line.width,
              lineJoin: 'round',
              lineCap: 'round',
            }}
          />
        </Mapbox.ShapeSource>
      ))}
      {pins.length > 0 ? (
        <Mapbox.ShapeSource
          id={`${id}-pins`}
          shape={{
            type: 'Feature',
            properties: {},
            geometry: { type: 'MultiPoint', coordinates: pins.map(lonLat) },
          }}
        >
          <Mapbox.CircleLayer
            id={`${id}-pins-layer`}
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
  );
}
