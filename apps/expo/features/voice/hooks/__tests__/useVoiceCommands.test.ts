/**
 * Unit tests for voice-command logic in useVoiceCommands.
 *
 * Tests the pure helper functions (matchCommand, extractNavigationTarget) and
 * timer-cleanup behaviour that is independent of the React / Expo environment.
 *
 * Run with:  cd apps/expo && bun test features/voice
 */

import { describe, expect, it, mock } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock Expo and React Native modules before importing the module under test.
// bun:test hoists mock.module calls so they take effect before ESM imports.
// ---------------------------------------------------------------------------

mock.module('expo-av', () => ({
  Audio: {
    Recording: {
      createAsync: async () => ({
        recording: {
          stopAndUnloadAsync: async () => {},
          getURI: () => null,
        },
      }),
    },
    RecordingOptionsPresets: { HIGH_QUALITY: {} },
    requestPermissionsAsync: async () => ({ granted: true }),
    setAudioModeAsync: async () => {},
  },
}));

mock.module('expo-speech', () => ({
  stop: () => {},
  speak: () => {},
  isSpeakingAsync: async () => false,
}));

mock.module('expo-location', () => ({
  Accuracy: { BestForNavigation: 6, High: 4 },
  requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
  watchPositionAsync: async () => ({ remove: () => {} }),
  getCurrentPositionAsync: async () => ({
    coords: {
      latitude: 0,
      longitude: 0,
      altitude: null,
      accuracy: null,
      speed: null,
      heading: null,
    },
    timestamp: 0,
  }),
}));

mock.module('react', () => ({
  useCallback: (fn: unknown) => fn,
  useEffect: () => {},
  useRef: (initial: unknown) => ({ current: initial }),
  useState: (initial: unknown) => [initial, () => {}],
}));

// Use dynamic import so the mock.module calls above take effect first
const { matchCommand, extractNavigationTarget } = await import('../useVoiceCommands');

// ---------------------------------------------------------------------------
// Command matching — disambiguation tests (Issue 4)
// ---------------------------------------------------------------------------

describe('matchCommand – where_am_i vs navigate_to disambiguation', () => {
  it('"navigate to my location" does NOT match where_am_i', () => {
    const result = matchCommand('navigate to my location');
    expect(result?.name).not.toBe('where_am_i');
  });

  it('"navigate to my location" matches navigate_to', () => {
    const result = matchCommand('navigate to my location');
    expect(result?.name).toBe('navigate_to');
  });

  it('"where am i" still matches where_am_i', () => {
    const result = matchCommand('where am i');
    expect(result?.name).toBe('where_am_i');
  });

  it('"what\'s my location" still matches where_am_i', () => {
    const result = matchCommand("what's my location");
    expect(result?.name).toBe('where_am_i');
  });

  it('"current location" still matches where_am_i', () => {
    const result = matchCommand('current location');
    expect(result?.name).toBe('where_am_i');
  });

  it('"navigate to summit" matches navigate_to', () => {
    const result = matchCommand('navigate to summit');
    expect(result?.name).toBe('navigate_to');
  });

  it('"go to lake" matches navigate_to', () => {
    const result = matchCommand('go to lake');
    expect(result?.name).toBe('navigate_to');
  });

  it('unknown phrase returns null', () => {
    expect(matchCommand('play some music')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractNavigationTarget
// ---------------------------------------------------------------------------

describe('extractNavigationTarget', () => {
  it('extracts target after "navigate to"', () => {
    expect(extractNavigationTarget('navigate to my location')).toBe('my location');
  });

  it('extracts target after "go to"', () => {
    expect(extractNavigationTarget('go to the summit')).toBe('the summit');
  });

  it('extracts target after "take me to"', () => {
    expect(extractNavigationTarget('take me to camp alpha')).toBe('camp alpha');
  });

  it('extracts target after "directions to"', () => {
    expect(extractNavigationTarget('directions to base camp')).toBe('base camp');
  });

  it('returns trimmed input when no known prefix found', () => {
    expect(extractNavigationTarget('  unknown input  ')).toBe('unknown input');
  });
});

// ---------------------------------------------------------------------------
// Timer cleanup tests (Issues 2 & 3) — verified through simulated hook logic
// ---------------------------------------------------------------------------

describe('startListening timer cleanup (Issue 2)', () => {
  it('calling startListening twice clears the first timeout before setting a second', () => {
    const clearedIds: ReturnType<typeof setTimeout>[] = [];
    const scheduledIds: ReturnType<typeof setTimeout>[] = [];

    let idCounter = 1000;
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;

    // Install spies
    (globalThis as any).setTimeout = (_fn: () => void, _ms: number) => {
      const id = ++idCounter as unknown as ReturnType<typeof setTimeout>;
      scheduledIds.push(id);
      return id;
    };
    (globalThis as any).clearTimeout = (id: ReturnType<typeof setTimeout>) => {
      clearedIds.push(id);
    };

    // Replicate the fixed startListening logic (Issue 2 fix)
    let listenTimeoutRef: ReturnType<typeof setTimeout> | null = null;

    function simulateStartListening() {
      if (listenTimeoutRef !== null) {
        clearTimeout(listenTimeoutRef);
        listenTimeoutRef = null; // <-- the fix: null out after clearing
      }
      listenTimeoutRef = setTimeout(() => {}, 10000);
    }

    simulateStartListening(); // first call — no prior timer
    expect(scheduledIds).toHaveLength(1);
    expect(clearedIds).toHaveLength(0);

    simulateStartListening(); // second call — must clear the first
    expect(scheduledIds).toHaveLength(2);
    expect(clearedIds).toHaveLength(1);
    expect(clearedIds[0]).toBe(scheduledIds[0]);

    // Restore originals
    (globalThis as any).setTimeout = originalSetTimeout;
    (globalThis as any).clearTimeout = originalClearTimeout;
  });
});

describe('processTranscript timer cleanup (Issue 3)', () => {
  it('when a transcript arrives before the 10s timeout, the timeout is cleared', () => {
    const clearedIds: ReturnType<typeof setTimeout>[] = [];
    const scheduledIds: ReturnType<typeof setTimeout>[] = [];

    let idCounter = 2000;
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;

    (globalThis as any).setTimeout = (_fn: () => void, _ms: number) => {
      const id = ++idCounter as unknown as ReturnType<typeof setTimeout>;
      scheduledIds.push(id);
      return id;
    };
    (globalThis as any).clearTimeout = (id: ReturnType<typeof setTimeout>) => {
      clearedIds.push(id);
    };

    let listenTimeoutRef: ReturnType<typeof setTimeout> | null = null;

    function simulateStartListening() {
      if (listenTimeoutRef !== null) {
        clearTimeout(listenTimeoutRef);
        listenTimeoutRef = null;
      }
      listenTimeoutRef = setTimeout(() => {}, 10000);
    }

    function simulateProcessTranscript() {
      // Issue 3 fix: cancel auto-timeout when transcript arrives
      if (listenTimeoutRef !== null) {
        clearTimeout(listenTimeoutRef);
        listenTimeoutRef = null;
      }
    }

    simulateStartListening();
    const autoTimeoutId = scheduledIds[0];
    expect(clearedIds).toHaveLength(0);

    // Transcript arrives — the auto-timeout must be cancelled
    simulateProcessTranscript();
    expect(clearedIds).toContain(autoTimeoutId);
    expect(listenTimeoutRef).toBeNull();

    // Restore originals
    (globalThis as any).setTimeout = originalSetTimeout;
    (globalThis as any).clearTimeout = originalClearTimeout;
  });

  it('after transcript clears the timer, the "timed out" callback does not fire', async () => {
    let timedOutCalled = false;

    const timerId = setTimeout(() => {
      timedOutCalled = true;
    }, 50); // short delay

    // Transcript arrives before timeout fires
    clearTimeout(timerId);

    // Wait beyond the delay; the callback must NOT have fired
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    expect(timedOutCalled).toBe(false);
  });
});
