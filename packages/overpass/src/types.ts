export interface OverpassTag {
  [key: string]: string;
}

export interface OverpassNodeGeom {
  lat: number;
  lon: number;
}

export interface OverpassMember {
  type: 'node' | 'way' | 'relation';
  ref: number;
  role: string;
  geometry?: OverpassNodeGeom[];
}

export interface OverpassBounds {
  minlat: number;
  minlon: number;
  maxlat: number;
  maxlon: number;
}

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags?: OverpassTag;
  members?: OverpassMember[];
  bounds?: OverpassBounds;
  geometry?: OverpassNodeGeom[];
  lat?: number;
  lon?: number;
}

export interface OverpassResponse {
  version: number;
  generator: string;
  osm3s: {
    timestamp_osm_base: string;
    copyright: string;
  };
  elements: OverpassElement[];
}

export type OsmSport = 'hiking' | 'cycling' | 'skiing' | 'running' | 'horse_riding';
