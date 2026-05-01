// Web implementation for react-native-maps using react-leaflet.
// This file is only bundled on web via the metro WEB_STUBS resolver.
// Leaflet CSS is injected once via CDN to avoid needing a Metro CSS import.

import type { LatLngExpression } from 'leaflet';
import L, { type Icon } from 'leaflet';
import type React from 'react';
import { Marker as LeafletMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';

if (typeof document !== 'undefined') {
  const LEAFLET_CSS_ID = '__leaflet_css__';
  if (!document.getElementById(LEAFLET_CSS_ID)) {
    const link = document.createElement('link');
    link.id = LEAFLET_CSS_ID;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
  // Fix default marker icon paths broken by module bundlers.
  delete (L.Icon.Default.prototype as Icon.Default & { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

type MapViewProps = {
  style?: object;
  initialRegion?: Region;
  region?: Region;
  children?: React.ReactNode;
  onRegionChange?: (region: Region) => void;
  onRegionChangeComplete?: (region: Region) => void;
  onPress?: (event: { nativeEvent: { coordinate: Coordinate } }) => void;
  [key: string]: unknown;
};

type MarkerProps = {
  coordinate: Coordinate;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  [key: string]: unknown;
};

function LeafletMap({ style, initialRegion, region, children, ...props }: MapViewProps) {
  const r = region ?? initialRegion;
  const center: LatLngExpression = r ? [r.latitude, r.longitude] : [20, 0];
  const zoom = r ? Math.round(10 - Math.log2(r.latitudeDelta + 0.001)) : 5;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ flex: 1, height: '100%', ...(style as object) }}
      {...(props as object)}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {children}
    </MapContainer>
  );
}

export function Marker({ coordinate, title, children }: MarkerProps) {
  return (
    <LeafletMarker position={[coordinate.latitude, coordinate.longitude]}>
      {title ? <Popup>{title}</Popup> : children}
    </LeafletMarker>
  );
}

export default LeafletMap;
export { LeafletMap as MapView };

export const Callout = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const Circle = () => null;
export const Polygon = () => null;
export const Polyline = () => null;
export const Overlay = () => null;
export const UrlTile = () => null;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = undefined;
