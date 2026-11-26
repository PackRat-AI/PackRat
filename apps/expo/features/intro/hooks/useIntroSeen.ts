import AsyncStorage from 'expo-app/lib/asyncStorage';
import { useCallback, useEffect, useState } from 'react';

export const INTRO_SEEN_KEY = 'intro_seen_v1';

/**
 * Whether this install has finished the first-launch intro. `null` while the
 * stored value is still loading, so callers can hold rendering instead of
 * flashing the wrong screen.
 */
export function useIntroSeen() {
  const [hasSeen, setHasSeen] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(INTRO_SEEN_KEY)
      .then((value) => {
        if (!cancelled) setHasSeen(value === 'true');
      })
      .catch(() => {
        if (!cancelled) setHasSeen(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const markSeen = useCallback(async () => {
    setHasSeen(true);
    await AsyncStorage.setItem(INTRO_SEEN_KEY, 'true');
  }, []);

  return { hasSeen, markSeen };
}

export async function resetIntroSeen() {
  await AsyncStorage.removeItem(INTRO_SEEN_KEY);
}

export async function readIntroSeen(): Promise<boolean> {
  return (await AsyncStorage.getItem(INTRO_SEEN_KEY)) === 'true';
}
