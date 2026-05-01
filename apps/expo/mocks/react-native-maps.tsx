// Web implementation for react-native-maps using react-leaflet.
// Leaflet CSS is injected programmatically to avoid Metro CSS import issues.
import type React from 'react';
import { View } from 'react-native';

// Inject leaflet CSS once via CDN.
if (typeof document !== 'undefined') {
  const LEAFLET_CSS_ID = '__leaflet_css__';
  if (!document.getElementById(LEAFLET_CSS_ID)) {
    const link = document.createElement('link');
    link.id = LEAFLET_CSS_ID;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
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

// Lazily import react-leaflet to avoid SSR issues.
let MapContainer: React.ComponentType<object> | null = null;
let TileLayer: React.ComponentType<object> | null = null;
let LeafletMarker: React.ComponentType<object> | null = null;
let Popup: React.ComponentType<object> | null = null;
let leafletLoaded = false;

function ensureLeaflet() {
  if (leafletLoaded) return;
  try {
    // biome-ignore lint/suspicious/noExplicitAny: dynamic require needed
    const rl = require('react-leaflet') as any;
    MapContainer = rl.MapContainer;
    TileLayer = rl.TileLayer;
    LeafletMarker = rl.Marker;
    Popup = rl.Popup;
    // Fix default marker icons missing in bundlers.
    // biome-ignore lint/suspicious/noExplicitAny: dynamic require needed
    const L = require('leaflet') as any;
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
    leafletLoaded = true;
  } catch {
    // react-leaflet not installed — fall back to placeholder
  }
}

function MapFallback({ style }: { style?: object }) {
  return (
    <View
      style={[
        {
          backgroundColor: '#d1e8d1',
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        } as object,
        style as object,
      ]}
    />
  );
}

function LeafletMap({ style, initialRegion, region, children, ...props }: MapViewProps) {
  ensureLeaflet();
  if (!MapContainer || !TileLayer) return <MapFallback style={style} />;

  const r = region ?? initialRegion;
  const center: [number, number] = r ? [r.latitude, r.longitude] : [20, 0];
  const zoom = r ? Math.round(10 - Math.log2(r.latitudeDelta + 0.001)) : 5;

  const containerStyle = {
    flex: 1,
    height: '100%',
    ...(style as object),
  };

  const MC = MapContainer as React.ComponentType<{
    center: [number, number];
    zoom: number;
    style: object;
    children?: React.ReactNode;
    [key: string]: unknown;
  }>;
  const TL = TileLayer as React.ComponentType<{ url: string; attribution: string }>;

  return (
    <MC center={center} zoom={zoom} style={containerStyle} {...(props as object)}>
      <TL
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {children}
    </MC>
  );
}

export function Marker({ coordinate, title, children }: MarkerProps) {
  ensureLeaflet();
  if (!LeafletMarker) return null;

  const LM = LeafletMarker as React.ComponentType<{
    position: [number, number];
    children?: React.ReactNode;
  }>;
  const P = Popup as React.ComponentType<{ children?: React.ReactNode }> | null;

  return (
    <LM position={[coordinate.latitude, coordinate.longitude]}>
      {title && P ? <P>{title}</P> : children}
    </LM>
  );
}

export default LeafletMap;

// Named export alias for components that import MapView by name.
export { LeafletMap as MapView };

// Additional react-native-maps exports used in the codebase.
export const Callout = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const Circle = () => null;
export const Polygon = () => null;
export const Polyline = () => null;
export const Overlay = () => null;
export const UrlTile = () => null;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = undefined;
