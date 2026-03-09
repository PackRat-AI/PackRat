export type DownloadStatus = 'idle' | 'downloading' | 'completed' | 'failed' | 'paused';

export interface MapRegionBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface OfflineMapRegion {
  id: string;
  name: string;
  description?: string;
  bounds: MapRegionBounds;
  minZoom: number;
  maxZoom: number;
  /** Estimated size in bytes */
  estimatedSize: number;
  /** Downloaded size in bytes */
  downloadedSize: number;
  status: DownloadStatus;
  /** Download progress 0-100 */
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface PredefinedRegion {
  id: string;
  name: string;
  description: string;
  bounds: MapRegionBounds;
  /** Center for map display */
  center: { latitude: number; longitude: number };
  /** Default zoom range */
  defaultMinZoom: number;
  defaultMaxZoom: number;
  /** Size category */
  sizeCategory: 'state-park' | 'county' | 'state';
}
