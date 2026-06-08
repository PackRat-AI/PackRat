import { atomWithKvStorage } from 'expo-app/atoms/atomWithKvStorage';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { atomFamily } from 'jotai/utils';

export const DEVICE_PREF_KEY_PREFIX = '__pref:';

const announcementSeenFamily = atomFamily((userId: string) =>
  atomWithKvStorage({
    key: `${DEVICE_PREF_KEY_PREFIX}${userId}:season-suggestions:announcement-seen`,
    initialValue: false,
  }),
);

const openedFamily = atomFamily((userId: string) =>
  atomWithKvStorage({
    key: `${DEVICE_PREF_KEY_PREFIX}${userId}:season-suggestions:opened`,
    initialValue: false,
  }),
);

export function useSeasonSuggestionsPrefs() {
  const user = useUser();
  const userId = user?.id ?? '';

  const announcementSeen = useAtomValue(announcementSeenFamily(userId));
  const setAnnouncementSeen = useSetAtom(announcementSeenFamily(userId));
  const [opened, setOpened] = useAtom(openedFamily(userId));

  return { announcementSeen, setAnnouncementSeen, opened, setOpened };
}
