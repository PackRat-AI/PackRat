/** How much of the map a saved area keeps. Mirrors `OfflineDetailLevel` in the Swift app. */
export type OfflineDetailLevel = 'standard' | 'trail';

/** The rectangle a saved area covers, in degrees. */
export type OfflineAreaBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

/** A `[longitude, latitude]` pair, the order Mapbox and GeoJSON use. */
export type LonLat = [number, number];

/**
 * A map area the user saved for offline use.
 *
 * The tiles live in Mapbox's tile store under `id`; this record carries what the tile store does
 * not: the user's name for it, the detail level, and the trip or trail it was saved for. Times are
 * epoch milliseconds so the persisted cache never revives them as `Date`s.
 */
export type OfflineArea = {
  id: string;
  name: string;
  bounds: OfflineAreaBounds;
  detail: OfflineDetailLevel;
  savedAt: number;
  tripId?: string;
  tripEndsAt?: number;
  trailId?: string;
  /** The trail's line, kept so the saved map can draw it without signal. */
  trailLines?: LonLat[][];
  /** Bytes on disk once the download finished. Zero while downloading. */
  sizeBytes: number;
  /** False until every tile has arrived, so an interrupted download is picked up on next launch. */
  isComplete: boolean;
};

/** Download progress for one area: 0...1, plus bytes so far. */
export type OfflineProgress = { fraction: number; bytes: number };

export type OfflineDownloadFailure = 'tooLarge' | 'diskFull' | 'failed';
