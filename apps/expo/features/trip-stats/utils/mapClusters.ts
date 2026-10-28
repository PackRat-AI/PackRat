import type { Coordinate } from './polyline';
import type { MapRegion } from './shareMap';

/**
 * Groups map pins that would overlap at the map's current framing, as Google Maps' marker
 * clustering does: pins snap to a grid sized from the visible region, a cell holding one pin stays
 * a pin, and a cell holding more becomes a count at their middle.
 */

export interface MapPin extends Coordinate {
  id: string;
}

export interface MapCluster extends Coordinate {
  /** The pin's own id, or `cluster:` and its cell. */
  id: string;
  members: string[];
}

/** Cells across the visible width. About eight keeps 40dp markers on a phone-width map apart. */
const CELLS_ACROSS = 8;

export function clusterPins({
  pins,
  region,
}: {
  pins: readonly MapPin[];
  region: MapRegion | null;
}): MapCluster[] {
  if (!region || region.longitudeDelta <= 0 || region.latitudeDelta <= 0) {
    return pins.map((pin) => ({ ...pin, members: [pin.id] }));
  }
  const width = region.longitudeDelta / CELLS_ACROSS;
  const height = region.latitudeDelta / CELLS_ACROSS;
  const cells = new Map<string, MapPin[]>();
  for (const pin of pins) {
    const key = `${Math.floor(pin.longitude / width)}:${Math.floor(pin.latitude / height)}`;
    cells.set(key, [...(cells.get(key) ?? []), pin]);
  }
  return [...cells].map(([key, members]) => {
    const [first] = members;
    if (members.length === 1 && first) {
      return {
        id: first.id,
        latitude: first.latitude,
        longitude: first.longitude,
        members: [first.id],
      };
    }
    return {
      id: `cluster:${key}`,
      latitude: members.reduce((sum, pin) => sum + pin.latitude, 0) / members.length,
      longitude: members.reduce((sum, pin) => sum + pin.longitude, 0) / members.length,
      members: members.map((pin) => pin.id),
    };
  });
}

/**
 * True when zooming to a cluster's own frame would barely move the map: its trips share a spot,
 * so they are listed instead.
 */
export function isStacked({ current, next }: { current: MapRegion; next: MapRegion }): boolean {
  return next.latitudeDelta >= current.latitudeDelta * 0.9;
}
