import { clientEnvs } from '@packrat/env/expo-client';
import { isArray, isNumber, isObject, isString } from '@packrat/guards';
import { safeJsonParse, safeJsonStringify } from '@packrat/utils';
import Mapbox from '@rnmapbox/maps';
import * as Sentry from '@sentry/react-native';
import { obs } from 'expo-app/lib/store';
import * as Network from 'expo-network';
import { nanoid } from 'nanoid';
import { NativeModules } from 'react-native';
import { offlineDownloadsStore, offlineMapsStore } from '../store/offlineMaps';
import type { LonLat, OfflineArea, OfflineAreaBounds, OfflineDetailLevel } from '../types';
import { type ConnectionKind, failureFromMessage, mayDownload } from '../utils/downloads';
import { boundaryFeatureCollection } from '../utils/namedRegions';
import { DETAIL_MAX_ZOOM } from '../utils/offlineArea';

/** The style every in-app Mapbox map uses, so a saved area shows up on all of them. */
export const OUTDOORS_STYLE = 'mapbox://styles/mapbox/outdoors-v12';

const { offlineManager } = Mapbox;

// Set on load rather than at startup, so a map that renders before the app root's effects run
// (a cold start straight onto a trip) still has it. Every Mapbox map imports this module.
if (clientEnvs.EXPO_PUBLIC_MAPBOX_TOKEN) {
  void Mapbox.setAccessToken(clientEnvs.EXPO_PUBLIC_MAPBOX_TOKEN);
}

type ProgressListener = Parameters<typeof offlineManager.createPack>[1];
type ErrorListener = NonNullable<Parameters<typeof offlineManager.createPack>[2]>;
type OfflineProgressStatus = Parameters<ProgressListener>[1];
type OfflinePackError = Parameters<ErrorListener>[1];

/** Downloads running in the tile store right now, by area id. */
const running = new Set<string>();
/** Areas the user agreed to download over cellular even with the setting off. */
const cellularOnce = new Set<string>();
/** Each area's native work, run one step at a time so a delete cannot race a start. */
const queues = new Map<string, Promise<unknown>>();
// Nothing may download until the first network check says how the phone is connected.
let connection: ConnectionKind = 'none';
let started = false;

function connectionKind(state: Network.NetworkState): ConnectionKind {
  if (state.isConnected === false || state.isInternetReachable === false) return 'none';
  if (state.type === Network.NetworkStateType.CELLULAR) return 'cellular';
  if (state.type === Network.NetworkStateType.WIFI) return 'wifi';
  return 'other';
}

const areas = () => Object.values(offlineMapsStore.areas.peek());
const allowCellular = () => offlineMapsStore.allowCellular.peek();

/**
 * Picks up downloads that stopped when the app closed, and starts or pauses
 * downloads as the connection changes. Safe to call more than once.
 */
export function startOfflineMaps(): () => void {
  const subscription = Network.addNetworkStateListener((state) => {
    connection = connectionKind(state);
    void applyConnection();
  });
  const stopWatchingSetting = offlineMapsStore.allowCellular.onChange(() => {
    void applyConnection();
  });
  if (!started) {
    started = true;
    offlineManager.setProgressEventThrottle(500);
  }
  void Network.getNetworkStateAsync().then((state) => {
    connection = connectionKind(state);
    return applyConnection();
  });
  return () => {
    subscription.remove();
    stopWatchingSetting();
    // With nothing left watching the connection, a download could drift onto cellular.
    void pauseAll();
  };
}

export function connectionIsCellular(): boolean {
  return connection === 'cellular';
}

/** Starts saving an area. Returns as soon as it is recorded; watch the downloads store. */
export function saveArea({
  name,
  bounds,
  detail,
  tripId,
  tripEndsAt,
  trailId,
  trailLines,
  boundary,
  allowCellularOnce,
}: {
  name: string;
  bounds: OfflineAreaBounds;
  detail: OfflineDetailLevel;
  tripId?: string;
  tripEndsAt?: number;
  trailId?: string;
  trailLines?: LonLat[][];
  /** A named region's outline: only what lies inside it is saved. */
  boundary?: LonLat[][];
  /** The user agreed to this one download over cellular. */
  allowCellularOnce?: boolean;
}): OfflineArea {
  const area: OfflineArea = {
    id: nanoid(),
    name,
    bounds,
    detail,
    savedAt: Date.now(),
    tripId,
    tripEndsAt,
    trailId,
    trailLines: trailLines && trailLines.length > 0 ? trailLines : undefined,
    boundary: boundary && boundary.length > 0 ? boundary : undefined,
    sizeBytes: 0,
    isComplete: false,
  };
  obs({ store: offlineMapsStore.areas, id: area.id }).set(area);
  if (allowCellularOnce) cellularOnce.add(area.id);
  void startOrWait({ area, fresh: true });
  return area;
}

/** Re-downloads an area so it carries the latest map data. Also how a failed download retries. */
export async function updateArea(area: OfflineArea): Promise<void> {
  await stop(area.id);
  obs({ store: offlineDownloadsStore.failures, id: area.id }).delete();
  // The old tiles are replaced, so until the new ones finish the area is a download again.
  obs({ store: offlineMapsStore.areas, id: area.id }).isComplete.set(false);
  await startOrWait({ area, fresh: true });
}

/** Stops a download in progress and removes everything it saved. */
export async function cancelArea(area: OfflineArea): Promise<void> {
  await deleteArea(area);
}

export function renameArea({ id, name }: { id: string; name: string }): void {
  const trimmed = name.trim();
  if (!trimmed || !obs({ store: offlineMapsStore.areas, id: id }).peek()) return;
  obs({ store: offlineMapsStore.areas, id: id }).name.set(trimmed);
}

export async function deleteArea(area: OfflineArea): Promise<void> {
  Sentry.addBreadcrumb({
    category: 'offlineMaps',
    message: 'Area deleted',
    level: 'info',
    data: { areaId: area.id },
  });
  await serially({
    id: area.id,
    task: async () => {
      await pause(area.id);
      try {
        await offlineManager.deletePack(area.id);
      } catch (error) {
        // The record stays, so Delete can be tried again rather than orphaning the tiles.
        Sentry.captureException(error, {
          tags: { feature: 'offlineMaps', action: 'deletePack' },
          extra: { areaId: area.id },
        });
        return;
      }
      obs({ store: offlineMapsStore.areas, id: area.id }).delete();
      clearRuntime(area.id);
      cellularOnce.delete(area.id);
    },
  });
}

export async function deleteAllAreas(): Promise<void> {
  for (const area of areas()) await deleteArea(area);
}

/** Starts every download the connection allows, and pauses the ones it no longer does. */
async function applyConnection(): Promise<void> {
  for (const area of areas()) {
    if (area.isComplete && !running.has(area.id)) continue;
    if (running.has(area.id)) {
      if (mayRun(area.id)) continue;
      await stop(area.id);
      // It may have finished, or been deleted, while it was being stopped.
      const current = obs({ store: offlineMapsStore.areas, id: area.id }).peek();
      if (current?.isComplete !== false) continue;
      // The setting or connection may have flipped back while the stop waited its turn;
      // resuming re-checks it and marks the area waiting only if it still may not run.
      await startOrWait({ area: current, fresh: false });
    } else if (!obs({ store: offlineDownloadsStore.failures, id: area.id }).peek()) {
      // Also picks up downloads that stopped when the app was closed.
      await startOrWait({ area, fresh: false });
    }
  }
}

async function pauseAll(): Promise<void> {
  for (const id of [...running]) await stop(id);
}

function mayRun(id: string): boolean {
  return mayDownload({ connection, allowCellular: allowCellular() || cellularOnce.has(id) });
}

/**
 * Starts the download now if the connection allows, otherwise marks it waiting. A fresh start
 * replaces whatever the tile store holds for the area; otherwise an existing partial download is
 * resumed where it stopped.
 */
function startOrWait({ area, fresh }: { area: OfflineArea; fresh: boolean }): Promise<void> {
  return serially({ id: area.id, task: () => begin({ area, fresh }) });
}

async function begin({ area, fresh }: { area: OfflineArea; fresh: boolean }): Promise<void> {
  // Deleted while this start waited its turn.
  if (!obs({ store: offlineMapsStore.areas, id: area.id }).peek()) return;
  if (running.has(area.id)) return;
  if (!mayRun(area.id)) {
    obs({ store: offlineDownloadsStore.waiting, id: area.id }).set(true);
    return;
  }
  obs({ store: offlineDownloadsStore.waiting, id: area.id }).delete();
  obs({ store: offlineDownloadsStore.progress, id: area.id }).set({ fraction: 0, bytes: 0 });
  running.add(area.id);
  Sentry.addBreadcrumb({
    category: 'offlineMaps',
    message: fresh ? 'Download started' : 'Download resumed',
    level: 'info',
    data: { areaId: area.id, detail: area.detail },
  });

  try {
    const existing = await offlineManager.getPack(area.id);
    if (existing && !fresh) {
      await offlineManager.subscribe(area.id, (_pack, status) => onProgress(status), onError);
      await existing.resume();
      return;
    }
    if (existing) await offlineManager.deletePack(area.id);
    if (area.boundary) {
      await createOutlinePack({ area, boundary: area.boundary });
      return;
    }
    const { south, west, north, east } = area.bounds;
    await offlineManager.createPack(
      {
        name: area.id,
        styleURL: OUTDOORS_STYLE,
        bounds: [
          [east, north],
          [west, south],
        ],
        minZoom: 0,
        maxZoom: DETAIL_MAX_ZOOM[area.detail],
        metadata: { areaName: area.name },
      },
      (_pack, status) => onProgress(status),
      onError,
    );
  } catch (error) {
    running.delete(area.id);
    obs({ store: offlineDownloadsStore.progress, id: area.id }).delete();
    obs({ store: offlineDownloadsStore.failures, id: area.id }).set('failed');
    Sentry.captureException(error, {
      tags: { feature: 'offlineMaps', action: fresh ? 'createPack' : 'resumePack' },
      extra: { areaId: area.id },
    });
  }
}

/**
 * Starts a download framed by a region's outline. `offlineManager.createPack` only takes a
 * rectangle, so this calls the native module directly with the outline; the
 * `patches/@rnmapbox%2Fmaps` patch makes it pass a one-feature MultiPolygon to the tile store as
 * is, and restore it when a download resumes. Listeners go on first, the way `createPack` does it.
 * The manager drops progress for a pack missing from its own list, which only `createPack` fills,
 * so the new pack is added to that list straight after.
 */
async function createOutlinePack({
  area,
  boundary,
}: {
  area: OfflineArea;
  boundary: LonLat[][];
}): Promise<void> {
  await offlineManager.subscribe(area.id, (_pack, status) => onProgress(status), onError);
  await NativeModules.RNMBXOfflineModule.createPack({
    name: area.id,
    styleURL: OUTDOORS_STYLE,
    // One feature, never two: the module reads a two-feature collection as a pair of corners.
    bounds: safeJsonStringify(boundaryFeatureCollection(boundary)),
    minZoom: 0,
    maxZoom: DETAIL_MAX_ZOOM[area.detail],
    metadata: safeJsonStringify({ areaName: area.name, name: area.id }),
  });
  // `getPack` re-reads the native list. The tile store can take a moment to list a new region, and
  // a download takes far longer than this to report its first progress.
  for (let attempt = 0; attempt < 10; attempt++) {
    const found = await offlineManager.getPack(area.id);
    if (found) {
      await reportIfAlreadyComplete(area.id);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('The new outline pack never appeared in the tile store');
}

function onProgress(status: OfflineProgressStatus): void {
  const id = status.name;
  if (!obs({ store: offlineMapsStore.areas, id: id }).peek() || status.percentage === null) return;
  if (status.state === 'complete') {
    markComplete({ id, sizeBytes: status.completedResourceSize });
    return;
  }
  if (!running.has(id)) return;
  obs({ store: offlineDownloadsStore.progress, id: id }).set({
    fraction: Math.min(status.percentage / 100, 1),
    bytes: status.completedResourceSize,
  });
}

function markComplete({ id, sizeBytes }: { id: string; sizeBytes: number }): void {
  running.delete(id);
  cellularOnce.delete(id);
  obs({ store: offlineDownloadsStore.progress, id: id }).delete();
  obs({ store: offlineDownloadsStore.waiting, id: id }).delete();
  obs({ store: offlineMapsStore.areas, id: id }).assign({
    sizeBytes,
    isComplete: true,
    savedAt: Date.now(),
  });
}

/**
 * Marks an outline download done if it finished before the manager knew of its pack. Tiles another
 * saved or deleted map left in the store make that near-instant, and its completion event is
 * dropped. Any later event reaches `onProgress` as usual.
 */
async function reportIfAlreadyComplete(id: string): Promise<void> {
  const packs: unknown = await NativeModules.RNMBXOfflineModule.getPacks();
  if (!isArray(packs)) return;
  for (const pack of packs) {
    if (!isObject(pack) || !('state' in pack) || pack.state !== 'complete') continue;
    if (!('metadata' in pack) || !isString(pack.metadata)) continue;
    const metadata = safeJsonParse<unknown>(pack.metadata);
    if (!isObject(metadata) || !('name' in metadata) || metadata.name !== id) continue;
    const size = 'completedResourceSize' in pack ? pack.completedResourceSize : 0;
    if (running.has(id)) markComplete({ id, sizeBytes: isNumber(size) ? size : 0 });
    return;
  }
}

function onError(_pack: unknown, error: OfflinePackError): void {
  const id = error.name;
  const failure = failureFromMessage(error.message);
  // A pause for Wi-Fi, a cancel or an update stops the task on purpose; that is not a failure.
  if (failure === 'canceled' || !running.has(id)) return;
  running.delete(id);
  obs({ store: offlineDownloadsStore.progress, id: id }).delete();
  obs({ store: offlineDownloadsStore.failures, id: id }).set(failure);
  // The binding reports a plain `{ name, message }` object, not an Error, so there is no original
  // stack to keep.
  Sentry.captureException(new Error(error.message), {
    tags: { feature: 'offlineMaps', action: 'loadTileRegion' },
    extra: { areaId: id, failure },
  });
}

/** Stops the tile store's task for an area, if one is running. */
function stop(id: string): Promise<void> {
  return serially({ id, task: () => pause(id) });
}

async function pause(id: string): Promise<void> {
  if (!running.delete(id)) return;
  obs({ store: offlineDownloadsStore.progress, id: id }).delete();
  try {
    const pack = await offlineManager.getPack(id);
    await pack?.pause();
  } catch {
    // Already stopped: the tile store finished or failed between the check and the pause.
  }
}

function serially({ id, task }: { id: string; task: () => Promise<void> }): Promise<void> {
  const next = (queues.get(id) ?? Promise.resolve()).then(task, task);
  // The next step runs whether this one failed or not; its caller still sees the failure.
  queues.set(
    id,
    next.catch(() => undefined),
  );
  return next;
}

function clearRuntime(id: string): void {
  obs({ store: offlineDownloadsStore.progress, id: id }).delete();
  obs({ store: offlineDownloadsStore.failures, id: id }).delete();
  obs({ store: offlineDownloadsStore.waiting, id: id }).delete();
}
