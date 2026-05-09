'use client';

import { useEffect, useRef } from 'react';
import { DEFAULT_CENTER, DEFAULT_ZOOM, NEARBY_ZOOM } from 'trails-app/lib/geolocation';
import type { TrailSummaryWithCoords } from 'trails-app/lib/overpass';

interface TrailMapProps {
  center?: [number, number];
  trails: TrailSummaryWithCoords[];
  selectedOsmId?: string;
  onTrailClick?: (osmId: string) => void;
}

// Leaflet is SSR-incompatible; this component must be loaded via next/dynamic with ssr:false
export function TrailMap({ center, trails, selectedOsmId, onTrailClick }: TrailMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<import('leaflet').LayerGroup | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs once; center changes handled by flyTo effect below
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Lazy-load Leaflet at runtime only (requires window)
    let L: typeof import('leaflet');
    const initialCenter = center;

    async function init(el: HTMLDivElement) {
      L = (await import('leaflet')).default;

      // Fix default icon paths broken by webpack/bun bundlers
      // biome-ignore lint/suspicious/noExplicitAny: Leaflet internal
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (mapRef.current) return; // already initialized

      const map = L.map(el, {
        center: initialCenter ?? DEFAULT_CENTER,
        zoom: initialCenter ? NEARBY_ZOOM : DEFAULT_ZOOM,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      markersRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    }

    init(container);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fly to center when it changes (user location obtained)
  useEffect(() => {
    if (!mapRef.current || !center) return;
    mapRef.current.flyTo(center, NEARBY_ZOOM, { duration: 1 });
  }, [center]);

  // Update markers when trails change
  useEffect(() => {
    if (!markersRef.current) return;
    const group = markersRef.current;
    group.clearLayers();
    let cancelled = false;

    import('leaflet').then(({ default: L }) => {
      if (cancelled) return;
      for (const trail of trails) {
        if (!trail.center) continue;
        const isSelected = trail.osmId === selectedOsmId;
        const marker = L.circleMarker(trail.center, {
          radius: isSelected ? 10 : 7,
          fillColor: isSelected ? '#6366f1' : '#3b82f6',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        });
        marker.bindTooltip(trail.name ?? 'Unnamed Trail', { permanent: false, direction: 'top' });
        if (onTrailClick) {
          marker.on('click', () => onTrailClick(trail.osmId));
        }
        group.addLayer(marker);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [trails, selectedOsmId, onTrailClick]);

  return <div ref={containerRef} className="trail-map" style={{ minHeight: 360 }} />;
}
