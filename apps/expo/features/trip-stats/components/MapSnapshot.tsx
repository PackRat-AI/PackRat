import * as Sentry from '@sentry/react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import MapView, { type MapStyleElement } from 'react-native-maps';
import { type MapRegion, mapCamera } from '../utils/shareMap';

// A map that hasn't loaded by now isn't coming; the caller goes on without it.
const MAP_TIMEOUT_MS = 10_000;

/**
 * A Google map drawn off-screen and snapshotted into an image, for a card that is itself captured as
 * an image. Routes and pins are drawn by the map (`children`), so they line up with it exactly.
 *
 * Returns the hidden map to render inside the frame, the image once it's ready, and whether it
 * failed (no region, or nothing within the timeout).
 */
export function useMapSnapshot({
  region,
  width,
  height,
  customMapStyle,
  children,
  sentryTags,
}: {
  /** Null skips the snapshot. */
  region: MapRegion | null;
  width: number;
  height: number;
  customMapStyle?: readonly MapStyleElement[];
  children: ReactNode;
  /** Tags for the Sentry report when the snapshot throws. */
  sentryTags: Record<string, string>;
}) {
  // A new region or size is a new map: it remounts and snapshots again.
  const key = region
    ? [
        region.latitude,
        region.longitude,
        region.latitudeDelta,
        region.longitudeDelta,
        width,
        height,
      ]
        .map((value) => value.toFixed(4))
        .join(',')
    : null;
  const [snapshot, setSnapshot] = useState<{ key: string; image: string | null } | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (key == null) return;
    const timer = setTimeout(() => {
      setSnapshot((current) => (current?.key === key ? current : { key, image: null }));
    }, MAP_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [key]);

  const current = snapshot?.key === key ? snapshot : null;
  const element =
    region && key ? (
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, zIndex: -1, opacity: 0.01 }}
      >
        <MapView
          key={key}
          ref={mapRef}
          style={{ width, height }}
          initialCamera={mapCamera({ region, width, height })}
          customMapStyle={customMapStyle ? [...customMapStyle] : undefined}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          onMapLoaded={async () => {
            try {
              const image = await mapRef.current?.takeSnapshot({ format: 'png', result: 'file' });
              setSnapshot({ key, image: image ? `file://${image.replace('file://', '')}` : null });
            } catch (error) {
              Sentry.captureException(error, { tags: { feature: 'tripStats', ...sentryTags } });
              setSnapshot({ key, image: null });
            }
          }}
        >
          {children}
        </MapView>
      </View>
    ) : null;

  return {
    element,
    image: current?.image ?? null,
    failed: region == null || (current != null && current.image == null),
  };
}
