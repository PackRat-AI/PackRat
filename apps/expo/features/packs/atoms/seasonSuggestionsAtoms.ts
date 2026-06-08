import { atomWithKvStorage } from 'expo-app/atoms/atomWithKvStorage';

export const seasonSuggestionsAnnouncementSeenAtom = atomWithKvStorage({
  key: 'season-suggestions:announcement-seen',
  initialValue: false,
});

export const seasonSuggestionsOpenedAtom = atomWithKvStorage({
  key: 'season-suggestions:opened',
  initialValue: false,
});
