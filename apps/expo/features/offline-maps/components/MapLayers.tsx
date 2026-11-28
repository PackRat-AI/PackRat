import Mapbox from '@rnmapbox/maps';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import type { LonLat, OfflineAreaBounds } from '../types';
import { boundsRing } from '../utils/offlineArea';

/** A route drawn as a solid orange line, the style every in-app map uses. */
export function TrailLines({ id, lines }: { id: string; lines: LonLat[][] }) {
  if (lines.length === 0) return null;
  return (
    <Mapbox.ShapeSource
      id={`${id}-source`}
      shape={{
        type: 'Feature',
        properties: {},
        geometry: { type: 'MultiLineString', coordinates: lines },
      }}
    >
      <Mapbox.LineLayer
        id={`${id}-line`}
        style={{ lineColor: '#F97316', lineWidth: 4, lineJoin: 'round', lineCap: 'round' }}
      />
    </Mapbox.ShapeSource>
  );
}

/** The edge of a saved area, faint so the map inside stays readable. */
export function AreaOutline({ bounds }: { bounds: OfflineAreaBounds }) {
  const { colors } = useColorScheme();
  return (
    <Mapbox.ShapeSource
      id="area-outline-source"
      shape={{
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: boundsRing(bounds) },
      }}
    >
      <Mapbox.LineLayer
        id="area-outline-line"
        style={{ lineColor: colors.primary, lineWidth: 2, lineOpacity: 0.6 }}
      />
    </Mapbox.ShapeSource>
  );
}

/** Camera corners for bounds, in the `[northeast, southwest]` order Mapbox takes. */
export function cameraBounds({ bounds, padding }: { bounds: OfflineAreaBounds; padding: number }) {
  return {
    ne: [bounds.east, bounds.north],
    sw: [bounds.west, bounds.south],
    paddingTop: padding,
    paddingBottom: padding,
    paddingLeft: padding,
    paddingRight: padding,
  };
}
