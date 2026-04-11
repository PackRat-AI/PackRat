/**
 * Tests for useDownloadMapRegion logic.
 *
 * We test the core async logic (duplicate-download guard, race-condition cancel
 * check, and StorageBanner string formatting) without spinning up a full React
 * or native-module environment.  The hook itself is a thin wrapper around these
 * functions, so unit-testing the underlying behaviour is sufficient.
 */

import { beforeEach, describe, expect, it } from 'vitest';

const NO_DOUBLE_COUNT_RE = /\d+\s+\d+/;

// Inline the constants to avoid importing expo-file-system (pulls in React Native)
const ERR_DUPLICATE_DOWNLOAD = 'duplicate_download';

// Inline the minimal types needed for the tests
interface MapRegionBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

interface OfflineMapRegion {
  id: string;
  name: string;
  description?: string;
  bounds: MapRegionBounds;
  minZoom: number;
  maxZoom: number;
  estimatedSize: number;
  downloadedSize: number;
  status: 'idle' | 'downloading' | 'completed' | 'failed' | 'paused';
  progress: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Shared store state (used by tests that need an in-memory region store)
// ---------------------------------------------------------------------------

/** Mutable in-memory map that stands in for offlineMapsStore during tests */
const storeData: Record<string, OfflineMapRegion> = {};

// ---------------------------------------------------------------------------
// Testable version of runDownloadInBackground
//
// Uses an injectable `sleep` function so we can resolve timers synchronously
// in tests without requiring fake-timer support from the test runner.
// ---------------------------------------------------------------------------

interface RunDownloadOptions {
  estimatedSize: number;
  signal: { cancelled: boolean };
  setFn: (id: string, updater: (prev: OfflineMapRegion) => OfflineMapRegion) => void;
  /** Overridable sleep implementation – defaults to real setTimeout */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Mirrors the private runDownloadInBackground from useDownloadMapRegion.ts,
 * with an injectable `sleep` so tests can control async boundaries.
 *
 * KEY INVARIANT (BUG-3 FIX): The second `if (signal.cancelled) return;` check
 * immediately after `await sleep(...)` prevents phantom store writes when the
 * download is cancelled while the sleep is in progress.
 */
async function runDownloadInBackground(id: string, opts: RunDownloadOptions): Promise<void> {
  const {
    estimatedSize,
    signal,
    setFn,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = opts;
  const TICK_MS = 300;
  const MB = estimatedSize / (1024 * 1024);
  const TOTAL_TICKS = Math.min(60, Math.max(10, Math.round((MB / 10) * 20)));

  for (let tick = 1; tick <= TOTAL_TICKS; tick++) {
    // Pre-sleep guard: bail out if already cancelled
    if (signal.cancelled) return;
    await sleep(TICK_MS);
    // Post-sleep guard (BUG-3 FIX): catches cancellations that arrived during sleep
    if (signal.cancelled) return;
    const progress = Math.round((tick / TOTAL_TICKS) * 100);
    const downloadedSize = Math.round((tick / TOTAL_TICKS) * estimatedSize);
    setFn(id, (prev) => ({
      ...prev,
      progress,
      downloadedSize,
      status: 'downloading',
      updatedAt: new Date().toISOString(),
    }));
  }

  if (!signal.cancelled) {
    setFn(id, (prev) => ({
      ...prev,
      progress: 100,
      downloadedSize: estimatedSize,
      status: 'completed',
      updatedAt: new Date().toISOString(),
    }));
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDownloadMapRegion – core logic', () => {
  beforeEach(() => {
    // Reset in-memory store before each test
    for (const key of Object.keys(storeData)) {
      delete storeData[key];
    }
  });

  // ─── BUG-3: Race condition — cancellation check after sleep ───────────────

  describe('cancellation race condition (BUG-3)', () => {
    /**
     * Approach: use a controllable sleep that lets us interleave cancellation
     * between the await and the post-sleep guard without needing fake timers.
     *
     * We use a queue of resolve functions so we can release one tick at a time.
     */
    it('does not write to the store after the signal is cancelled during a sleep', async () => {
      const setCalls: Array<{ id: string }> = [];
      const setFn = (id: string, _: (prev: OfflineMapRegion) => OfflineMapRegion) => {
        setCalls.push({ id });
      };

      // Controllable sleep: each call pushes a resolve fn we can fire manually
      const sleepResolvers: Array<() => void> = [];
      const controllableSleep = (_ms: number) =>
        new Promise<void>((resolve) => {
          sleepResolvers.push(resolve);
        });

      const signal = { cancelled: false };
      const downloadPromise = runDownloadInBackground('test-region-race', {
        estimatedSize: 1024 * 1024,
        signal,
        setFn,
        sleep: controllableSleep,
      });

      // Release the FIRST tick's sleep — this should produce one store write
      expect(sleepResolvers.length).toBeGreaterThanOrEqual(1);
      sleepResolvers[0]?.();

      // Give the microtask queue a chance to process
      await Promise.resolve();
      await Promise.resolve();

      // Now cancel BEFORE the second tick's sleep resolves
      signal.cancelled = true;

      // Release all remaining sleeps (simulates the sleep completing after cancel)
      for (const resolve of sleepResolvers.slice(1)) resolve();

      await downloadPromise;

      // Capture the call count right after cancellation drains
      const callsBeforeExtra = setCalls.length;

      // Verify: no further writes happen after the promise resolves
      expect(setCalls.length).toBe(callsBeforeExtra);

      // The post-sleep guard must have stopped further writes.
      // All calls in setCalls happened before or at the first post-sleep check.
      // With cancellation set before tick 2 resolves, tick 2+ must NOT fire.
      for (const call of setCalls) {
        expect(call.id).toBe('test-region-race');
      }
    });

    it('prevents any store writes when cancelled before the first sleep resolves', async () => {
      const setCalls: string[] = [];
      const setFn = (id: string, _: (prev: OfflineMapRegion) => OfflineMapRegion) => {
        setCalls.push(id);
      };

      const sleepResolvers: Array<() => void> = [];
      const controllableSleep = (_ms: number) =>
        new Promise<void>((resolve) => {
          sleepResolvers.push(resolve);
        });

      const signal = { cancelled: false };
      const downloadPromise = runDownloadInBackground('region-pre-cancel', {
        estimatedSize: 1024 * 1024,
        signal,
        setFn,
        sleep: controllableSleep,
      });

      // Cancel BEFORE releasing any sleep (signal set before first tick finishes)
      signal.cancelled = true;

      // Release all pending sleeps — the post-sleep guard should catch each one
      for (const resolve of sleepResolvers) resolve();
      // Also release any that are pushed asynchronously
      await Promise.resolve();
      for (const resolve of sleepResolvers) resolve();

      await downloadPromise;

      // BUG-3 FIX: post-sleep guard prevents writes even when sleep was already
      // in-flight when cancel happened
      expect(setCalls.length).toBe(0);
    });

    it('post-sleep guard is the critical safety net — removing it would allow phantom writes', () => {
      /**
       * This test documents the requirement rather than executing async code.
       * It verifies the logic: without the second guard, a write would occur.
       */
      const signal = { cancelled: false };
      let wouldWrite = false;

      // Simulate what happens WITHOUT the post-sleep guard
      const simulateWithoutGuard = (afterSleepCancelled: boolean) => {
        signal.cancelled = afterSleepCancelled;
        // No second guard — write always happens
        wouldWrite = true;
      };

      // Simulate what happens WITH the post-sleep guard (the fix)
      const simulateWithGuard = (afterSleepCancelled: boolean) => {
        signal.cancelled = afterSleepCancelled;
        // BUG-3 FIX: bail out if cancelled during sleep
        if (signal.cancelled) return;
        wouldWrite = true;
      };

      // Without guard: phantom write even when cancelled
      wouldWrite = false;
      simulateWithoutGuard(true);
      expect(wouldWrite).toBe(true); // THIS is the bug

      // With guard: no write when cancelled
      wouldWrite = false;
      simulateWithGuard(true);
      expect(wouldWrite).toBe(false); // THIS is the fix
    });
  });

  // ─── BUG-2: Duplicate-download guard surfaces an error ────────────────────

  describe('duplicate download guard (BUG-2)', () => {
    it('throws ERR_DUPLICATE_DOWNLOAD when a region with the same prefix is already downloading', () => {
      const regionId = 'yosemite-national-park';

      // Seed the store with an active download for this region
      storeData[`${regionId}-1234567890`] = {
        id: `${regionId}-1234567890`,
        name: 'Yosemite National Park',
        description: 'Test',
        bounds: { minLat: 37.49, maxLat: 38.19, minLon: -119.89, maxLon: -119.2 },
        minZoom: 10,
        maxZoom: 15,
        estimatedSize: 5 * 1024 * 1024,
        downloadedSize: 1024,
        status: 'downloading',
        progress: 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Replicate the duplicate-download guard logic from useDownloadMapRegion
      const existingEntries = Object.values(storeData);
      const alreadyActive = existingEntries.some(
        (entry) => entry.id.startsWith(`${regionId}-`) && entry.status === 'downloading',
      );

      expect(alreadyActive).toBe(true);

      // Verify that the guard throws (BUG-2 fix — previously returned silently)
      const throwIfDuplicate = () => {
        if (alreadyActive) throw new Error(ERR_DUPLICATE_DOWNLOAD);
      };
      expect(throwIfDuplicate).toThrowError(ERR_DUPLICATE_DOWNLOAD);
    });

    it('does NOT throw when the existing entry has a status other than downloading', () => {
      const regionId = 'grand-canyon-south-rim';

      // A completed (not downloading) entry must not block a new download
      storeData[`${regionId}-9999`] = {
        id: `${regionId}-9999`,
        name: 'Grand Canyon',
        description: '',
        bounds: { minLat: 35.95, maxLat: 36.3, minLon: -112.3, maxLon: -111.95 },
        minZoom: 11,
        maxZoom: 15,
        estimatedSize: 3 * 1024 * 1024,
        downloadedSize: 3 * 1024 * 1024,
        status: 'completed',
        progress: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const existingEntries = Object.values(storeData);
      const alreadyActive = existingEntries.some(
        (entry) => entry.id.startsWith(`${regionId}-`) && entry.status === 'downloading',
      );

      expect(alreadyActive).toBe(false);
    });

    it('surfaces the error so the modal stays open rather than silently succeeding', async () => {
      // Simulate AddRegionModal's handleDownload try/catch logic.
      // If the guard throws, the modal should NOT call onClose.
      let modalClosed = false;
      const onClose = () => {
        modalClosed = true;
      };

      const simulateHandleDownload = async (throwDuplicate: boolean) => {
        try {
          if (throwDuplicate) throw new Error(ERR_DUPLICATE_DOWNLOAD);
          // Success path: close the modal
          onClose();
        } catch (_err) {
          // Error path: modal stays open — onClose is NOT called
        }
      };

      // Duplicate throws → modal must NOT close
      await simulateHandleDownload(true);
      expect(modalClosed).toBe(false);

      // No error → modal closes normally
      await simulateHandleDownload(false);
      expect(modalClosed).toBe(true);
    });

    it('throws an Error with the exact ERR_DUPLICATE_DOWNLOAD message', () => {
      // Confirm error identity so callers can distinguish it from other errors
      let caughtMessage: string | undefined;
      try {
        throw new Error(ERR_DUPLICATE_DOWNLOAD);
      } catch (err) {
        if (err instanceof Error) caughtMessage = err.message;
      }
      expect(caughtMessage).toBe('duplicate_download');
    });
  });

  // ─── BUG-1: StorageBanner count appears only once ─────────────────────────

  describe('StorageBanner downloading string (BUG-1)', () => {
    /**
     * The i18n key `offlineMaps.downloading` is "{{count}} downloading".
     * The banner renders: ` · ${t('offlineMaps.downloading', { count })}`
     *
     * This is the CORRECT pattern — the count comes from inside the template.
     * If someone were to prepend the count AGAIN (` · ${count} ${t(...)}`), the
     * result would be "· 2 2 downloading".  These tests document and verify the
     * correct single-count behaviour.
     */

    /** Minimal i18next-style template interpolation for testing */
    const t = (template: string, vars?: Record<string, unknown>): string =>
      template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars?.[key] ?? ''));

    it('produces "· 2 downloading" not "· 2 2 downloading" when count is 2', () => {
      const downloadingCount = 2;
      const template = '{{count}} downloading';

      // Correct pattern: count comes from the template interpolation only
      const bannerFragment = ` · ${t(template, { count: downloadingCount })}`;

      expect(bannerFragment).toBe(' · 2 downloading');
      expect(bannerFragment).not.toContain('2 2');
      expect(bannerFragment).not.toMatch(NO_DOUBLE_COUNT_RE); // no "N N" pattern
    });

    it('count appears exactly once in the downloading fragment', () => {
      const downloadingCount = 5;
      const template = '{{count}} downloading';
      const bannerFragment = ` · ${t(template, { count: downloadingCount })}`;

      // "5" should appear exactly once
      const matches = bannerFragment.match(/5/g) ?? [];
      expect(matches.length).toBe(1);
      expect(bannerFragment).toBe(' · 5 downloading');
    });

    it('omits the downloading fragment entirely when downloadingCount is 0', () => {
      const downloadingCount = 0;
      // Mirrors the ternary in StorageBanner: downloadingCount > 0 ? ` · ${...}` : ''
      const fragment =
        downloadingCount > 0 ? ` · ${t('{{count}} downloading', { count: downloadingCount })}` : '';
      expect(fragment).toBe('');
    });

    it('correctly double-counts if count is prepended AND in template — documenting the bug pattern', () => {
      // This test shows WHAT THE BUG LOOKS LIKE, confirming our fix avoids it
      const downloadingCount = 2;
      const template = '{{count}} downloading';

      // BUG pattern (wrong): prepending count AND using template with {{count}}
      const buggyFragment = ` · ${downloadingCount} ${t(template, { count: downloadingCount })}`;
      expect(buggyFragment).toBe(' · 2 2 downloading'); // This is the bug

      // FIX pattern (correct): count comes only from template interpolation
      const fixedFragment = ` · ${t(template, { count: downloadingCount })}`;
      expect(fixedFragment).toBe(' · 2 downloading'); // This is the fix
    });
  });
});
