import Mapbox from '@rnmapbox/maps';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import type { LonLat, OfflineAreaBounds } from '../types';

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

/**
 * The edge of a saved area or named region, faint so the map inside stays readable. `filled`
 * tints the inside too, for the picker, where it shows what will be saved.
 */
export function AreaOutline({ rings, filled = false }: { rings: LonLat[][]; filled?: boolean }) {
  const { colors } = useColorScheme();
  return (
    <Mapbox.ShapeSource
      id="area-outline-source"
      shape={{
        type: 'Feature',
        properties: {},
        geometry: { type: 'MultiPolygon', coordinates: rings.map((ring) => [ring]) },
      }}
    >
      <Mapbox.FillLayer
        id="area-outline-fill"
        style={{ fillColor: colors.primary, fillOpacity: filled ? 0.15 : 0 }}
      />
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
