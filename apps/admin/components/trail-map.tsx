'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';

interface TrailMapProps {
  geometry: object;
  name: string | null;
}

export function TrailMap({ geometry, name: _name }: TrailMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([0, 0], 2);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON) map.removeLayer(layer);
    });

    const layer = L.geoJSON(geometry as Parameters<typeof L.geoJSON>[0], {
      style: { color: '#f97316', weight: 3, opacity: 0.9 },
    }).addTo(map);

    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [32, 32] });
    }
  }, [geometry]);

  return <div ref={containerRef} className="w-full h-full rounded-lg" />;
}
